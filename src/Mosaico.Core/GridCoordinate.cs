namespace Mosaico.Core;

public readonly record struct GridCoordinate(int X, int Y);

public static class GridMath
{
    public static int FloorDiv(int value, int divisor)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(divisor);
        var quotient = Math.DivRem(value, divisor, out var remainder);
        return remainder < 0 ? quotient - 1 : quotient;
    }

    public static int FloorMod(int value, int divisor)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(divisor);
        var remainder = value % divisor;
        return remainder < 0 ? remainder + divisor : remainder;
    }
}

public static class GridLine
{
    public static IReadOnlyList<GridCoordinate> Rasterize(GridCoordinate start, GridCoordinate end)
    {
        var cells = new List<GridCoordinate>();
        var x = start.X;
        var y = start.Y;
        var deltaX = Math.Abs(end.X - start.X);
        var stepX = start.X < end.X ? 1 : -1;
        var deltaY = -Math.Abs(end.Y - start.Y);
        var stepY = start.Y < end.Y ? 1 : -1;
        var error = deltaX + deltaY;
        while (true)
        {
            cells.Add(new GridCoordinate(x, y));
            if (x == end.X && y == end.Y) return cells;
            var doubled = 2 * error;
            if (doubled >= deltaY) { error += deltaY; x += stepX; }
            if (doubled <= deltaX) { error += deltaX; y += stepY; }
        }
    }
}
