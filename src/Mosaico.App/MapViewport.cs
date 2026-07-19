using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using Mosaico.Core;

namespace Mosaico.App;

public enum EditorTool { Paint, Erase }

public sealed class StrokeCommittedEventArgs(IReadOnlyCollection<GridCoordinate> cells, int tileId) : EventArgs
{
    public IReadOnlyCollection<GridCoordinate> Cells { get; } = cells;
    public int TileId { get; } = tileId;
}

public sealed class MapViewport : FrameworkElement
{
    private const double CellSize = 32;
    private static readonly Brush PaintPreviewBrush = FrozenBrush(Color.FromArgb(120, 79, 175, 159));
    private static readonly Brush ErasePreviewBrush = FrozenBrush(Color.FromArgb(120, 210, 90, 90));
    private static readonly Brush TileOneBrush = FrozenBrush(Color.FromRgb(49, 137, 125));
    private static readonly Brush TileTwoBrush = FrozenBrush(Color.FromRgb(201, 132, 69));
    private static readonly Brush TileThreeBrush = FrozenBrush(Color.FromRgb(87, 119, 173));
    private static readonly Brush TileFallbackBrush = FrozenBrush(Color.FromRgb(135, 106, 166));
    private readonly HashSet<GridCoordinate> _stroke = [];
    private MapDocument? _document;
    private GridCoordinate _hover;
    private GridCoordinate? _lastStrokeCell;
    private Point _panStart;
    private double _cameraStartX;
    private double _cameraStartY;
    private double _cameraX;
    private double _cameraY;
    private bool _drawing;
    private bool _panning;

    public MapViewport()
    {
        ClipToBounds = true;
        Focusable = true;
        Cursor = Cursors.Cross;
        SnapsToDevicePixels = true;
    }

    public event EventHandler<StrokeCommittedEventArgs>? StrokeCommitted;
    public event EventHandler<GridCoordinate>? HoverChanged;
    public event EventHandler<double>? ZoomChanged;

    public EditorTool Tool { get; set; } = EditorTool.Paint;
    public double Zoom { get; private set; } = 1;

    public MapDocument? Document
    {
        get => _document;
        set { _document = value; InvalidateVisual(); }
    }

    private ViewportTransform Transform => new(ActualWidth, ActualHeight, CellSize, Zoom, _cameraX, _cameraY);

    protected override void OnRender(DrawingContext drawing)
    {
        base.OnRender(drawing);
        drawing.DrawRectangle(new SolidColorBrush(Color.FromRgb(17, 22, 26)), null, new Rect(RenderSize));
        if (ActualWidth <= 0 || ActualHeight <= 0) return;

        DrawGrid(drawing);
        if (_document is not null)
        {
            var topLeft = Transform.ScreenToCell(0, 0);
            var bottomRight = Transform.ScreenToCell(ActualWidth, ActualHeight);
            foreach (var cell in _document.EnumerateCells())
            {
                if (cell.Coordinate.X >= topLeft.X - 1 && cell.Coordinate.X <= bottomRight.X + 1 &&
                    cell.Coordinate.Y >= topLeft.Y - 1 && cell.Coordinate.Y <= bottomRight.Y + 1)
                {
                    DrawCell(drawing, cell.Coordinate, TileBrush(cell.TileId));
                }
            }
            var origin = Transform.WorldToScreen(0, 0);
            var end = Transform.WorldToScreen(_document.Width * CellSize, _document.Height * CellSize);
            drawing.DrawRectangle(null, new Pen(new SolidColorBrush(Color.FromRgb(79, 175, 159)), 2), new Rect(new Point(origin.X, origin.Y), new Point(end.X, end.Y)));
        }
        foreach (var cell in _stroke)
        {
            DrawCell(drawing, cell, Tool == EditorTool.Paint ? PaintPreviewBrush : ErasePreviewBrush);
        }
        DrawOutline(drawing, _hover, new Pen(Brushes.White, 2));
        if (IsKeyboardFocusWithin)
        {
            drawing.DrawRectangle(null, new Pen(new SolidColorBrush(Color.FromRgb(116, 214, 198)), 2), new Rect(1, 1, Math.Max(0, ActualWidth - 2), Math.Max(0, ActualHeight - 2)));
        }
    }

    private void DrawGrid(DrawingContext drawing)
    {
        var topLeft = Transform.ScreenToWorld(0, 0);
        var bottomRight = Transform.ScreenToWorld(ActualWidth, ActualHeight);
        var firstX = (int)Math.Floor(topLeft.X / CellSize) - 1;
        var lastX = (int)Math.Ceiling(bottomRight.X / CellSize) + 1;
        var firstY = (int)Math.Floor(topLeft.Y / CellSize) - 1;
        var lastY = (int)Math.Ceiling(bottomRight.Y / CellSize) + 1;
        var gridPen = new Pen(new SolidColorBrush(Color.FromRgb(42, 51, 59)), 1);
        var axisPen = new Pen(new SolidColorBrush(Color.FromRgb(88, 104, 116)), 1.5);
        for (var x = firstX; x <= lastX; x++)
        {
            var screen = Transform.WorldToScreen(x * CellSize, 0).X;
            drawing.DrawLine(x == 0 ? axisPen : gridPen, new Point(screen, 0), new Point(screen, ActualHeight));
        }
        for (var y = firstY; y <= lastY; y++)
        {
            var screen = Transform.WorldToScreen(0, y * CellSize).Y;
            drawing.DrawLine(y == 0 ? axisPen : gridPen, new Point(0, screen), new Point(ActualWidth, screen));
        }
    }

    private void DrawCell(DrawingContext drawing, GridCoordinate cell, Brush brush)
    {
        var topLeft = Transform.WorldToScreen(cell.X * CellSize, cell.Y * CellSize);
        var size = CellSize * Zoom;
        var rect = new Rect(topLeft.X + 1, topLeft.Y + 1, Math.Max(0, size - 2), Math.Max(0, size - 2));
        if (rect.Right < 0 || rect.Bottom < 0 || rect.Left > ActualWidth || rect.Top > ActualHeight) return;
        drawing.DrawRectangle(brush, null, rect);
    }

    private void DrawOutline(DrawingContext drawing, GridCoordinate cell, Pen pen)
    {
        var topLeft = Transform.WorldToScreen(cell.X * CellSize, cell.Y * CellSize);
        var size = CellSize * Zoom;
        drawing.DrawRectangle(null, pen, new Rect(topLeft.X + 1, topLeft.Y + 1, Math.Max(0, size - 2), Math.Max(0, size - 2)));
    }

    private static Brush TileBrush(int tileId) => tileId switch
    {
        1 => TileOneBrush,
        2 => TileTwoBrush,
        3 => TileThreeBrush,
        _ => TileFallbackBrush,
    };

    private static Brush FrozenBrush(Color color)
    {
        var brush = new SolidColorBrush(color);
        brush.Freeze();
        return brush;
    }

    public void FitDocument()
    {
        if (_document is null || ActualWidth <= 0 || ActualHeight <= 0) return;
        _cameraX = _document.Width * CellSize / 2;
        _cameraY = _document.Height * CellSize / 2;
        var horizontal = Math.Max(0.25, (ActualWidth - 64) / (_document.Width * CellSize));
        var vertical = Math.Max(0.25, (ActualHeight - 64) / (_document.Height * CellSize));
        Zoom = Math.Clamp(Math.Min(horizontal, vertical), 0.25, 4);
        ZoomChanged?.Invoke(this, Zoom);
        InvalidateVisual();
    }

    protected override void OnGotKeyboardFocus(KeyboardFocusChangedEventArgs e)
    {
        base.OnGotKeyboardFocus(e);
        InvalidateVisual();
    }

    protected override void OnLostKeyboardFocus(KeyboardFocusChangedEventArgs e)
    {
        base.OnLostKeyboardFocus(e);
        InvalidateVisual();
    }

    protected override void OnMouseLeftButtonDown(MouseButtonEventArgs e)
    {
        Focus();
        var point = e.GetPosition(this);
        if (Keyboard.IsKeyDown(Key.Space)) BeginPan(point);
        else { _drawing = true; _stroke.Clear(); _lastStrokeCell = null; AddStroke(point); CaptureMouse(); }
        e.Handled = true;
    }

    protected override void OnMouseLeftButtonUp(MouseButtonEventArgs e)
    {
        if (_panning) EndPan();
        if (_drawing)
        {
            _drawing = false;
            ReleaseMouseCapture();
            if (_stroke.Count > 0) StrokeCommitted?.Invoke(this, new StrokeCommittedEventArgs(_stroke.ToArray(), Tool == EditorTool.Paint ? 1 : 0));
            _stroke.Clear();
            _lastStrokeCell = null;
            InvalidateVisual();
        }
        e.Handled = true;
    }

    protected override void OnMouseMove(MouseEventArgs e)
    {
        var point = e.GetPosition(this);
        var hover = Transform.ScreenToCell(point.X, point.Y);
        if (hover != _hover) { _hover = hover; HoverChanged?.Invoke(this, hover); }
        if (_panning)
        {
            _cameraX = _cameraStartX - (point.X - _panStart.X) / Zoom;
            _cameraY = _cameraStartY - (point.Y - _panStart.Y) / Zoom;
        }
        else if (_drawing) AddStroke(point);
        InvalidateVisual();
    }

    protected override void OnMouseDown(MouseButtonEventArgs e)
    {
        base.OnMouseDown(e);
        if (e.ChangedButton == MouseButton.Middle) { Focus(); BeginPan(e.GetPosition(this)); e.Handled = true; }
    }

    protected override void OnMouseUp(MouseButtonEventArgs e)
    {
        base.OnMouseUp(e);
        if (e.ChangedButton == MouseButton.Middle) { EndPan(); e.Handled = true; }
    }

    protected override void OnMouseWheel(MouseWheelEventArgs e)
    {
        var point = e.GetPosition(this);
        var world = Transform.ScreenToWorld(point.X, point.Y);
        Zoom = Math.Clamp(Zoom * (e.Delta > 0 ? 1.15 : 1 / 1.15), 0.25, 4);
        _cameraX = world.X - (point.X - ActualWidth / 2) / Zoom;
        _cameraY = world.Y - (point.Y - ActualHeight / 2) / Zoom;
        ZoomChanged?.Invoke(this, Zoom);
        InvalidateVisual();
        e.Handled = true;
    }

    private void AddStroke(Point point)
    {
        var cell = Transform.ScreenToCell(point.X, point.Y);
        if (_lastStrokeCell is { } previous)
        {
            foreach (var intermediate in GridLine.Rasterize(previous, cell)) _stroke.Add(intermediate);
        }
        else
        {
            _stroke.Add(cell);
        }
        _lastStrokeCell = cell;
        InvalidateVisual();
    }

    private void BeginPan(Point point)
    {
        _panning = true;
        _panStart = point;
        _cameraStartX = _cameraX;
        _cameraStartY = _cameraY;
        Cursor = Cursors.Hand;
        CaptureMouse();
    }

    private void EndPan()
    {
        _panning = false;
        Cursor = Cursors.Cross;
        ReleaseMouseCapture();
    }
}
