using System.IO;
using System.Windows;
using System.Windows.Media.Imaging;
using Mosaico.Core;

namespace Mosaico.App;

public sealed class TileBitmapStore
{
    private readonly Dictionary<Guid, TilesetDefinition> _tilesets = [];
    private readonly Dictionary<Guid, BitmapSource> _sources = [];
    private readonly Dictionary<(Guid TilesetId, int TileId), BitmapSource> _tiles = [];

    public void ReplaceAssets(IEnumerable<TilesetDefinition> tilesets, IReadOnlyDictionary<Guid, byte[]> assets)
    {
        var nextTilesets = new Dictionary<Guid, TilesetDefinition>();
        var nextSources = new Dictionary<Guid, BitmapSource>();
        foreach (var tileset in tilesets)
        {
            if (!assets.TryGetValue(tileset.Id, out var bytes))
                throw new ArgumentException($"Missing bitmap asset for tileset {tileset.Id}.", nameof(assets));
            try
            {
                using var stream = new MemoryStream(bytes, writable: false);
                var decoder = BitmapDecoder.Create(stream, BitmapCreateOptions.PreservePixelFormat, BitmapCacheOption.OnLoad);
                if (decoder.Frames.Count != 1) throw new MapFormatException("Animated or multi-frame PNG assets are not supported in F1.");
                var source = decoder.Frames[0];
                if (source.PixelWidth != tileset.ImageWidth || source.PixelHeight != tileset.ImageHeight)
                    throw new MapFormatException("Decoded PNG dimensions do not match tileset metadata.");
                if (source.CanFreeze) source.Freeze();
                nextTilesets.Add(tileset.Id, tileset);
                nextSources.Add(tileset.Id, source);
            }
            catch (Exception error) when (error is FileFormatException or NotSupportedException or ArgumentException)
            {
                throw new MapFormatException($"PNG asset {tileset.Id} cannot be decoded safely.", error);
            }
        }
        _tilesets.Clear();
        _sources.Clear();
        _tiles.Clear();
        foreach (var pair in nextTilesets) _tilesets.Add(pair.Key, pair.Value);
        foreach (var pair in nextSources) _sources.Add(pair.Key, pair.Value);
    }

    public BitmapSource GetSource(Guid tilesetId)
        => _sources.TryGetValue(tilesetId, out var source) ? source : throw new KeyNotFoundException("Tileset bitmap was not loaded.");

    public BitmapSource GetTile(Guid tilesetId, int tileId)
    {
        if (_tiles.TryGetValue((tilesetId, tileId), out var cached)) return cached;
        var tileset = _tilesets.TryGetValue(tilesetId, out var definition)
            ? definition
            : throw new KeyNotFoundException("Tileset definition was not loaded.");
        var rect = tileset.GetSourceRect(tileId);
        var tile = new CroppedBitmap(GetSource(tilesetId), new Int32Rect(rect.X, rect.Y, rect.Width, rect.Height));
        if (tile.CanFreeze) tile.Freeze();
        _tiles.Add((tilesetId, tileId), tile);
        return tile;
    }
}
