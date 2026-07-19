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
    ("Loader rejects null cell collection", LoaderRejectsNullCellCollection),
    ("Loader rejects empty document identifier", LoaderRejectsEmptyDocumentIdentifier),
    ("Map name length is bounded", MapNameLengthIsBounded),
    ("Versioned fixtures load and reject predictably", VersionedFixturesLoadAndRejectPredictably),
    ("Viewport picking handles negative cells", ViewportPickingHandlesNegativeCells),
    ("Viewport transform round trips screen points", ViewportTransformRoundTripsScreenPoints),
    ("Grid line fills cells between sparse pointer events", GridLineFillsSparsePointerEvents),
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

static void LoaderRejectsNullCellCollection()
{
    var json = """
        {"format":"mosaico-map","formatVersion":0,"id":"33333333-3333-3333-3333-333333333333","name":"Bad","width":32,"height":18,"cells":null}
        """;

    Throws<MapFormatException>(() => MapFileStore.Deserialize(json));
}

static void LoaderRejectsEmptyDocumentIdentifier()
{
    var json = """
        {"format":"mosaico-map","formatVersion":0,"id":"00000000-0000-0000-0000-000000000000","name":"Bad","width":32,"height":18,"cells":[]}
        """;

    Throws<MapFormatException>(() => MapFileStore.Deserialize(json));
}

static void MapNameLengthIsBounded()
{
    Throws<ArgumentException>(() => MapDocument.Create(new string('x', MapDocument.MaximumNameLength + 1), 32, 18));
}

static void VersionedFixturesLoadAndRejectPredictably()
{
    var fixtureDirectory = Path.Combine(AppContext.BaseDirectory, "fixtures", "phase0");
    var sample = MapFileStore.Load(Path.Combine(fixtureDirectory, "sample.mosaic.json"));

    Equal(Guid.Parse("44444444-4444-4444-4444-444444444444"), sample.Id);
    Equal(5, sample.OccupiedCellCount);
    Throws<MapFormatException>(() => MapFileStore.Load(Path.Combine(fixtureDirectory, "invalid-null-cells.mosaic.json")));
}

static void ViewportPickingHandlesNegativeCells()
{
    var transform = new ViewportTransform(800, 600, 32, 1, 0, 0);

    Equal(new GridCoordinate(-1, -1), transform.ScreenToCell(399, 299));
    Equal(new GridCoordinate(0, 0), transform.ScreenToCell(400, 300));
}

static void ViewportTransformRoundTripsScreenPoints()
{
    var transform = new ViewportTransform(1024, 768, 32, 1.75, -96, 160);
    var world = transform.ScreenToWorld(137.5, 612.25);
    var screen = transform.WorldToScreen(world.X, world.Y);

    Near(137.5, screen.X);
    Near(612.25, screen.Y);
}

static void GridLineFillsSparsePointerEvents()
{
    var cells = GridLine.Rasterize(new(0, 0), new(5, 2));

    Equal(new GridCoordinate(0, 0), cells[0]);
    Equal(new GridCoordinate(5, 2), cells[^1]);
    Equal(6, cells.Count);
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

static void Near(double expected, double actual, double tolerance = 0.000001)
{
    if (Math.Abs(expected - actual) > tolerance)
    {
        throw new InvalidOperationException($"Expected {expected}; got {actual}");
    }
}
