namespace Mosaico.Core;

public readonly record struct WorldPoint(double X, double Y);
public readonly record struct ScreenPoint(double X, double Y);

public readonly record struct ViewportTransform(
    double ViewportWidth,
    double ViewportHeight,
    double CellWidth,
    double CellHeight,
    double Zoom,
    double CameraWorldX,
    double CameraWorldY)
{
    public ViewportTransform(
        double viewportWidth,
        double viewportHeight,
        double cellSize,
        double zoom,
        double cameraWorldX,
        double cameraWorldY)
        : this(viewportWidth, viewportHeight, cellSize, cellSize, zoom, cameraWorldX, cameraWorldY)
    {
    }

    public WorldPoint ScreenToWorld(double screenX, double screenY) => new(
        (screenX - ViewportWidth / 2) / Zoom + CameraWorldX,
        (screenY - ViewportHeight / 2) / Zoom + CameraWorldY);

    public ScreenPoint WorldToScreen(double worldX, double worldY) => new(
        (worldX - CameraWorldX) * Zoom + ViewportWidth / 2,
        (worldY - CameraWorldY) * Zoom + ViewportHeight / 2);

    public GridCoordinate ScreenToCell(double screenX, double screenY)
    {
        var world = ScreenToWorld(screenX, screenY);
        return new GridCoordinate(
            (int)Math.Floor(world.X / CellWidth),
            (int)Math.Floor(world.Y / CellHeight));
    }
}
