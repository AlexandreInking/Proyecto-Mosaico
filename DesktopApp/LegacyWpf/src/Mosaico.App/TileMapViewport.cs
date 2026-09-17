using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using Mosaico.Core;

namespace Mosaico.App;

public enum TileEditorTool { Select, Paint, Erase, Fill, Picker, Pan, Zoom }

public sealed class TilePaintRequestedEventArgs(Guid layerId, IReadOnlyCollection<GridCoordinate> cells, TileRef? tile) : EventArgs
{
    public Guid LayerId { get; } = layerId;
    public IReadOnlyCollection<GridCoordinate> Cells { get; } = cells;
    public TileRef? Tile { get; } = tile;
}

public sealed class TileCoordinateEventArgs(Guid layerId, GridCoordinate coordinate) : EventArgs
{
    public Guid LayerId { get; } = layerId;
    public GridCoordinate Coordinate { get; } = coordinate;
}

public sealed class TileSelectionEventArgs(GridRectangle selection) : EventArgs
{
    public GridRectangle Selection { get; } = selection;
}

public sealed class TileMapViewport : FrameworkElement
{
    private static readonly Brush OutsideBrush = FrozenBrush(Color.FromRgb(39, 39, 39));
    private static readonly Brush CanvasBrush = FrozenBrush(Color.FromRgb(24, 24, 24));
    private static readonly Brush ErasePreviewBrush = FrozenBrush(Color.FromArgb(110, 226, 85, 73));
    private static readonly Brush MissingTileBrush = FrozenBrush(Color.FromRgb(255, 0, 168));
    private static readonly Brush MissingTileDarkBrush = FrozenBrush(Color.FromRgb(24, 24, 24));
    private static readonly Pen MissingTilePen = FrozenPen(Color.FromRgb(255, 255, 255), 2);
    private static readonly Pen BoundaryPen = FrozenPen(Color.FromRgb(74, 153, 142), 1.5);
    private static readonly Pen GridPen = FrozenPen(Color.FromArgb(115, 88, 88, 88), 1);
    private static readonly Pen HoverPen = FrozenPen(Color.FromRgb(240, 240, 240), 1.5);
    private static readonly Pen SelectionPen = FrozenDashedPen(Color.FromRgb(92, 196, 182));

    private readonly HashSet<GridCoordinate> _stroke = [];
    private MapProject? _project;
    private TileBitmapStore? _bitmaps;
    private GridCoordinate _hover;
    private GridCoordinate? _lastStrokeCell;
    private GridCoordinate? _selectionStart;
    private GridRectangle? _selection;
    private Point _panStart;
    private double _cameraStartX;
    private double _cameraStartY;
    private double _cameraX;
    private double _cameraY;
    private bool _drawing;
    private bool _panning;

    public TileMapViewport()
    {
        ClipToBounds = true;
        Focusable = true;
        SnapsToDevicePixels = true;
        Cursor = Cursors.Cross;
        RenderOptions.SetBitmapScalingMode(this, BitmapScalingMode.NearestNeighbor);
    }

    public event EventHandler<TilePaintRequestedEventArgs>? PaintRequested;
    public event EventHandler<TileCoordinateEventArgs>? FillRequested;
    public event EventHandler<TileCoordinateEventArgs>? PickRequested;
    public event EventHandler<TileSelectionEventArgs>? SelectionChanged;
    public event EventHandler<GridCoordinate>? HoverChanged;
    public event EventHandler<double>? ZoomChanged;

    public TileEditorTool Tool { get; set; } = TileEditorTool.Paint;
    public TileRef? SelectedTile { get; set; }
    public double Zoom { get; private set; } = 1;
    public GridRectangle? Selection => _selection;

    public MapProject? Project
    {
        get => _project;
        set
        {
            _project = value;
            _selection = null;
            InvalidateVisual();
        }
    }

    public TileBitmapStore? Bitmaps
    {
        get => _bitmaps;
        set { _bitmaps = value; InvalidateVisual(); }
    }

    private double CellWidth => _project?.CellWidth ?? 16;
    private double CellHeight => _project?.CellHeight ?? 16;
    private ViewportTransform Transform => new(ActualWidth, ActualHeight, CellWidth, CellHeight, Zoom, _cameraX, _cameraY);

    public void FitDocument()
    {
        if (_project is null || ActualWidth <= 0 || ActualHeight <= 0) return;
        _cameraX = _project.Width * CellWidth / 2;
        _cameraY = _project.Height * CellHeight / 2;
        var horizontal = Math.Max(0.25, (ActualWidth - 64) / (_project.Width * CellWidth));
        var vertical = Math.Max(0.25, (ActualHeight - 64) / (_project.Height * CellHeight));
        Zoom = Math.Clamp(Math.Min(horizontal, vertical), 0.25, 8);
        ZoomChanged?.Invoke(this, Zoom);
        InvalidateVisual();
    }

    public void ClearSelection()
    {
        _selection = null;
        _selectionStart = null;
        InvalidateVisual();
    }

    protected override void OnRender(DrawingContext drawing)
    {
        base.OnRender(drawing);
        drawing.DrawRectangle(OutsideBrush, null, new Rect(RenderSize));
        if (_project is null || ActualWidth <= 0 || ActualHeight <= 0) return;

        var mapBounds = GetMapScreenBounds();
        DrawCanvas(drawing, mapBounds);
        drawing.PushClip(new RectangleGeometry(mapBounds));
        DrawTiles(drawing);
        DrawGrid(drawing);
        DrawPreview(drawing);
        DrawSelection(drawing);
        if (IsInside(_hover)) DrawCellOutline(drawing, _hover, HoverPen);
        drawing.Pop();
        drawing.DrawRectangle(null, BoundaryPen, mapBounds);
        if (IsKeyboardFocusWithin)
            drawing.DrawRectangle(null, FrozenPen(Color.FromRgb(92, 196, 182), 1),
                new Rect(1, 1, Math.Max(0, ActualWidth - 2), Math.Max(0, ActualHeight - 2)));
    }

    private Rect GetMapScreenBounds()
    {
        var origin = Transform.WorldToScreen(0, 0);
        var end = Transform.WorldToScreen(_project!.Width * CellWidth, _project.Height * CellHeight);
        return new Rect(new Point(origin.X, origin.Y), new Point(end.X, end.Y));
    }

    private static void DrawCanvas(DrawingContext drawing, Rect mapBounds)
        => drawing.DrawRectangle(CanvasBrush, null, mapBounds);

    private void DrawTiles(DrawingContext drawing)
    {
        if (_bitmaps is null) return;
        var tilesets = _project!.Tilesets.ToDictionary(item => item.Id);
        var extraColumns = tilesets.Count == 0 ? 0 : Math.Max(0,
            (int)Math.Ceiling(tilesets.Values.Max(item => item.TileWidth) / CellWidth) - 1);
        var extraRows = tilesets.Count == 0 ? 0 : Math.Max(0,
            (int)Math.Ceiling(tilesets.Values.Max(item => item.TileHeight) / CellHeight) - 1);
        if (GetVisibleCellBounds(extraColumns, extraRows) is not { } visibleBounds) return;
        var viewportBounds = new Rect(RenderSize);
        foreach (var layer in _project.Layers)
        {
            if (!layer.IsVisible) continue;
            foreach (var cell in layer.EnumerateCells(visibleBounds))
            {
                if (!tilesets.TryGetValue(cell.Tile.TilesetId, out var tileset))
                {
                    DrawMissingTile(drawing, cell.Coordinate);
                    continue;
                }
                var worldX = cell.Coordinate.X * CellWidth;
                var worldY = cell.Coordinate.Y * CellHeight + CellHeight - tileset.TileHeight;
                var screen = Transform.WorldToScreen(worldX, worldY);
                var destination = new Rect(screen.X, screen.Y, tileset.TileWidth * Zoom, tileset.TileHeight * Zoom);
                if (!destination.IntersectsWith(viewportBounds)) continue;
                drawing.DrawImage(_bitmaps.GetTile(tileset.Id, cell.Tile.TileId), destination);
            }
        }
    }

    private void DrawMissingTile(DrawingContext drawing, GridCoordinate coordinate)
    {
        var topLeft = Transform.WorldToScreen(coordinate.X * CellWidth, coordinate.Y * CellHeight);
        var width = CellWidth * Zoom;
        var height = CellHeight * Zoom;
        var destination = new Rect(topLeft.X, topLeft.Y, width, height);
        drawing.DrawRectangle(MissingTileBrush, null, destination);
        drawing.DrawRectangle(MissingTileDarkBrush, null, new Rect(topLeft.X, topLeft.Y, width / 2, height / 2));
        drawing.DrawRectangle(MissingTileDarkBrush, null, new Rect(topLeft.X + width / 2, topLeft.Y + height / 2, width / 2, height / 2));
        drawing.DrawLine(MissingTilePen, destination.TopLeft, destination.BottomRight);
        drawing.DrawLine(MissingTilePen, destination.TopRight, destination.BottomLeft);
    }

    private void DrawGrid(DrawingContext drawing)
    {
        if (CellWidth * Zoom < 5 || CellHeight * Zoom < 5) return;
        if (GetVisibleCellBounds() is not { } visibleBounds) return;
        for (var x = visibleBounds.Left; x <= visibleBounds.Right + 1; x++)
        {
            var top = Transform.WorldToScreen(x * CellWidth, 0);
            var bottom = Transform.WorldToScreen(x * CellWidth, _project!.Height * CellHeight);
            drawing.DrawLine(GridPen, new(top.X, top.Y), new(bottom.X, bottom.Y));
        }
        for (var y = visibleBounds.Top; y <= visibleBounds.Bottom + 1; y++)
        {
            var left = Transform.WorldToScreen(0, y * CellHeight);
            var right = Transform.WorldToScreen(_project!.Width * CellWidth, y * CellHeight);
            drawing.DrawLine(GridPen, new(left.X, left.Y), new(right.X, right.Y));
        }
    }

    private GridRectangle? GetVisibleCellBounds(int extraColumns = 0, int extraRows = 0)
    {
        var topLeft = Transform.ScreenToWorld(0, 0);
        var bottomRight = Transform.ScreenToWorld(ActualWidth, ActualHeight);
        var mapWidth = _project!.Width * CellWidth;
        var mapHeight = _project.Height * CellHeight;
        if (bottomRight.X <= 0 || bottomRight.Y <= 0 || topLeft.X >= mapWidth || topLeft.Y >= mapHeight)
            return null;

        var firstVisibleColumn = (int)Math.Floor(Math.Max(0, topLeft.X) / CellWidth);
        var firstVisibleRow = (int)Math.Floor(Math.Max(0, topLeft.Y) / CellHeight);
        var lastVisibleColumn = (int)Math.Ceiling(Math.Min(mapWidth, bottomRight.X) / CellWidth) - 1;
        var lastVisibleRow = (int)Math.Ceiling(Math.Min(mapHeight, bottomRight.Y) / CellHeight) - 1;
        var left = Math.Clamp(firstVisibleColumn - extraColumns, 0, _project.Width - 1);
        var top = Math.Clamp(firstVisibleRow - extraRows, 0, _project.Height - 1);
        var right = Math.Clamp(lastVisibleColumn + extraColumns, 0, _project.Width - 1);
        var bottom = Math.Clamp(lastVisibleRow + extraRows, 0, _project.Height - 1);
        return new GridRectangle(left, top, right, bottom);
    }

    private void DrawPreview(DrawingContext drawing)
    {
        foreach (var cell in _stroke)
        {
            if (Tool == TileEditorTool.Erase) DrawCellFill(drawing, cell, ErasePreviewBrush);
            else DrawTilePreview(drawing, cell);
        }
        if (!_drawing && IsInside(_hover))
        {
            if (Tool == TileEditorTool.Paint) DrawTilePreview(drawing, _hover);
            else if (Tool == TileEditorTool.Erase) DrawCellFill(drawing, _hover, ErasePreviewBrush);
        }
    }

    private void DrawTilePreview(DrawingContext drawing, GridCoordinate cell)
    {
        if (SelectedTile is not { } selected || _bitmaps is null || _project is null) return;
        var tileset = _project.Tilesets.SingleOrDefault(item => item.Id == selected.TilesetId);
        if (tileset is null) return;
        var topLeft = Transform.WorldToScreen(cell.X * CellWidth,
            cell.Y * CellHeight + CellHeight - tileset.TileHeight);
        drawing.PushOpacity(0.62);
        drawing.DrawImage(_bitmaps.GetTile(selected.TilesetId, selected.TileId),
            new Rect(topLeft.X, topLeft.Y, tileset.TileWidth * Zoom, tileset.TileHeight * Zoom));
        drawing.Pop();
    }

    private void DrawSelection(DrawingContext drawing)
    {
        if (_selection is not { } selection) return;
        var topLeft = Transform.WorldToScreen(selection.Left * CellWidth, selection.Top * CellHeight);
        var bottomRight = Transform.WorldToScreen((selection.Right + 1) * CellWidth, (selection.Bottom + 1) * CellHeight);
        drawing.DrawRectangle(null, SelectionPen, new Rect(new Point(topLeft.X, topLeft.Y), new Point(bottomRight.X, bottomRight.Y)));
    }

    private void DrawCellFill(DrawingContext drawing, GridCoordinate cell, Brush brush)
    {
        var topLeft = Transform.WorldToScreen(cell.X * CellWidth, cell.Y * CellHeight);
        drawing.DrawRectangle(brush, null, new Rect(topLeft.X, topLeft.Y, CellWidth * Zoom, CellHeight * Zoom));
    }

    private void DrawCellOutline(DrawingContext drawing, GridCoordinate cell, Pen pen)
    {
        var topLeft = Transform.WorldToScreen(cell.X * CellWidth, cell.Y * CellHeight);
        drawing.DrawRectangle(null, pen, new Rect(topLeft.X, topLeft.Y, CellWidth * Zoom, CellHeight * Zoom));
    }

    protected override void OnMouseLeftButtonDown(MouseButtonEventArgs e)
    {
        base.OnMouseLeftButtonDown(e);
        Focus();
        var point = e.GetPosition(this);
        var cell = Transform.ScreenToCell(point.X, point.Y);
        if (Keyboard.IsKeyDown(Key.Space) || Tool == TileEditorTool.Pan) BeginPan(point);
        else if (Tool is TileEditorTool.Paint or TileEditorTool.Erase) BeginStroke(point);
        else if (Tool == TileEditorTool.Select && IsInside(cell))
        {
            _selectionStart = cell;
            _selection = new(cell.X, cell.Y, cell.X, cell.Y);
            CaptureMouse();
        }
        else if (Tool == TileEditorTool.Fill && IsInside(cell)) FillRequested?.Invoke(this, new(_project!.ActiveLayerId, cell));
        else if (Tool == TileEditorTool.Picker && IsInside(cell)) PickRequested?.Invoke(this, new(_project!.ActiveLayerId, cell));
        else if (Tool == TileEditorTool.Zoom) ZoomAt(point, 1.25);
        e.Handled = true;
    }

    protected override void OnMouseLeftButtonUp(MouseButtonEventArgs e)
    {
        base.OnMouseLeftButtonUp(e);
        if (_panning) EndPan();
        if (_drawing) EndStroke();
        if (_selectionStart is not null)
        {
            _selectionStart = null;
            ReleaseMouseCapture();
            if (_selection is { } selection) SelectionChanged?.Invoke(this, new(selection));
        }
        e.Handled = true;
    }

    protected override void OnMouseMove(MouseEventArgs e)
    {
        base.OnMouseMove(e);
        var point = e.GetPosition(this);
        var cell = Transform.ScreenToCell(point.X, point.Y);
        if (cell != _hover) { _hover = cell; HoverChanged?.Invoke(this, cell); }
        if (_panning)
        {
            _cameraX = _cameraStartX - (point.X - _panStart.X) / Zoom;
            _cameraY = _cameraStartY - (point.Y - _panStart.Y) / Zoom;
        }
        else if (_drawing) AddStroke(point);
        else if (_selectionStart is { } start && IsInside(cell)) _selection = new(start.X, start.Y, cell.X, cell.Y);
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
        ZoomAt(e.GetPosition(this), e.Delta > 0 ? 1.15 : 1 / 1.15);
        e.Handled = true;
    }

    private void BeginStroke(Point point)
    {
        if (_project is null || Tool == TileEditorTool.Paint && SelectedTile is null) return;
        _drawing = true;
        _stroke.Clear();
        _lastStrokeCell = null;
        AddStroke(point);
        CaptureMouse();
    }

    private void EndStroke()
    {
        _drawing = false;
        ReleaseMouseCapture();
        if (_stroke.Count > 0)
            PaintRequested?.Invoke(this, new(_project!.ActiveLayerId, _stroke.ToArray(),
                Tool == TileEditorTool.Paint ? SelectedTile : null));
        _stroke.Clear();
        _lastStrokeCell = null;
        InvalidateVisual();
    }

    private void AddStroke(Point point)
    {
        var cell = Transform.ScreenToCell(point.X, point.Y);
        if (_lastStrokeCell is { } previous)
            foreach (var item in GridLine.Rasterize(previous, cell).Where(IsInside)) _stroke.Add(item);
        else if (IsInside(cell)) _stroke.Add(cell);
        _lastStrokeCell = cell;
    }

    private bool IsInside(GridCoordinate cell)
        => _project is not null && cell.X >= 0 && cell.X < _project.Width && cell.Y >= 0 && cell.Y < _project.Height;

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

    private void ZoomAt(Point point, double factor)
    {
        var world = Transform.ScreenToWorld(point.X, point.Y);
        Zoom = Math.Clamp(Zoom * factor, 0.25, 8);
        _cameraX = world.X - (point.X - ActualWidth / 2) / Zoom;
        _cameraY = world.Y - (point.Y - ActualHeight / 2) / Zoom;
        ZoomChanged?.Invoke(this, Zoom);
        InvalidateVisual();
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

    private static Pen FrozenDashedPen(Color color)
    {
        var pen = new Pen(FrozenBrush(color), 1.5) { DashStyle = new DashStyle([4, 3], 0) };
        pen.Freeze();
        return pen;
    }
}
