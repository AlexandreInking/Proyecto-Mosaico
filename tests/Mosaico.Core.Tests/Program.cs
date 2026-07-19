using Mosaico.Core;

var tests = new (string Name, Action Run)[]
{
    ("Floor division supports negative cells", FloorDivisionSupportsNegativeCells),
    ("Sparse map removes empty cells", SparseMapRemovesEmptyCells),
    ("Brush command is exactly reversible", BrushCommandIsExactlyReversible),
    ("Structural hash ignores insertion order", StructuralHashIgnoresInsertionOrder),
    ("JSON round trip preserves semantic hash", JsonRoundTripPreservesSemanticHash),
    ("Atomic overwrite keeps previous backup", AtomicOverwriteKeepsPreviousBackup),
    ("Loader rejects hostile dimensions", LoaderRejectsHostileDimensions),
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

static void JsonRoundTripPreservesSemanticHash()
{
    var document = MapDocument.Create("Prueba Ñ", 32, 18, Guid.Parse("22222222-2222-2222-2222-222222222222"));
    document.SetTile(new(-1, 0), 2);
    document.SetTile(new(4, 7), 3);

    var json = MapFileStore.Serialize(document);
    var loaded = MapFileStore.Deserialize(json);

    Equal(document.StructuralHash(), loaded.StructuralHash());
}

static void AtomicOverwriteKeepsPreviousBackup()
{
    var directory = Path.Combine(Path.GetTempPath(), $"mosaico-test-{Guid.NewGuid():N}");
    Directory.CreateDirectory(directory);
    try
    {
        var path = Path.Combine(directory, "map.mosaic.json");
        var document = MapDocument.Create("Test", 32, 18);
        document.SetTile(new(1, 1), 1);
        MapFileStore.SaveAtomic(path, document);
        var firstHash = MapFileStore.Load(path).StructuralHash();

        document.SetTile(new(2, 2), 2);
        MapFileStore.SaveAtomic(path, document);

        Equal(document.StructuralHash(), MapFileStore.Load(path).StructuralHash());
        Equal(firstHash, MapFileStore.Load(path + ".bak").StructuralHash());
    }
    finally
    {
        Directory.Delete(directory, recursive: true);
    }
}

static void LoaderRejectsHostileDimensions()
{
    var json = """
        {"format":"mosaico-map","formatVersion":0,"id":"33333333-3333-3333-3333-333333333333","name":"Bad","width":999999,"height":18,"cells":[]}
        """;

    Throws<MapFormatException>(() => MapFileStore.Deserialize(json));
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

static void Throws<TException>(Action action) where TException : Exception
{
    try
    {
        action();
    }
    catch (TException)
    {
        return;
    }
    throw new InvalidOperationException($"Expected {typeof(TException).Name}");
}
