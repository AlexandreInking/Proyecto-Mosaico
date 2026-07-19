using Mosaico.Core;

var tests = new (string Name, Action Run)[]
{
    ("Floor division supports negative cells", FloorDivisionSupportsNegativeCells),
    ("Sparse map removes empty cells", SparseMapRemovesEmptyCells),
    ("Brush command is exactly reversible", BrushCommandIsExactlyReversible),
    ("Structural hash ignores insertion order", StructuralHashIgnoresInsertionOrder),
};

var failures = 0;
foreach (var test in tests)
{
    try
    {
        test.Run();
        Console.WriteLine($"PASS {test.Name}");
    }
    catch (Exception error)
    {
        failures++;
        Console.Error.WriteLine($"FAIL {test.Name}: {error.Message}");
    }
}

Console.WriteLine($"{tests.Length - failures}/{tests.Length} tests passed");
return failures == 0 ? 0 : 1;

static void FloorDivisionSupportsNegativeCells()
{
    Equal(-1, GridMath.FloorDiv(-1, 16));
    Equal(15, GridMath.FloorMod(-1, 16));
    Equal(-2, GridMath.FloorDiv(-17, 16));
    Equal(15, GridMath.FloorMod(-17, 16));
}

static void SparseMapRemovesEmptyCells()
{
    var document = MapDocument.Create("Test", 32, 18);
    var cell = new GridCoordinate(-1, 2);

    document.SetTile(cell, 3);
    Equal(3, document.GetTile(cell));
    document.SetTile(cell, 0);

    Equal(0, document.GetTile(cell));
    Equal(0, document.OccupiedCellCount);
}

static void BrushCommandIsExactlyReversible()
{
    var document = MapDocument.Create("Test", 32, 18);
    var history = new CommandHistory(document);
    var before = document.StructuralHash();

    history.Execute(new PaintCellsCommand([new(0, 0), new(1, 0), new(-1, 0)], 2));
    var painted = document.StructuralHash();
    NotEqual(before, painted);
    history.Undo();
    Equal(before, document.StructuralHash());
    history.Redo();
    Equal(painted, document.StructuralHash());
}

static void StructuralHashIgnoresInsertionOrder()
{
    var first = MapDocument.Create("Test", 32, 18, Guid.Parse("11111111-1111-1111-1111-111111111111"));
    var second = MapDocument.Create("Test", 32, 18, first.Id);
    first.SetTile(new(2, 1), 4);
    first.SetTile(new(-3, 8), 7);
    second.SetTile(new(-3, 8), 7);
    second.SetTile(new(2, 1), 4);

    Equal(first.StructuralHash(), second.StructuralHash());
}

static void Equal<T>(T expected, T actual)
{
    if (!EqualityComparer<T>.Default.Equals(expected, actual))
    {
        throw new InvalidOperationException($"Expected {expected}; got {actual}");
    }
}

static void NotEqual<T>(T first, T second)
{
    if (EqualityComparer<T>.Default.Equals(first, second))
    {
        throw new InvalidOperationException($"Expected values to differ; both were {first}");
    }
}
