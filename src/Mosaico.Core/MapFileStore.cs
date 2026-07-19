using System.Text;
using System.Text.Json;

namespace Mosaico.Core;

public sealed class MapFormatException(string message, Exception? inner = null) : Exception(message, inner);

public static class MapFileStore
{
    public const long MaximumFileBytes = 64L * 1024 * 1024;
    public const int MaximumCells = 1_000_000;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        MaxDepth = 64,
    };

    public static string Serialize(MapDocument document)
    {
        var dto = new MapDto
        {
            Format = "mosaico-map",
            FormatVersion = 0,
            Id = document.Id,
            Name = document.Name,
            Width = document.Width,
            Height = document.Height,
            Cells = document.Cells()
                .Select(cell => new CellDto(cell.Coordinate.X, cell.Coordinate.Y, cell.TileId))
                .ToArray(),
        };
        return JsonSerializer.Serialize(dto, JsonOptions) + "\n";
    }

    public static MapDocument Deserialize(string json)
    {
        if (Encoding.UTF8.GetByteCount(json) > MaximumFileBytes)
        {
            throw new MapFormatException($"RESOURCE_LIMIT_FILE_BYTES: maximum is {MaximumFileBytes} bytes.");
        }
        try
        {
            var dto = JsonSerializer.Deserialize<MapDto>(json, JsonOptions)
                ?? throw new MapFormatException("Invalid empty map document.");
            if (dto.Format != "mosaico-map" || dto.FormatVersion != 0)
            {
                throw new MapFormatException("Unsupported map format or experimental version.");
            }
            if (dto.Cells.Length > MaximumCells)
            {
                throw new MapFormatException($"RESOURCE_LIMIT_COUNT: maximum is {MaximumCells} cells.");
            }
            var document = MapDocument.Create(dto.Name, dto.Width, dto.Height, dto.Id);
            var seen = new HashSet<GridCoordinate>();
            foreach (var cell in dto.Cells)
            {
                var coordinate = new GridCoordinate(cell.X, cell.Y);
                if (!seen.Add(coordinate) || cell.TileId <= 0)
                {
                    throw new MapFormatException("Cells must be unique and tileId must be positive.");
                }
                document.SetTile(coordinate, cell.TileId);
            }
            return document;
        }
        catch (MapFormatException)
        {
            throw;
        }
        catch (Exception error) when (error is JsonException or ArgumentException or ArgumentOutOfRangeException)
        {
            throw new MapFormatException($"Invalid map document: {error.Message}", error);
        }
    }

    public static MapDocument Load(string path)
    {
        var info = new FileInfo(path);
        if (!info.Exists)
        {
            throw new FileNotFoundException("Map file was not found.", path);
        }
        if (info.Length > MaximumFileBytes)
        {
            throw new MapFormatException($"RESOURCE_LIMIT_FILE_BYTES: {info.Length} exceeds {MaximumFileBytes} bytes.");
        }
        return Deserialize(File.ReadAllText(path, Encoding.UTF8));
    }

    public static void SaveAtomic(string path, MapDocument document)
    {
        var fullPath = Path.GetFullPath(path);
        var directory = Path.GetDirectoryName(fullPath)
            ?? throw new ArgumentException("A destination directory is required.", nameof(path));
        Directory.CreateDirectory(directory);
        var temporary = Path.Combine(directory, $".{Path.GetFileName(fullPath)}.{Guid.NewGuid():N}.tmp");
        var backup = fullPath + ".bak";
        try
        {
            var bytes = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false).GetBytes(Serialize(document));
            _ = Deserialize(Encoding.UTF8.GetString(bytes));
            using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough))
            {
                stream.Write(bytes);
                stream.Flush(flushToDisk: true);
            }
            if (File.Exists(fullPath))
            {
                File.Delete(backup);
                File.Replace(temporary, fullPath, backup, ignoreMetadataErrors: true);
            }
            else
            {
                File.Move(temporary, fullPath);
            }
        }
        finally
        {
            if (File.Exists(temporary))
            {
                File.Delete(temporary);
            }
        }
    }

    private sealed class MapDto
    {
        public string Format { get; init; } = "";
        public int FormatVersion { get; init; }
        public Guid Id { get; init; }
        public string Name { get; init; } = "";
        public int Width { get; init; }
        public int Height { get; init; }
        public CellDto[] Cells { get; init; } = [];
    }

    private sealed record CellDto(int X, int Y, int TileId);
}
