namespace Mosaico.Core;

public readonly record struct TileSourceRect(int X, int Y, int Width, int Height);

public readonly record struct TileRef(Guid TilesetId, int TileId);

public sealed class TilesetDefinition
{
    public const long MaximumImagePixels = 16_777_216;
    public const int MaximumTiles = 4_096;

    private TilesetDefinition(
        Guid id,
        string name,
        string assetPath,
        int imageWidth,
        int imageHeight,
        int tileWidth,
        int tileHeight,
        string sha256,
        int marginX,
        int marginY,
        int spacingX,
        int spacingY)
    {
        Id = id;
        Name = name;
        AssetPath = assetPath;
        ImageWidth = imageWidth;
        ImageHeight = imageHeight;
        TileWidth = tileWidth;
        TileHeight = tileHeight;
        Sha256 = sha256;
        MarginX = marginX;
        MarginY = marginY;
        SpacingX = spacingX;
        SpacingY = spacingY;
        Columns = CountAlongAxis(imageWidth, tileWidth, marginX, spacingX);
        Rows = CountAlongAxis(imageHeight, tileHeight, marginY, spacingY);
    }

    public Guid Id { get; }
    public string Name { get; }
    public string AssetPath { get; }
    public int ImageWidth { get; }
    public int ImageHeight { get; }
    public int TileWidth { get; }
    public int TileHeight { get; }
    public int MarginX { get; }
    public int MarginY { get; }
    public int SpacingX { get; }
    public int SpacingY { get; }
    public string Sha256 { get; }
    public int Columns { get; }
    public int Rows { get; }
    public int TileCount => checked(Columns * Rows);

    public static TilesetDefinition Create(
        Guid id,
        string name,
        string assetPath,
        int imageWidth,
        int imageHeight,
        int tileWidth,
        int tileHeight,
        string sha256,
        int marginX = 0,
        int marginY = 0,
        int spacingX = 0,
        int spacingY = 0)
    {
        if (id == Guid.Empty) throw new ArgumentException("Tileset identifier cannot be empty.", nameof(id));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Tileset name is required.", nameof(name));
        if (!IsSafeAssetPath(assetPath)) throw new ArgumentException("Tileset asset path is not a safe project-relative PNG path.", nameof(assetPath));
        ValidateRange(imageWidth, 1, 65_535, nameof(imageWidth));
        ValidateRange(imageHeight, 1, 65_535, nameof(imageHeight));
        if ((long)imageWidth * imageHeight > MaximumImagePixels)
            throw new ArgumentOutOfRangeException(nameof(imageWidth), $"Decoded image exceeds {MaximumImagePixels:N0} pixels.");
        ValidateRange(tileWidth, 1, 2_048, nameof(tileWidth));
        ValidateRange(tileHeight, 1, 2_048, nameof(tileHeight));
        ValidateRange(marginX, 0, 2_048, nameof(marginX));
        ValidateRange(marginY, 0, 2_048, nameof(marginY));
        ValidateRange(spacingX, 0, 2_048, nameof(spacingX));
        ValidateRange(spacingY, 0, 2_048, nameof(spacingY));
        if (sha256.Length != 64 || !sha256.All(Uri.IsHexDigit))
            throw new ArgumentException("SHA-256 must contain 64 hexadecimal characters.", nameof(sha256));

        var result = new TilesetDefinition(id, name.Trim(), assetPath, imageWidth, imageHeight,
            tileWidth, tileHeight, sha256.ToUpperInvariant(), marginX, marginY, spacingX, spacingY);
        if (result.Columns == 0 || result.Rows == 0)
            throw new ArgumentException("Slicing parameters do not produce any complete tiles.");
        if ((long)result.Columns * result.Rows > MaximumTiles)
            throw new ArgumentException($"Tileset exceeds the F1 limit of {MaximumTiles:N0} tiles.");
        return result;
    }

    public TileSourceRect GetSourceRect(int tileId)
    {
        if (tileId < 0 || tileId >= TileCount) throw new ArgumentOutOfRangeException(nameof(tileId));
        var column = tileId % Columns;
        var row = tileId / Columns;
        return new TileSourceRect(
            MarginX + column * (TileWidth + SpacingX),
            MarginY + row * (TileHeight + SpacingY),
            TileWidth,
            TileHeight);
    }

    private static int CountAlongAxis(int image, int tile, int margin, int spacing)
        => Math.Max(0, (image - 2 * margin + spacing) / (tile + spacing));

    private static bool IsSafeAssetPath(string path)
        => !string.IsNullOrWhiteSpace(path)
           && path.EndsWith(".png", StringComparison.OrdinalIgnoreCase)
           && !Path.IsPathRooted(path)
           && !path.Contains('\\')
           && path.Split('/').All(segment => segment.Length > 0 && segment is not "." and not ".." && !segment.Contains(':'));

    private static void ValidateRange(int value, int minimum, int maximum, string parameter)
    {
        if (value < minimum || value > maximum)
            throw new ArgumentOutOfRangeException(parameter, $"Value must be between {minimum} and {maximum}.");
    }
}
