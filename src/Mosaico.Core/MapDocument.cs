using System.Security.Cryptography;
using System.Text;

namespace Mosaico.Core;

public readonly record struct CellEntry(GridCoordinate Coordinate, int TileId);

public sealed class MapDocument
{
    public const int MaximumDimension = 16_384;
    private readonly Dictionary<GridCoordinate, int> _cells = [];

    private MapDocument(Guid id, string name, int width, int height)
    {
        Id = id;
        Name = name;
        Width = width;
        Height = height;
    }

    public Guid Id { get; }
    public string Name { get; private set; }
    public int Width { get; }
    public int Height { get; }
    public int OccupiedCellCount => _cells.Count;

    public static MapDocument Create(string name, int width, int height, Guid? id = null)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Map name is required.", nameof(name));
        }
        if (width is < 1 or > MaximumDimension || height is < 1 or > MaximumDimension)
        {
            throw new ArgumentOutOfRangeException(nameof(width), $"Dimensions must be between 1 and {MaximumDimension}.");
        }
        return new MapDocument(id ?? Guid.NewGuid(), name.Trim(), width, height);
    }

    public int GetTile(GridCoordinate coordinate) => _cells.GetValueOrDefault(coordinate);

    public void SetTile(GridCoordinate coordinate, int tileId)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(tileId);
        if (tileId == 0)
        {
            _cells.Remove(coordinate);
        }
        else
        {
            _cells[coordinate] = tileId;
        }
    }

    public IReadOnlyList<CellEntry> Cells() => _cells
        .OrderBy(pair => pair.Key.Y)
        .ThenBy(pair => pair.Key.X)
        .Select(pair => new CellEntry(pair.Key, pair.Value))
        .ToArray();

    public string StructuralHash()
    {
        var content = new StringBuilder()
            .Append(Id.ToString("D")).Append('|')
            .Append(Name).Append('|')
            .Append(Width).Append('|')
            .Append(Height).Append('\n');
        foreach (var cell in Cells())
        {
            content.Append(cell.Coordinate.X).Append(',')
                .Append(cell.Coordinate.Y).Append('=')
                .Append(cell.TileId).Append('\n');
        }
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(content.ToString())));
    }
}
