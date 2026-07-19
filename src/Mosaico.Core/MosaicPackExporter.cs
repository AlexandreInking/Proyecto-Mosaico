using System.IO.Compression;
using System.Text;
using System.Text.Json;

namespace Mosaico.Core;

public static class MosaicPackExporter
{
    private static readonly DateTimeOffset DeterministicTimestamp = new(1980, 1, 1, 0, 0, 0, TimeSpan.Zero);
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        MaxDepth = 64,
    };

    public static byte[] CreateBytes(MapProject project, IReadOnlyDictionary<Guid, byte[]> assets)
    {
        ArgumentNullException.ThrowIfNull(project);
        ArgumentNullException.ThrowIfNull(assets);
        MapProjectFileStore.ValidateAssets(project, assets);
        using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            WriteEntry(archive, "manifest.json", Encoding.UTF8.GetBytes(SerializeManifest(project)));
            foreach (var tileset in project.Tilesets.OrderBy(item => item.Id))
                WriteEntry(archive, tileset.AssetPath, assets[tileset.Id]);
        }
        if (output.Length > MapProjectFileStore.MaximumArchiveBytes)
            throw new MapFormatException("RESOURCE_LIMIT_FILE_BYTES");
        return output.ToArray();
    }

    public static void SaveAtomic(string path, MapProject project, IReadOnlyDictionary<Guid, byte[]> assets)
    {
        var bytes = CreateBytes(project, assets);
        var fullPath = Path.GetFullPath(path);
        var directory = Path.GetDirectoryName(fullPath)
            ?? throw new ArgumentException("A destination directory is required.", nameof(path));
        Directory.CreateDirectory(directory);
        var temporary = Path.Combine(directory, $".{Path.GetFileName(fullPath)}.{Guid.NewGuid():N}.tmp");
        var backup = fullPath + ".bak";
        try
        {
            using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, FileOptions.WriteThrough))
            {
                stream.Write(bytes);
                stream.Flush(flushToDisk: true);
            }
            if (!File.ReadAllBytes(temporary).AsSpan().SequenceEqual(bytes))
                throw new IOException("Temporary export verification failed.");
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
        var manifest = new ExportManifest
        {
            Schema = "mosaico-export",
            Version = 1,
            MapId = project.Id,
            Name = project.Name,
            Orientation = project.Orientation,
            Width = project.Width,
            Height = project.Height,
            CellWidth = project.CellWidth,
            CellHeight = project.CellHeight,
            CoordinateSystem = "x-right-y-down",
            Tilesets = project.Tilesets.Select((tileset, order) => new ExportTileset
            {
                Id = tileset.Id,
                Order = order,
                Name = tileset.Name,
                AssetPath = tileset.AssetPath,
                Sha256 = tileset.Sha256,
                ImageWidth = tileset.ImageWidth,
                ImageHeight = tileset.ImageHeight,
                TileWidth = tileset.TileWidth,
                TileHeight = tileset.TileHeight,
                MarginX = tileset.MarginX,
                MarginY = tileset.MarginY,
                SpacingX = tileset.SpacingX,
                SpacingY = tileset.SpacingY,
                Columns = tileset.Columns,
                Rows = tileset.Rows,
            }).ToArray(),
            Layers = project.Layers.Select((layer, order) => new ExportLayer
            {
                Id = layer.Id,
                Order = order,
                Name = layer.Name,
                IsVisible = layer.IsVisible,
                IsLocked = layer.IsLocked,
                Cells = layer.Cells().Select(cell => new ExportCell
                {
                    X = cell.Coordinate.X,
                    Y = cell.Coordinate.Y,
                    TilesetId = cell.Tile.TilesetId,
                    TileId = cell.Tile.TileId,
                }).ToArray(),
            }).ToArray(),
        };
        return JsonSerializer.Serialize(manifest, JsonOptions) + "\n";
    }

    private static void WriteEntry(ZipArchive archive, string name, byte[] bytes)
    {
        var entry = archive.CreateEntry(name, CompressionLevel.NoCompression);
        entry.LastWriteTime = DeterministicTimestamp;
        using var stream = entry.Open();
        stream.Write(bytes);
    }

    private sealed class ExportManifest
    {
        public string Schema { get; init; } = "";
        public int Version { get; init; }
        public Guid MapId { get; init; }
        public string Name { get; init; } = "";
        public string Orientation { get; init; } = "";
        public int Width { get; init; }
        public int Height { get; init; }
        public int CellWidth { get; init; }
        public int CellHeight { get; init; }
        public string CoordinateSystem { get; init; } = "";
        public ExportTileset[] Tilesets { get; init; } = [];
        public ExportLayer[] Layers { get; init; } = [];
    }

    private sealed class ExportTileset
    {
        public Guid Id { get; init; }
        public int Order { get; init; }
        public string Name { get; init; } = "";
        public string AssetPath { get; init; } = "";
        public string Sha256 { get; init; } = "";
        public int ImageWidth { get; init; }
        public int ImageHeight { get; init; }
        public int TileWidth { get; init; }
        public int TileHeight { get; init; }
        public int MarginX { get; init; }
        public int MarginY { get; init; }
        public int SpacingX { get; init; }
        public int SpacingY { get; init; }
        public int Columns { get; init; }
        public int Rows { get; init; }
    }

    private sealed class ExportLayer
    {
        public Guid Id { get; init; }
        public int Order { get; init; }
        public string Name { get; init; } = "";
        public bool IsVisible { get; init; }
        public bool IsLocked { get; init; }
        public ExportCell[] Cells { get; init; } = [];
    }

    private sealed class ExportCell
    {
        public int X { get; init; }
        public int Y { get; init; }
        public Guid TilesetId { get; init; }
        public int TileId { get; init; }
    }
}
