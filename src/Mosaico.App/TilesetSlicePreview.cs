using System.Globalization;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace Mosaico.App;

public sealed class TilesetSlicePreview : FrameworkElement
{
    private static readonly Brush BackgroundBrush = FrozenBrush(Color.FromRgb(21, 21, 21));
    private static readonly Brush MarginBrush = FrozenBrush(Color.FromArgb(125, 240, 123, 113));
    private static readonly Brush SpacingBrush = FrozenBrush(Color.FromArgb(145, 246, 194, 86));
    private static readonly Brush TextBrush = FrozenBrush(Color.FromRgb(238, 238, 238));
    private static readonly Pen TilePen = FrozenPen(Color.FromRgb(69, 184, 168), 2);
    private static readonly Pen BorderPen = FrozenPen(Color.FromRgb(69, 69, 69), 1);

    private BitmapSource? _source;
    private int _tileWidth;
    private int _tileHeight;
    private int _marginX;
    private int _marginY;
    private int _spacingX;
    private int _spacingY;
    private Int32Rect[] _tileRectangles = [];

    public TilesetSlicePreview()
    {
        SnapsToDevicePixels = true;
        RenderOptions.SetBitmapScalingMode(this, BitmapScalingMode.NearestNeighbor);
    }

    public IReadOnlyList<Int32Rect> TileRectangles => _tileRectangles;
    public Int32Rect SampleSourceRect { get; private set; }

    public void Configure(
        BitmapSource source,
        int tileWidth,
        int tileHeight,
        int marginX,
        int marginY,
        int spacingX,
        int spacingY)
    {
        ArgumentNullException.ThrowIfNull(source);
        if (tileWidth < 1 || tileHeight < 1 || marginX < 0 || marginY < 0 || spacingX < 0 || spacingY < 0)
            throw new ArgumentOutOfRangeException(nameof(tileWidth));

        _source = source;
        _tileWidth = tileWidth;
        _tileHeight = tileHeight;
        _marginX = marginX;
        _marginY = marginY;
        _spacingX = spacingX;
        _spacingY = spacingY;
        _tileRectangles = Enumerable.Range(0, 2)
            .SelectMany(row => Enumerable.Range(0, 2).Select(column => new Int32Rect(
                marginX + column * (tileWidth + spacingX),
                marginY + row * (tileHeight + spacingY),
                tileWidth,
                tileHeight)))
            .Where(rectangle => rectangle.X >= 0 && rectangle.Y >= 0
                && rectangle.X + rectangle.Width <= source.PixelWidth
                && rectangle.Y + rectangle.Height <= source.PixelHeight)
            .ToArray();

        var sampleWidth = Math.Min(source.PixelWidth, marginX + 2 * tileWidth + spacingX + marginX);
        var sampleHeight = Math.Min(source.PixelHeight, marginY + 2 * tileHeight + spacingY + marginY);
        SampleSourceRect = new(0, 0, Math.Max(1, sampleWidth), Math.Max(1, sampleHeight));
        InvalidateVisual();
    }

    protected override void OnRender(DrawingContext drawing)
    {
        base.OnRender(drawing);
        drawing.DrawRectangle(BackgroundBrush, null, new Rect(RenderSize));
        if (_source is null || ActualWidth < 24 || ActualHeight < 48) return;

        const double padding = 14;
        const double labelHeight = 24;
        var availableWidth = Math.Max(1, ActualWidth - 2 * padding);
        var availableHeight = Math.Max(1, ActualHeight - 2 * padding - labelHeight);
        var scale = Math.Min(availableWidth / SampleSourceRect.Width, availableHeight / SampleSourceRect.Height);
        var width = SampleSourceRect.Width * scale;
        var height = SampleSourceRect.Height * scale;
        var left = (ActualWidth - width) / 2;
        var top = padding + (availableHeight - height) / 2;
        var destination = new Rect(left, top, width, height);

        var imageBrush = new ImageBrush(_source)
        {
            Viewbox = new Rect(SampleSourceRect.X, SampleSourceRect.Y, SampleSourceRect.Width, SampleSourceRect.Height),
            ViewboxUnits = BrushMappingMode.Absolute,
            Stretch = Stretch.Fill,
            TileMode = TileMode.None,
        };
        drawing.DrawRectangle(imageBrush, null, destination);

        DrawSourceBand(drawing, new(0, 0, _marginX, SampleSourceRect.Height), destination, MarginBrush);
        DrawSourceBand(drawing, new(0, 0, SampleSourceRect.Width, _marginY), destination, MarginBrush);
        DrawSourceBand(drawing, new(_marginX + _tileWidth, 0, _spacingX, SampleSourceRect.Height), destination, SpacingBrush);
        DrawSourceBand(drawing, new(0, _marginY + _tileHeight, SampleSourceRect.Width, _spacingY), destination, SpacingBrush);

        foreach (var rectangle in _tileRectangles)
        {
            var overlay = ToDestination(rectangle, destination);
            drawing.DrawRectangle(null, TilePen, overlay);
        }
        drawing.DrawRectangle(null, BorderPen, destination);

        var label = $"2×2 · tile {_tileWidth}×{_tileHeight} · margen {_marginX},{_marginY} · espacio {_spacingX},{_spacingY}";
        var text = new FormattedText(label, CultureInfo.CurrentUICulture, FlowDirection.LeftToRight,
            new Typeface("Segoe UI"), 11, TextBrush, VisualTreeHelper.GetDpi(this).PixelsPerDip)
        {
            MaxTextWidth = Math.Max(1, ActualWidth - 2 * padding),
            Trimming = TextTrimming.CharacterEllipsis,
        };
        drawing.DrawText(text, new Point(padding, ActualHeight - labelHeight));
    }

    private void DrawSourceBand(DrawingContext drawing, Int32Rect sourceBand, Rect destination, Brush brush)
    {
        if (sourceBand.Width <= 0 || sourceBand.Height <= 0) return;
        var left = Math.Max(sourceBand.X, SampleSourceRect.X);
        var top = Math.Max(sourceBand.Y, SampleSourceRect.Y);
        var right = Math.Min(sourceBand.X + sourceBand.Width, SampleSourceRect.X + SampleSourceRect.Width);
        var bottom = Math.Min(sourceBand.Y + sourceBand.Height, SampleSourceRect.Y + SampleSourceRect.Height);
        if (right <= left || bottom <= top) return;
        var clipped = new Int32Rect(left, top, right - left, bottom - top);
        drawing.DrawRectangle(brush, null, ToDestination(clipped, destination));
    }

    private Rect ToDestination(Int32Rect sourceRectangle, Rect destination)
    {
        var scaleX = destination.Width / SampleSourceRect.Width;
        var scaleY = destination.Height / SampleSourceRect.Height;
        return new Rect(
            destination.X + (sourceRectangle.X - SampleSourceRect.X) * scaleX,
            destination.Y + (sourceRectangle.Y - SampleSourceRect.Y) * scaleY,
            sourceRectangle.Width * scaleX,
            sourceRectangle.Height * scaleY);
    }

    private static Brush FrozenBrush(Color color)
    {
        var brush = new SolidColorBrush(color);
        brush.Freeze();
        return brush;
    }

    private static Pen FrozenPen(Color color, double thickness)
    {
        var pen = new Pen(FrozenBrush(color), thickness);
        pen.Freeze();
        return pen;
    }
}
