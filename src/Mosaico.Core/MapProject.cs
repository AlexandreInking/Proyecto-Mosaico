using System.Security.Cryptography;
using System.Text;

namespace Mosaico.Core;

public sealed class TileLayer
{
    private const int ChunkSize = 32;
    private readonly Dictionary<GridCoordinate, TileRef> _cells = [];
    private readonly Dictionary<GridCoordinate, Dictionary<GridCoordinate, TileRef>> _chunks = [];

    internal TileLayer(Guid id, string name)
    {
        Id = id;
        Name = name;
    }

    public Guid Id { get; }
    public string Name { get; internal set; }
    public bool IsVisible { get; internal set; } = true;
    public bool IsLocked { get; internal set; }
    public int OccupiedCellCount => _cells.Count;

    public TileRef? GetTile(GridCoordinate coordinate)
        => _cells.TryGetValue(coordinate, out var tile) ? tile : null;

    public IReadOnlyList<(GridCoordinate Coordinate, TileRef Tile)> Cells()
        => _cells.OrderBy(pair => pair.Key.Y).ThenBy(pair => pair.Key.X)
            .Select(pair => (pair.Key, pair.Value)).ToArray();

    public IEnumerable<(GridCoordinate Coordinate, TileRef Tile)> EnumerateCells(GridRectangle bounds)
    {
        var firstChunkX = GridMath.FloorDiv(bounds.Left, ChunkSize);
        var lastChunkX = GridMath.FloorDiv(bounds.Right, ChunkSize);
        var firstChunkY = GridMath.FloorDiv(bounds.Top, ChunkSize);
        var lastChunkY = GridMath.FloorDiv(bounds.Bottom, ChunkSize);
        for (var chunkY = firstChunkY; chunkY <= lastChunkY; chunkY++)
        {
            for (var chunkX = firstChunkX; chunkX <= lastChunkX; chunkX++)
            {
                if (!_chunks.TryGetValue(new(chunkX, chunkY), out var chunk)) continue;
                foreach (var (coordinate, tile) in chunk)
                    if (bounds.Contains(coordinate)) yield return (coordinate, tile);
            }
        }
    }

    internal void SetTile(GridCoordinate coordinate, TileRef? tile)
    {
        var chunkCoordinate = new GridCoordinate(
            GridMath.FloorDiv(coordinate.X, ChunkSize),
            GridMath.FloorDiv(coordinate.Y, ChunkSize));
        if (tile is null)
        {
            if (!_cells.Remove(coordinate) || !_chunks.TryGetValue(chunkCoordinate, out var chunk)) return;
            chunk.Remove(coordinate);
            if (chunk.Count == 0) _chunks.Remove(chunkCoordinate);
            return;
        }

        _cells[coordinate] = tile.Value;
        if (!_chunks.TryGetValue(chunkCoordinate, out var targetChunk))
        {
            targetChunk = [];
            _chunks.Add(chunkCoordinate, targetChunk);
        }
        targetChunk[coordinate] = tile.Value;
    }
}

public sealed class MapProject
{
    public const int MaximumDimension = 16_384;
    public const int MaximumLayers = 256;
    public const int MaximumTilesets = 64;
    public const int MaximumOccupiedCells = 1_000_000;

    private readonly List<TilesetDefinition> _tilesets = [];
    private readonly List<TileLayer> _layers = [];

    private MapProject(Guid id, string name, int width, int height, int cellWidth, int cellHeight)
    {
        Id = id;
        Name = name;
        Width = width;
        Height = height;
        CellWidth = cellWidth;
        CellHeight = cellHeight;
    }

    public Guid Id { get; }
    public string Name { get; private set; }
    public int Width { get; }
    public int Height { get; }
    public int CellWidth { get; private set; }
    public int CellHeight { get; private set; }
    public string Orientation => "orthogonal";
    public IReadOnlyList<TilesetDefinition> Tilesets => _tilesets;
    public IReadOnlyList<TileLayer> Layers => _layers;
    public Guid ActiveLayerId { get; private set; }
    public int OccupiedCellCount => _layers.Sum(layer => layer.OccupiedCellCount);

    public static MapProject Create(
        string name,
        int width,
        int height,
        int cellWidth,
        int cellHeight,
        Guid? id = null,
        Guid? initialLayerId = null)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Project name is required.", nameof(name));
        ValidateRange(width, 1, MaximumDimension, nameof(width));
        ValidateRange(height, 1, MaximumDimension, nameof(height));
        ValidateRange(cellWidth, 8, 2_048, nameof(cellWidth));
        ValidateRange(cellHeight, 8, 2_048, nameof(cellHeight));
        var projectId = id ?? Guid.NewGuid();
        if (projectId == Guid.Empty) throw new ArgumentException("Project identifier cannot be empty.", nameof(id));
        var project = new MapProject(projectId, name.Trim(), width, height, cellWidth, cellHeight);
        project.AddLayer("Capa 1", initialLayerId);
        return project;
    }

    public void AddTileset(TilesetDefinition tileset)
    {
        ValidateTilesetAddition(tileset);
        _tilesets.Add(tileset);
    }

    public void RemoveTileset(Guid tilesetId)
    {
        var tileset = _tilesets.SingleOrDefault(item => item.Id == tilesetId)
            ?? throw new KeyNotFoundException("Tileset was not found.");
        _tilesets.Remove(tileset);
    }

    internal void RestoreTileset(TilesetDefinition tileset, int index)
    {
        ValidateTilesetAddition(tileset);
        if (index < 0 || index > _tilesets.Count) throw new ArgumentOutOfRangeException(nameof(index));
        _tilesets.Insert(index, tileset);
    }

    public void ValidateTilesetAddition(TilesetDefinition tileset)
    {
        ArgumentNullException.ThrowIfNull(tileset);
        if (_tilesets.Count >= MaximumTilesets) throw new InvalidOperationException("RESOURCE_LIMIT_TILESETS");
        if (_tilesets.Any(item => item.Id == tileset.Id)) throw new ArgumentException("Tileset identifier already exists.", nameof(tileset));
    }

    public TileLayer AddLayer(string name, Guid? id = null)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Layer name is required.", nameof(name));
        if (_layers.Count >= MaximumLayers) throw new InvalidOperationException("RESOURCE_LIMIT_LAYERS");
        var layerId = id ?? Guid.NewGuid();
        if (layerId == Guid.Empty || _layers.Any(layer => layer.Id == layerId))
            throw new ArgumentException("Layer identifier must be non-empty and unique.", nameof(id));
        var layer = new TileLayer(layerId, name.Trim());
        _layers.Add(layer);
        ActiveLayerId = layerId;
        return layer;
    }

    public void MoveLayer(Guid layerId, int newIndex)
    {
        if (newIndex < 0 || newIndex >= _layers.Count) throw new ArgumentOutOfRangeException(nameof(newIndex));
        var layer = RequireLayer(layerId);
        _layers.Remove(layer);
        _layers.Insert(newIndex, layer);
    }

    public void RenameLayer(Guid layerId, string name)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Layer name is required.", nameof(name));
        RequireLayer(layerId).Name = name.Trim();
    }

    public void RemoveLayer(Guid layerId)
    {
        if (_layers.Count == 1) throw new InvalidOperationException("A project must contain at least one layer.");
        var layer = RequireLayer(layerId);
        _layers.Remove(layer);
        if (ActiveLayerId == layerId) ActiveLayerId = _layers[^1].Id;
    }

    internal void RestoreLayer(TileLayer layer, int index)
    {
        ArgumentNullException.ThrowIfNull(layer);
        if (_layers.Count >= MaximumLayers) throw new InvalidOperationException("RESOURCE_LIMIT_LAYERS");
        if (_layers.Any(item => item.Id == layer.Id)) throw new ArgumentException("Layer identifier already exists.", nameof(layer));
        if (index < 0 || index > _layers.Count) throw new ArgumentOutOfRangeException(nameof(index));
        _layers.Insert(index, layer);
    }

    public int IndexOfLayer(Guid layerId) => _layers.IndexOf(RequireLayer(layerId));

    public void SetLayerVisibility(Guid layerId, bool isVisible) => RequireLayer(layerId).IsVisible = isVisible;
    public void SetLayerLocked(Guid layerId, bool isLocked) => RequireLayer(layerId).IsLocked = isLocked;
    public void SetActiveLayer(Guid layerId) => ActiveLayerId = RequireLayer(layerId).Id;

    public void SetCellSize(int cellWidth, int cellHeight)
    {
        ValidateRange(cellWidth, 8, 2_048, nameof(cellWidth));
        ValidateRange(cellHeight, 8, 2_048, nameof(cellHeight));
        CellWidth = cellWidth;
        CellHeight = cellHeight;
    }

    public TileRef? GetTile(Guid layerId, GridCoordinate coordinate) => RequireLayer(layerId).GetTile(coordinate);

    public void SetTile(Guid layerId, GridCoordinate coordinate, TileRef? tile)
    {
        var layer = RequireLayer(layerId);
        if (layer.IsLocked) throw new InvalidOperationException("Layer is locked.");
        if (coordinate.X < 0 || coordinate.X >= Width || coordinate.Y < 0 || coordinate.Y >= Height)
            throw new ArgumentOutOfRangeException(nameof(coordinate), "Coordinate is outside map bounds.");
        if (tile is not null)
        {
            var tileset = _tilesets.SingleOrDefault(item => item.Id == tile.Value.TilesetId)
                ?? throw new ArgumentException("Tile references an unknown tileset.", nameof(tile));
            if (tile.Value.TileId < 0 || tile.Value.TileId >= tileset.TileCount)
                throw new ArgumentOutOfRangeException(nameof(tile), "Tile identifier is outside tileset bounds.");
            if (layer.GetTile(coordinate) is null && OccupiedCellCount >= MaximumOccupiedCells)
                throw new InvalidOperationException("RESOURCE_LIMIT_OCCUPIED_CELLS");
        }
        layer.SetTile(coordinate, tile);
    }

    internal void RestoreTileReference(Guid layerId, GridCoordinate coordinate, TileRef tile)
    {
        if (coordinate.X < 0 || coordinate.X >= Width || coordinate.Y < 0 || coordinate.Y >= Height)
            throw new ArgumentOutOfRangeException(nameof(coordinate), "Coordinate is outside map bounds.");
        if (tile.TileId < 0) throw new ArgumentOutOfRangeException(nameof(tile));
        var layer = RequireLayer(layerId);
        if (layer.GetTile(coordinate) is null)
            ValidateOccupiedCellBudget(OccupiedCellCount, 1);
        layer.SetTile(coordinate, tile);
    }

    internal static void ValidateOccupiedCellBudget(int occupiedCells, int additions)
    {
        if (occupiedCells < 0 || additions < 0 || (long)occupiedCells + additions > MaximumOccupiedCells)
            throw new InvalidOperationException("RESOURCE_LIMIT_OCCUPIED_CELLS");
    }

    public string StructuralHash()
    {
        var text = new StringBuilder().Append(Id.ToString("D")).Append('|').Append(Name).Append('|')
            .Append(Width).Append('|').Append(Height).Append('|').Append(CellWidth).Append('|').Append(CellHeight)
            .Append('|').Append(ActiveLayerId.ToString("D")).Append('\n');
        foreach (var tileset in _tilesets.OrderBy(item => item.Id))
            text.Append("T|").Append(tileset.Id.ToString("D")).Append('|').Append(tileset.Name).Append('|')
                .Append(tileset.AssetPath).Append('|').Append(tileset.ImageWidth).Append('x').Append(tileset.ImageHeight).Append('|')
                .Append(tileset.TileWidth).Append('x').Append(tileset.TileHeight).Append('|')
                .Append(tileset.MarginX).Append(',').Append(tileset.MarginY).Append('|')
                .Append(tileset.SpacingX).Append(',').Append(tileset.SpacingY).Append('|').Append(tileset.Sha256).Append('\n');
        foreach (var layer in _layers)
        {
            text.Append("L|").Append(layer.Id.ToString("D")).Append('|').Append(layer.Name).Append('|')
                .Append(layer.IsVisible).Append('|').Append(layer.IsLocked).Append('\n');
            foreach (var cell in layer.Cells())
                text.Append(cell.Coordinate.X).Append(',').Append(cell.Coordinate.Y).Append('=')
                    .Append(cell.Tile.TilesetId.ToString("D")).Append(':').Append(cell.Tile.TileId).Append('\n');
        }
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text.ToString())));
    }

    private TileLayer RequireLayer(Guid id)
        => _layers.SingleOrDefault(layer => layer.Id == id) ?? throw new KeyNotFoundException("Layer was not found.");

    private static void ValidateRange(int value, int minimum, int maximum, string parameter)
    {
        if (value < minimum || value > maximum)
            throw new ArgumentOutOfRangeException(parameter, $"Value must be between {minimum} and {maximum}.");
    }
}
