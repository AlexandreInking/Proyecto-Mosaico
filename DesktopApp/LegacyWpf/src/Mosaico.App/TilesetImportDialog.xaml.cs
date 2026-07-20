using System.IO;
using System.Security.Cryptography;
using System.Windows;
using System.Windows.Media.Imaging;
using Mosaico.Core;

namespace Mosaico.App;

public sealed record TilesetImportResult(TilesetDefinition Definition, byte[] PngBytes);

public partial class TilesetImportDialog : Window
{
    private readonly byte[] _pngBytes;
    private readonly Guid _tilesetId;
    private readonly int _imageWidth;
    private readonly int _imageHeight;

    public TilesetImportDialog(string sourcePath, byte[] pngBytes, Guid tilesetId)
    {
        InitializeComponent();
        _pngBytes = pngBytes;
        _tilesetId = tilesetId;
        (_imageWidth, _imageHeight) = PngMetadataReader.ReadDimensions(pngBytes);
        if ((long)_imageWidth * _imageHeight > TilesetDefinition.MaximumImagePixels)
            throw new MapFormatException($"PNG excede {TilesetDefinition.MaximumImagePixels:N0} píxeles decodificados.");
        SourceText.Text = $"{sourcePath}  ·  {_imageWidth} × {_imageHeight} px";
        NameBox.Text = Path.GetFileNameWithoutExtension(sourcePath);
        using var stream = new MemoryStream(pngBytes, writable: false);
        var decoder = BitmapDecoder.Create(stream, BitmapCreateOptions.PreservePixelFormat, BitmapCacheOption.OnLoad);
        PreviewImage.Source = decoder.Frames[0];
        TileWidthBox.Text = GuessTileSize(_imageWidth).ToString();
        TileHeightBox.Text = GuessTileSize(_imageHeight).ToString();
        UpdatePreviewState();
    }

    public TilesetImportResult? Result { get; private set; }

    private static int GuessTileSize(int imageSize)
    {
        foreach (var candidate in new[] { 16, 32, 8, 48, 64 })
            if (imageSize % candidate == 0) return candidate;
        return Math.Min(imageSize, 16);
    }

    private void Input_Changed(object sender, System.Windows.Controls.TextChangedEventArgs e)
    {
        if (IsInitialized) UpdatePreviewState();
    }

    private void UpdatePreviewState()
    {
        if (!TryValues(out var values))
        {
            CountText.Text = "Parámetros incompletos";
            ConfirmButton.IsEnabled = false;
            SlicePreview.Visibility = Visibility.Hidden;
            return;
        }
        var columns = Count(_imageWidth, values.TileWidth, values.MarginX, values.SpacingX);
        var rows = Count(_imageHeight, values.TileHeight, values.MarginY, values.SpacingY);
        var tileCount = (long)columns * rows;
        CountText.Text = $"{columns} columnas × {rows} filas = {tileCount:N0} tiles";
        ConfirmButton.IsEnabled = columns > 0 && rows > 0 && tileCount <= TilesetDefinition.MaximumTiles;
        if (tileCount > TilesetDefinition.MaximumTiles)
            CountText.Text += $" · máximo F1: {TilesetDefinition.MaximumTiles:N0}";
        if (PreviewImage.Source is BitmapSource source)
        {
            SlicePreview.Visibility = Visibility.Visible;
            SlicePreview.Configure(source, values.TileWidth, values.TileHeight,
                values.MarginX, values.MarginY, values.SpacingX, values.SpacingY);
        }
        ErrorText.Text = "";
    }

    private void Confirm_Click(object sender, RoutedEventArgs e)
    {
        if (!TryValues(out var values)) return;
        try
        {
            var hash = Convert.ToHexString(SHA256.HashData(_pngBytes));
            var definition = TilesetDefinition.Create(_tilesetId, NameBox.Text, $"assets/{_tilesetId:D}.png",
                _imageWidth, _imageHeight, values.TileWidth, values.TileHeight, hash,
                values.MarginX, values.MarginY, values.SpacingX, values.SpacingY);
            Result = new(definition, _pngBytes);
            DialogResult = true;
        }
        catch (ArgumentException error)
        {
            ErrorText.Text = error.Message;
        }
    }

    private bool TryValues(out Values values)
    {
        values = default;
        return int.TryParse(TileWidthBox?.Text, out values.TileWidth)
            && int.TryParse(TileHeightBox?.Text, out values.TileHeight)
            && int.TryParse(MarginXBox?.Text, out values.MarginX)
            && int.TryParse(MarginYBox?.Text, out values.MarginY)
            && int.TryParse(SpacingXBox?.Text, out values.SpacingX)
            && int.TryParse(SpacingYBox?.Text, out values.SpacingY)
            && values.TileWidth is >= 1 and <= 2048 && values.TileHeight is >= 1 and <= 2048
            && values.MarginX is >= 0 and <= 2048 && values.MarginY is >= 0 and <= 2048
            && values.SpacingX is >= 0 and <= 2048 && values.SpacingY is >= 0 and <= 2048;
    }

    private static int Count(int image, int tile, int margin, int spacing)
        => Math.Max(0, (image - 2 * margin + spacing) / (tile + spacing));

    private void Cancel_Click(object sender, RoutedEventArgs e) => DialogResult = false;

    private struct Values
    {
        public int TileWidth;
        public int TileHeight;
        public int MarginX;
        public int MarginY;
        public int SpacingX;
        public int SpacingY;
    }
}
