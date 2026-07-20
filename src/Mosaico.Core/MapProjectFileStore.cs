using System.Buffers.Binary;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Mosaico.Core;

public sealed record LoadedMapProject(MapProject Project, IReadOnlyDictionary<Guid, byte[]> Assets);

public static class PngMetadataReader
{
    private static readonly byte[] Signature = [137, 80, 78, 71, 13, 10, 26, 10];

    public static (int Width, int Height) ReadDimensions(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length < 24 || !bytes[..8].SequenceEqual(Signature)
            || !bytes.Slice(12, 4).SequenceEqual("IHDR"u8))
            throw new MapFormatException("Asset is not a supported PNG with an IHDR header.");
        var width = BinaryPrimitives.ReadInt32BigEndian(bytes.Slice(16, 4));
        var height = BinaryPrimitives.ReadInt32BigEndian(bytes.Slice(20, 4));
        if (width is < 1 or > 65_535 || height is < 1 or > 65_535)
            throw new MapFormatException("PNG dimensions are outside supported limits.");
        return (width, height);
    }
}

public static class MapProjectFileStore
{
    public const long MaximumAssetBytes = 64L * 1024 * 1024;
    public const long MaximumArchiveBytes = 256L * 1024 * 1024;
    private const int MaximumEntries = MapProject.MaximumTilesets + 1;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        MaxDepth = 64,
    };

    public static LoadedMapProject Load(string path)
    {
        var info = new FileInfo(path);
        if (!info.Exists) throw new FileNotFoundException("Project file was not found.", path);
        if (info.Length > MaximumArchiveBytes)
            throw new MapFormatException($"RESOURCE_LIMIT_FILE_BYTES: {info.Length} exceeds {MaximumArchiveBytes} bytes.");
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Load(stream);
    }

    public static LoadedMapProject Load(Stream source)
    {
        ArgumentNullException.ThrowIfNull(source);
        try
        {
            using var bounded = CopyBounded(source, MaximumArchiveBytes);
            using var archive = new ZipArchive(bounded, ZipArchiveMode.Read, leaveOpen: false);
            if (archive.Entries.Count is < 1 or > MaximumEntries)
                throw new MapFormatException($"Archive must contain 1…{MaximumEntries} entries.");

            var entries = new Dictionary<string, ZipArchiveEntry>(StringComparer.OrdinalIgnoreCase);
            long totalLength = 0;
            foreach (var entry in archive.Entries)
            {
                ValidateEntryName(entry.FullName);
                if (!entries.TryAdd(entry.FullName, entry)) throw new MapFormatException("Archive contains duplicate entry names.");
                totalLength = checked(totalLength + entry.Length);
                if (totalLength > MaximumArchiveBytes) throw new MapFormatException("RESOURCE_LIMIT_UNCOMPRESSED_BYTES");
            }

            if (!entries.TryGetValue("project.json", out var projectEntry))
                throw new MapFormatException("Archive is missing project.json.");
            var projectJson = Encoding.UTF8.GetString(ReadEntry(projectEntry, MaximumAssetBytes));
            var dto = JsonSerializer.Deserialize<ProjectDto>(projectJson, JsonOptions)
                ?? throw new MapFormatException("Project manifest is empty.");
            ValidateManifest(dto);

            var expectedEntries = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "project.json" };
            var assets = new Dictionary<Guid, byte[]>();
            foreach (var tileset in dto.Tilesets!)
            {
                var expectedPath = $"assets/{tileset.Id:D}.png";
                if (!string.Equals(tileset.AssetPath, expectedPath, StringComparison.Ordinal))
                    throw new MapFormatException("Tileset asset path does not match its stable identifier.");
                if (!entries.TryGetValue(expectedPath, out var assetEntry))
                    throw new MapFormatException($"Archive is missing {expectedPath}.");
                expectedEntries.Add(expectedPath);
                var bytes = ReadEntry(assetEntry, MaximumAssetBytes);
                var dimensions = PngMetadataReader.ReadDimensions(bytes);
                if (dimensions != (tileset.ImageWidth, tileset.ImageHeight))
                    throw new MapFormatException("PNG dimensions do not match tileset metadata.");
                var hash = Convert.ToHexString(SHA256.HashData(bytes));
                if (!string.Equals(hash, tileset.Sha256, StringComparison.OrdinalIgnoreCase))
                    throw new MapFormatException("PNG hash does not match tileset metadata.");
                assets.Add(tileset.Id, bytes);
            }
            if (entries.Keys.Any(name => !expectedEntries.Contains(name)))
                throw new MapFormatException("Archive contains an unexpected entry.");

            return new LoadedMapProject(BuildProject(dto), assets);
        }
        catch (MapFormatException)
        {
            throw;
        }
        catch (Exception error) when (error is InvalidDataException or JsonException or ArgumentException
            or ArgumentOutOfRangeException or OverflowException or EndOfStreamException or NullReferenceException)
        {
            throw new MapFormatException($"Invalid Mosaico project: {error.Message}", error);
        }
    }

    public static void SaveAtomic(string path, MapProject project, IReadOnlyDictionary<Guid, byte[]> assets)
    {
        ArgumentNullException.ThrowIfNull(project);
        ArgumentNullException.ThrowIfNull(assets);
        ValidateAssets(project, assets);
        var fullPath = Path.GetFullPath(path);
        var directory = Path.GetDirectoryName(fullPath)
            ?? throw new ArgumentException("A destination directory is required.", nameof(path));
        Directory.CreateDirectory(directory);
        var temporary = Path.Combine(directory, $".{Path.GetFileName(fullPath)}.{Guid.NewGuid():N}.tmp");
        var backup = fullPath + ".bak";
        try
        {
            using (var output = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, FileOptions.WriteThrough))
            using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: false))
            {
                WriteEntry(archive, "project.json", Encoding.UTF8.GetBytes(SerializeManifest(project)));
                foreach (var tileset in project.Tilesets.OrderBy(item => item.Id))
                    WriteEntry(archive, tileset.AssetPath, assets[tileset.Id]);
            }
            var verified = Load(temporary);
            if (verified.Project.StructuralHash() != project.StructuralHash())
                throw new MapFormatException("Temporary project verification failed before atomic replace.");
            if (File.Exists(fullPath))
            {
                File.Delete(backup);
                File.Replace(temporary, fullPath, backup, ignoreMetadataErrors: true);
            }
            else File.Move(temporary, fullPath);
        }
        finally
        {
            if (File.Exists(temporary)) File.Delete(temporary);
        }
    }

    public static string SerializeManifest(MapProject project)
    {
        var dto = new ProjectDto
        {
            Format = "mosaico-project",
            FormatVersion = 1,
            Id = project.Id,
            Name = project.Name,
            Orientation = project.Orientation,
            Width = project.Width,
            Height = project.Height,
            CellWidth = project.CellWidth,
            CellHeight = project.CellHeight,
            ActiveLayerId = project.ActiveLayerId,
            Tilesets = project.Tilesets.Select(ToDto).ToArray(),
            Layers = project.Layers.Select((layer, order) => new LayerDto
            {
                Id = layer.Id,
                Name = layer.Name,
                Order = order,
                IsVisible = layer.IsVisible,
                IsLocked = layer.IsLocked,
                Cells = layer.Cells().Select(cell => new CellDto(
                    cell.Coordinate.X,
                    cell.Coordinate.Y,
                    cell.Tile.TilesetId,
                    cell.Tile.TileId)).ToArray(),
            }).ToArray(),
        };
        return JsonSerializer.Serialize(dto, JsonOptions) + "\n";
    }

    private static MapProject BuildProject(ProjectDto dto)
    {
        var orderedLayers = dto.Layers!.OrderBy(layer => layer.Order).ToArray();
        var first = orderedLayers[0];
        var project = MapProject.Create(dto.Name, dto.Width, dto.Height, dto.CellWidth, dto.CellHeight, dto.Id, first.Id);
        project.RenameLayer(first.Id, first.Name);
        foreach (var tileset in dto.Tilesets!)
            project.AddTileset(TilesetDefinition.Create(tileset.Id, tileset.Name, tileset.AssetPath,
                tileset.ImageWidth, tileset.ImageHeight, tileset.TileWidth, tileset.TileHeight, tileset.Sha256,
                tileset.MarginX, tileset.MarginY, tileset.SpacingX, tileset.SpacingY));
        foreach (var layer in orderedLayers.Skip(1)) project.AddLayer(layer.Name, layer.Id);
        foreach (var layerDto in orderedLayers)
        {
            foreach (var cell in layerDto.Cells!)
            {
                var tile = new TileRef(cell.TilesetId, cell.TileId);
                if (project.Tilesets.Any(item => item.Id == cell.TilesetId))
                    project.SetTile(layerDto.Id, new(cell.X, cell.Y), tile);
                else project.RestoreTileReference(layerDto.Id, new(cell.X, cell.Y), tile);
            }
            project.SetLayerVisibility(layerDto.Id, layerDto.IsVisible);
            project.SetLayerLocked(layerDto.Id, layerDto.IsLocked);
        }
        project.SetActiveLayer(dto.ActiveLayerId);
        return project;
    }

    private static TilesetDto ToDto(TilesetDefinition tileset) => new()
    {
        Id = tileset.Id,
        Name = tileset.Name,
        AssetPath = tileset.AssetPath,
        ImageWidth = tileset.ImageWidth,
        ImageHeight = tileset.ImageHeight,
        TileWidth = tileset.TileWidth,
        TileHeight = tileset.TileHeight,
        MarginX = tileset.MarginX,
        MarginY = tileset.MarginY,
        SpacingX = tileset.SpacingX,
        SpacingY = tileset.SpacingY,
        Sha256 = tileset.Sha256,
    };

    private static void ValidateManifest(ProjectDto dto)
    {
        if (dto.Format != "mosaico-project" || dto.FormatVersion != 1 || dto.Orientation != "orthogonal")
            throw new MapFormatException("Unsupported project format, version, or orientation.");
        if (dto.Id == Guid.Empty || dto.ActiveLayerId == Guid.Empty)
            throw new MapFormatException("Project and active layer identifiers are required.");
        if (dto.Tilesets is null || dto.Tilesets.Length > MapProject.MaximumTilesets
            || dto.Tilesets.Any(item => item is null))
            throw new MapFormatException("Tilesets collection is invalid.");
        if (dto.Layers is null || dto.Layers.Length is < 1 or > MapProject.MaximumLayers
            || dto.Layers.Any(item => item is null))
            throw new MapFormatException("Layers collection is invalid.");
        if (dto.Tilesets.Select(item => item.Id).Distinct().Count() != dto.Tilesets.Length
            || dto.Layers.Select(item => item.Id).Distinct().Count() != dto.Layers.Length)
            throw new MapFormatException("Stable identifiers must be unique.");
        if (!dto.Layers.Any(layer => layer.Id == dto.ActiveLayerId))
            throw new MapFormatException("Active layer does not exist.");
        var orders = dto.Layers.Select(layer => layer.Order).Order().ToArray();
        if (!orders.SequenceEqual(Enumerable.Range(0, dto.Layers.Length)))
            throw new MapFormatException("Layer order must be contiguous and unique.");
        long cells = 0;
        foreach (var layer in dto.Layers)
        {
            if (layer.Id == Guid.Empty || string.IsNullOrWhiteSpace(layer.Name) || layer.Cells is null
                || layer.Cells.Any(cell => cell is null))
                throw new MapFormatException("Layer metadata or cells are invalid.");
            cells += layer.Cells.Length;
            if (cells > MapProject.MaximumOccupiedCells) throw new MapFormatException("RESOURCE_LIMIT_OCCUPIED_CELLS");
            if (layer.Cells.Select(cell => (cell.X, cell.Y)).Distinct().Count() != layer.Cells.Length)
                throw new MapFormatException("Layer cell coordinates must be unique.");
            if (layer.Cells.Any(cell => cell.TilesetId == Guid.Empty || cell.TileId < 0
                || cell.X < 0 || cell.X >= dto.Width || cell.Y < 0 || cell.Y >= dto.Height))
                throw new MapFormatException("Layer contains an invalid tile reference or coordinate.");
        }
    }

    internal static void ValidateAssets(MapProject project, IReadOnlyDictionary<Guid, byte[]> assets)
    {
        long totalBytes = 0;
        foreach (var tileset in project.Tilesets)
        {
            if (!assets.TryGetValue(tileset.Id, out var bytes)) throw new MapFormatException("Tileset asset is missing.");
            if (bytes.LongLength > MaximumAssetBytes) throw new MapFormatException("RESOURCE_LIMIT_ASSET_BYTES");
            totalBytes = checked(totalBytes + bytes.LongLength);
            if (totalBytes > MaximumArchiveBytes) throw new MapFormatException("RESOURCE_LIMIT_UNCOMPRESSED_BYTES");
            if (PngMetadataReader.ReadDimensions(bytes) != (tileset.ImageWidth, tileset.ImageHeight))
                throw new MapFormatException("PNG dimensions do not match tileset metadata.");
            if (!string.Equals(Convert.ToHexString(SHA256.HashData(bytes)), tileset.Sha256, StringComparison.OrdinalIgnoreCase))
                throw new MapFormatException("PNG hash does not match tileset metadata.");
        }
    }

    private static void ValidateEntryName(string name)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Contains('\\') || name.Contains(':') || Path.IsPathRooted(name)
            || name.Split('/').Any(segment => segment.Length == 0 || segment is "." or ".."))
            throw new MapFormatException("Archive contains an unsafe entry path.");
    }

    private static MemoryStream CopyBounded(Stream source, long limit)
    {
        var result = new MemoryStream();
        var buffer = new byte[81920];
        long total = 0;
        int read;
        while ((read = source.Read(buffer, 0, buffer.Length)) > 0)
        {
            total += read;
            if (total > limit) throw new MapFormatException("RESOURCE_LIMIT_FILE_BYTES");
            result.Write(buffer, 0, read);
        }
        result.Position = 0;
        return result;
    }

    private static byte[] ReadEntry(ZipArchiveEntry entry, long limit)
    {
        if (entry.Length > limit) throw new MapFormatException("RESOURCE_LIMIT_ENTRY_BYTES");
        using var input = entry.Open();
        using var output = CopyBounded(input, limit);
        return output.ToArray();
    }

    private static void WriteEntry(ZipArchive archive, string name, byte[] bytes)
    {
        var entry = archive.CreateEntry(name, CompressionLevel.Optimal);
        using var stream = entry.Open();
        stream.Write(bytes);
    }

    private sealed class ProjectDto
    {
        public string Format { get; init; } = "";
        public int FormatVersion { get; init; }
        public Guid Id { get; init; }
        public string Name { get; init; } = "";
        public string Orientation { get; init; } = "";
        public int Width { get; init; }
        public int Height { get; init; }
        public int CellWidth { get; init; }
        public int CellHeight { get; init; }
        public Guid ActiveLayerId { get; init; }
        public TilesetDto[]? Tilesets { get; init; }
        public LayerDto[]? Layers { get; init; }
    }

    private sealed class TilesetDto
    {
        public Guid Id { get; init; }
        public string Name { get; init; } = "";
        public string AssetPath { get; init; } = "";
        public int ImageWidth { get; init; }
        public int ImageHeight { get; init; }
        public int TileWidth { get; init; }
        public int TileHeight { get; init; }
        public int MarginX { get; init; }
        public int MarginY { get; init; }
        public int SpacingX { get; init; }
        public int SpacingY { get; init; }
        public string Sha256 { get; init; } = "";
    }

    private sealed class LayerDto
    {
        public Guid Id { get; init; }
        public string Name { get; init; } = "";
        public int Order { get; init; }
        public bool IsVisible { get; init; }
        public bool IsLocked { get; init; }
        public CellDto[]? Cells { get; init; }
    }

    private sealed record CellDto(int X, int Y, Guid TilesetId, int TileId);
}
