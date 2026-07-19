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
