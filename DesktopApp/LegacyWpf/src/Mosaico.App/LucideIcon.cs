using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Xml.Linq;

namespace Mosaico.App;

public sealed class LucideIcon : Control
{
    public static readonly DependencyProperty IconNameProperty = DependencyProperty.Register(
        nameof(IconName),
        typeof(string),
        typeof(LucideIcon),
        new FrameworkPropertyMetadata("", FrameworkPropertyMetadataOptions.AffectsRender));

    public string IconName
    {
        get => (string)GetValue(IconNameProperty);
        set => SetValue(IconNameProperty, value);
    }

    public LucideIcon()
    {
        Focusable = false;
        IsHitTestVisible = false;
        SnapsToDevicePixels = true;
    }

    protected override Size MeasureOverride(Size constraint)
        => new(double.IsInfinity(constraint.Width) ? 18 : Math.Min(18, constraint.Width),
            double.IsInfinity(constraint.Height) ? 18 : Math.Min(18, constraint.Height));

    protected override void OnRender(DrawingContext drawingContext)
    {
        base.OnRender(drawingContext);
        var shapes = LucideIconCatalog.Load(IconName);
        if (shapes.Count == 0 || ActualWidth <= 0 || ActualHeight <= 0) return;
        var scale = Math.Min(ActualWidth / 24d, ActualHeight / 24d);
        var offsetX = (ActualWidth - 24 * scale) / 2;
        var offsetY = (ActualHeight - 24 * scale) / 2;
        drawingContext.PushTransform(new TranslateTransform(offsetX, offsetY));
        drawingContext.PushTransform(new ScaleTransform(scale, scale));
        var pen = new Pen(Foreground, 2)
        {
            StartLineCap = PenLineCap.Round,
            EndLineCap = PenLineCap.Round,
            LineJoin = PenLineJoin.Round,
        };
        foreach (var geometry in shapes) drawingContext.DrawGeometry(null, pen, geometry);
        drawingContext.Pop();
        drawingContext.Pop();
    }
}

public static class LucideIconCatalog
{
    private static readonly Dictionary<string, IReadOnlyList<Geometry>> Cache = new(StringComparer.Ordinal);

    public static int ShapeCount(string iconName) => Load(iconName).Count;

    internal static IReadOnlyList<Geometry> Load(string iconName)
    {
        if (string.IsNullOrWhiteSpace(iconName)
            || iconName.Any(character => !(char.IsAsciiLetterOrDigit(character) || character == '-')))
            return [];
        lock (Cache)
        {
            if (Cache.TryGetValue(iconName, out var cached)) return cached;
            var uri = new Uri($"/Mosaico.App;component/Assets/Icons/{iconName}.svg", UriKind.Relative);
            var resource = Application.GetResourceStream(uri)
                ?? throw new FileNotFoundException($"Embedded Lucide icon was not found: {iconName}");
            using var stream = resource.Stream;
            var document = XDocument.Load(stream, LoadOptions.None);
            var shapes = document.Root?.Elements().Select(ParseShape).Where(shape => shape is not null)
                .Cast<Geometry>().ToArray() ?? [];
            foreach (var shape in shapes) if (shape.CanFreeze) shape.Freeze();
            Cache.Add(iconName, shapes);
            return shapes;
        }
    }

    private static Geometry? ParseShape(XElement element)
    {
        var name = element.Name.LocalName;
        return name switch
        {
            "path" => Geometry.Parse(Required(element, "d")),
            "line" => new LineGeometry(Point(element, "x1", "y1"), Point(element, "x2", "y2")),
            "polyline" => PointsGeometry(Required(element, "points"), close: false),
            "polygon" => PointsGeometry(Required(element, "points"), close: true),
            "rect" => new RectangleGeometry(
                new Rect(Number(element, "x"), Number(element, "y"), Number(element, "width"), Number(element, "height")),
                Number(element, "rx"), Number(element, "ry")),
            "circle" => new EllipseGeometry(Point(element, "cx", "cy"), Number(element, "r"), Number(element, "r")),
            "ellipse" => new EllipseGeometry(Point(element, "cx", "cy"), Number(element, "rx"), Number(element, "ry")),
            _ => null,
        };
    }

    private static Geometry PointsGeometry(string value, bool close)
    {
        var numbers = value.Split([' ', ','], StringSplitOptions.RemoveEmptyEntries).Select(Parse).ToArray();
        if (numbers.Length < 4 || numbers.Length % 2 != 0) throw new FormatException("Invalid Lucide points list.");
        var geometry = new StreamGeometry();
        using (var context = geometry.Open())
        {
            context.BeginFigure(new(numbers[0], numbers[1]), isFilled: false, isClosed: close);
            context.PolyLineTo(Enumerable.Range(1, numbers.Length / 2 - 1)
                .Select(index => new Point(numbers[index * 2], numbers[index * 2 + 1])).ToArray(), isStroked: true, isSmoothJoin: true);
        }
        return geometry;
    }

    private static Point Point(XElement element, string x, string y) => new(Number(element, x), Number(element, y));
    private static double Number(XElement element, string name) => element.Attribute(name) is { } value ? Parse(value.Value) : 0;
    private static string Required(XElement element, string name) => element.Attribute(name)?.Value
        ?? throw new FormatException($"Lucide element is missing {name}.");
    private static double Parse(string value) => double.Parse(value, NumberStyles.Float, CultureInfo.InvariantCulture);
}
