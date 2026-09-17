using Mosaico.Core;
using System.Text;
using System.Text.Json.Nodes;

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
    ("Viewport picking supports rectangular cells", ViewportPickingSupportsRectangularCells),
    ("Grid line fills cells between sparse pointer events", GridLineFillsSparsePointerEvents),
    ("Tileset slicing assigns row major identifiers", TilesetSlicingAssignsRowMajorIdentifiers),
    ("Tileset budgets reject decoded bombs and excessive tile counts", TilesetBudgetsRejectBombsAndExcessiveTileCounts),
    ("Tile project stores stable references across ordered layers", TileProjectStoresStableReferencesAcrossOrderedLayers),
    ("Locked tile layer rejects mutations", LockedTileLayerRejectsMutations),
    ("Tile project hash ignores cell insertion order", TileProjectHashIgnoresCellInsertionOrder),
    ("Tile layer enumerates only cells inside visible bounds", TileLayerEnumeratesOnlyCellsInsideVisibleBounds),
    ("Tile editing commands undo and redo exact deltas", TileEditingCommandsUndoAndRedoExactDeltas),
    ("Tile editing rejects invalid batches atomically", TileEditingRejectsInvalidBatchesAtomically),
    ("Tile editing preflights the global occupied cell budget", TileEditingPreflightsGlobalBudget),
    ("Cell size change is reversible and preserves placed tiles", CellSizeChangeIsReversibleAndPreservesPlacedTiles),
    ("Layer commands are fully reversible", LayerCommandsAreFullyReversible),
    ("Layer deletion is reversible with content and order", LayerDeletionIsReversibleWithContentAndOrder),
    ("Tileset deletion preserves and groups orphan references", TilesetDeletionPreservesAndGroupsOrphanReferences),
    ("Orphan references survive save and block export", OrphanReferencesSurviveSaveAndBlockExport),
    ("Active layer changes are reversible", ActiveLayerChangesAreReversible),
    ("Project ZIP round trip preserves assets and layers", ProjectZipRoundTripPreservesAssetsAndLayers),
    ("Project ZIP rejects traversal entries", ProjectZipRejectsTraversalEntries),
    ("Project ZIP rejects null collection elements", ProjectZipRejectsNullCollectionElements),
    ("Export rejects aggregate assets above archive limit", ExportRejectsAggregateAssetsAboveArchiveLimit),
    ("Retained asset budget blocks repeated import deletion abuse", RetainedAssetBudgetBlocksRepeatedImportDeletionAbuse),
    ("Mosaic pack export is deterministic and contains no code", MosaicPackExportIsDeterministicAndContainsNoCode),
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

static void ViewportPickingSupportsRectangularCells()
{
    var transform = new ViewportTransform(800, 600, 16, 8, 1, 0, 0);
    Equal(new GridCoordinate(1, 1), transform.ScreenToCell(417, 309));
    Equal(new GridCoordinate(-1, -1), transform.ScreenToCell(399, 299));
}

static void GridLineFillsSparsePointerEvents()
{
    var cells = GridLine.Rasterize(new(0, 0), new(5, 2));

    Equal(new GridCoordinate(0, 0), cells[0]);
    Equal(new GridCoordinate(5, 2), cells[^1]);
    Equal(6, cells.Count);
}

static void TilesetSlicingAssignsRowMajorIdentifiers()
{
    var tileset = TilesetDefinition.Create(
        Guid.Parse("10000000-0000-0000-0000-000000000001"),
        "Dungeon 8px",
        "assets/10000000-0000-0000-0000-000000000001.png",
        imageWidth: 38,
        imageHeight: 20,
        tileWidth: 8,
        tileHeight: 8,
        marginX: 1,
        marginY: 1,
        spacingX: 1,
        spacingY: 1,
        sha256: new string('A', 64));

    Equal(4, tileset.Columns);
    Equal(2, tileset.Rows);
    Equal(8, tileset.TileCount);
    Equal(new TileSourceRect(19, 10, 8, 8), tileset.GetSourceRect(6));
    Throws<ArgumentOutOfRangeException>(() => tileset.GetSourceRect(8));
}

static void TilesetBudgetsRejectBombsAndExcessiveTileCounts()
{
    var id = Guid.NewGuid();
    Throws<ArgumentOutOfRangeException>(() => TilesetDefinition.Create(
        id, "Decoded bomb", $"assets/{id:D}.png", 4097, 4097, 2048, 2048, new string('A', 64)));

    id = Guid.NewGuid();
    Throws<ArgumentException>(() => TilesetDefinition.Create(
        id, "Too many tiles", $"assets/{id:D}.png", TilesetDefinition.MaximumTiles + 1, 1, 1, 1, new string('A', 64)));

    id = Guid.NewGuid();
    Equal(1, TilesetDefinition.Create(
        id, "Large tile", $"assets/{id:D}.png", 2048, 2048, 2048, 2048, new string('A', 64)).TileCount);
}

static void TileProjectStoresStableReferencesAcrossOrderedLayers()
{
    var project = CreateTileProject();
    var ground = project.Layers[0];
    var details = project.AddLayer("Detalles", Guid.Parse("20000000-0000-0000-0000-000000000002"));
    var tile = new TileRef(project.Tilesets[0].Id, 3);

    project.SetTile(details.Id, new GridCoordinate(4, 7), tile);
    project.MoveLayer(details.Id, 0);
    project.SetLayerVisibility(ground.Id, false);

    Equal(details.Id, project.Layers[0].Id);
    Equal(tile, project.GetTile(details.Id, new GridCoordinate(4, 7)));
    Equal(false, project.Layers[1].IsVisible);
}

static void LockedTileLayerRejectsMutations()
{
    var project = CreateTileProject();
    var layer = project.Layers[0];
    project.SetLayerLocked(layer.Id, true);

    Throws<InvalidOperationException>(() => project.SetTile(
        layer.Id,
        new GridCoordinate(0, 0),
        new TileRef(project.Tilesets[0].Id, 0)));
}

static void TileProjectHashIgnoresCellInsertionOrder()
{
    var id = Guid.Parse("30000000-0000-0000-0000-000000000001");
    var first = CreateTileProject(id);
    var second = CreateTileProject(id);
    var layerId = first.Layers[0].Id;
    var tile = new TileRef(first.Tilesets[0].Id, 1);

    first.SetTile(layerId, new GridCoordinate(5, 2), tile);
    first.SetTile(layerId, new GridCoordinate(1, 8), tile);
    second.SetTile(layerId, new GridCoordinate(1, 8), tile);
    second.SetTile(layerId, new GridCoordinate(5, 2), tile);

    Equal(first.StructuralHash(), second.StructuralHash());
}

static void TileLayerEnumeratesOnlyCellsInsideVisibleBounds()
{
    var project = MapProject.Create("Visible query", 64, 64, 8, 8);
    project.AddTileset(TilesetDefinition.Create(
        Guid.Parse("10000000-0000-0000-0000-000000000002"),
        "Atlas",
        "assets/10000000-0000-0000-0000-000000000002.png",
        16,
        16,
        8,
        8,
        new string('C', 64)));
    var layer = project.Layers[0];
    var tile = new TileRef(project.Tilesets[0].Id, 1);
    project.SetTile(layer.Id, new(0, 0), tile);
    project.SetTile(layer.Id, new(31, 31), tile);
    project.SetTile(layer.Id, new(32, 32), tile);
    project.SetTile(layer.Id, new(63, 63), tile);

    var visible = layer.EnumerateCells(new GridRectangle(30, 30, 33, 33)).ToArray();

    Equal(2, visible.Length);
    Equal(true, visible.Any(cell => cell.Coordinate == new GridCoordinate(31, 31)));
    Equal(true, visible.Any(cell => cell.Coordinate == new GridCoordinate(32, 32)));
}

static MapProject CreateTileProject(Guid? id = null)
{
    var project = MapProject.Create(
        "Mapa F1",
        width: 32,
        height: 18,
        cellWidth: 8,
        cellHeight: 8,
        id: id ?? Guid.Parse("30000000-0000-0000-0000-000000000001"),
        initialLayerId: Guid.Parse("20000000-0000-0000-0000-000000000001"));
    project.AddTileset(TilesetDefinition.Create(
        Guid.Parse("10000000-0000-0000-0000-000000000001"),
        "Dungeon",
        "assets/10000000-0000-0000-0000-000000000001.png",
        16,
        16,
        8,
        8,
        sha256: new string('B', 64)));
    return project;
}

static void TileEditingCommandsUndoAndRedoExactDeltas()
{
    var project = CreateTileProject();
    var history = new ProjectCommandHistory(project);
    var layerId = project.Layers[0].Id;
    var firstTile = new TileRef(project.Tilesets[0].Id, 1);
    var secondTile = new TileRef(project.Tilesets[0].Id, 2);
    var emptyHash = project.StructuralHash();

    history.Execute(new PaintTilesCommand(layerId, [new(0, 0), new(1, 0), new(2, 0)], firstTile));
    var paintedHash = project.StructuralHash();
    history.Execute(new FloodFillCommand(layerId, new(1, 0), secondTile, new GridRectangle(1, 0, 2, 0)));
    var filledHash = project.StructuralHash();
    history.Execute(new ClearSelectionCommand(layerId, new GridRectangle(1, 0, 1, 0)));
    var clearedHash = project.StructuralHash();

    NotEqual(emptyHash, paintedHash);
    NotEqual(paintedHash, filledHash);
    NotEqual(filledHash, clearedHash);
    history.Undo();
    Equal(filledHash, project.StructuralHash());
    history.Undo();
    Equal(paintedHash, project.StructuralHash());
    history.Undo();
    Equal(emptyHash, project.StructuralHash());
    history.Redo();
    history.Redo();
    history.Redo();
    Equal(clearedHash, project.StructuralHash());
}

static void LayerCommandsAreFullyReversible()
{
    var project = CreateTileProject();
    var history = new ProjectCommandHistory(project);
    var baseline = project.StructuralHash();
    var newLayerId = Guid.Parse("20000000-0000-0000-0000-000000000003");

    history.Execute(new AddLayerCommand("Objetos", newLayerId));
    history.Execute(new RenameLayerCommand(newLayerId, "Decoración"));
    history.Execute(new MoveLayerCommand(newLayerId, 0));
    history.Execute(new SetLayerVisibilityCommand(newLayerId, false));
    history.Execute(new SetLayerLockedCommand(newLayerId, true));
    var final = project.StructuralHash();

    for (var index = 0; index < 5; index++) history.Undo();
    Equal(baseline, project.StructuralHash());
    for (var index = 0; index < 5; index++) history.Redo();
    Equal(final, project.StructuralHash());
}

static void LayerDeletionIsReversibleWithContentAndOrder()
{
    var project = CreateTileProject();
    var firstLayer = project.Layers[0].Id;
    var removedLayer = project.AddLayer("Objetos", Guid.Parse("20000000-0000-0000-0000-000000000004"));
    project.SetTile(removedLayer.Id, new(4, 5), new TileRef(project.Tilesets[0].Id, 2));
    project.SetLayerVisibility(removedLayer.Id, false);
    project.SetLayerLocked(removedLayer.Id, true);
    project.SetActiveLayer(removedLayer.Id);
    var baseline = project.StructuralHash();
    var history = new ProjectCommandHistory(project);

    Equal(true, history.Execute(new RemoveLayerCommand(removedLayer.Id)));
    Equal(1, project.Layers.Count);
    Equal(firstLayer, project.ActiveLayerId);
    history.Undo();
    Equal(baseline, project.StructuralHash());
    history.Redo();
    Equal(1, project.Layers.Count);
}

static void TilesetDeletionPreservesAndGroupsOrphanReferences()
{
    var project = CreateTileProject();
    var tileset = project.Tilesets[0];
    var upper = project.AddLayer("Superior", Guid.Parse("20000000-0000-0000-0000-000000000005"));
    project.SetTile(project.Layers[0].Id, new(1, 2), new TileRef(tileset.Id, 1));
    project.SetTile(upper.Id, new(3, 4), new TileRef(tileset.Id, 2));
    var history = new ProjectCommandHistory(project);

    Equal(true, history.Execute(new RemoveTilesetCommand(tileset.Id)));
    Equal(0, project.Tilesets.Count);
    Equal(new TileRef(tileset.Id, 1), project.GetTile(project.Layers[0].Id, new(1, 2)));
    var issue = MapProjectDiagnostics.Analyze(project).Single();
    Equal("MISSING_TILESET", issue.Code);
    Equal(2, issue.Count);
    Equal(tileset.Id, issue.TilesetId);

    history.Undo();
    Equal(tileset.Id, project.Tilesets.Single().Id);
    Equal(0, MapProjectDiagnostics.Analyze(project).Count);
    history.Redo();
    Equal(2, MapProjectDiagnostics.Analyze(project).Single().Count);
}

static void OrphanReferencesSurviveSaveAndBlockExport()
{
    var png = File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory, "fixtures", "phase1", "atlas-8.png"));
    var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(png));
    var tilesetId = Guid.Parse("10000000-0000-0000-0000-000000000099");
    var project = MapProject.Create("Huérfanos", 8, 8, 8, 8);
    project.AddTileset(TilesetDefinition.Create(tilesetId, "Temporal", $"assets/{tilesetId:D}.png", 32, 16, 8, 8, hash));
    project.SetTile(project.ActiveLayerId, new(2, 3), new TileRef(tilesetId, 4));
    new RemoveTilesetCommand(tilesetId).Execute(project);
    var assets = new Dictionary<Guid, byte[]> { [tilesetId] = png };
    var directory = Path.Combine(Path.GetTempPath(), $"mosaico-orphan-{Guid.NewGuid():N}");
    Directory.CreateDirectory(directory);
    try
    {
        var path = Path.Combine(directory, "orphan.mosaico");
        MapProjectFileStore.SaveAtomic(path, project, assets);
        var loaded = MapProjectFileStore.Load(path);
        Equal(new TileRef(tilesetId, 4), loaded.Project.GetTile(loaded.Project.ActiveLayerId, new(2, 3)));
        Equal(1, MapProjectDiagnostics.Analyze(loaded.Project).Single().Count);
        Throws<MapFormatException>(() => MosaicPackExporter.CreateBytes(project, assets));
    }
    finally { Directory.Delete(directory, recursive: true); }
}

static void ActiveLayerChangesAreReversible()
{
    var project = CreateTileProject();
    var first = project.ActiveLayerId;
    var second = project.AddLayer("Second", Guid.NewGuid()).Id;
    project.SetActiveLayer(first);
    var history = new ProjectCommandHistory(project);

    Equal(true, history.Execute(new SetActiveLayerCommand(second)));
    Equal(second, project.ActiveLayerId);
    history.Undo();
    Equal(first, project.ActiveLayerId);
    history.Redo();
    Equal(second, project.ActiveLayerId);
}

static void TileEditingRejectsInvalidBatchesAtomically()
{
    var project = CreateTileProject();
    var history = new ProjectCommandHistory(project);
    var baseline = project.StructuralHash();
    var tile = new TileRef(project.Tilesets[0].Id, 0);

    Throws<ArgumentOutOfRangeException>(() => history.Execute(
        new PaintTilesCommand(project.ActiveLayerId, [new(0, 0), new(project.Width, 0)], tile)));

    Equal(baseline, project.StructuralHash());
    Equal(false, history.CanUndo);
}

static void TileEditingPreflightsGlobalBudget()
{
    MapProject.ValidateOccupiedCellBudget(MapProject.MaximumOccupiedCells - 2, 2);
    Throws<InvalidOperationException>(() =>
        MapProject.ValidateOccupiedCellBudget(MapProject.MaximumOccupiedCells - 1, 2));
    Throws<InvalidOperationException>(() => MapProject.ValidateOccupiedCellBudget(0, -1));
}

static void CellSizeChangeIsReversibleAndPreservesPlacedTiles()
{
    var project = CreateTileProject();
    var tile = new TileRef(project.Tilesets[0].Id, 1);
    project.SetTile(project.ActiveLayerId, new(2, 3), tile);
    var history = new ProjectCommandHistory(project);
    var originalSize = (project.CellWidth, project.CellHeight);

    Equal(true, history.Execute(new ChangeCellSizeCommand(8, 32)));
    Equal((8, 32), (project.CellWidth, project.CellHeight));
    Equal(tile, project.GetTile(project.ActiveLayerId, new(2, 3)));

    history.Undo();
    Equal(originalSize, (project.CellWidth, project.CellHeight));
    Equal(tile, project.GetTile(project.ActiveLayerId, new(2, 3)));

    history.Redo();
    Equal((8, 32), (project.CellWidth, project.CellHeight));
}

static void ProjectZipRoundTripPreservesAssetsAndLayers()
{
    var atlasPath = Path.Combine(AppContext.BaseDirectory, "fixtures", "phase1", "atlas-8.png");
    var png = File.ReadAllBytes(atlasPath);
    var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(png));
    var tilesetId = Guid.Parse("10000000-0000-0000-0000-000000000009");
    var project = MapProject.Create("Round trip", 32, 18, 8, 8,
        Guid.Parse("30000000-0000-0000-0000-000000000009"),
        Guid.Parse("20000000-0000-0000-0000-000000000009"));
    project.AddTileset(TilesetDefinition.Create(tilesetId, "Atlas 8", $"assets/{tilesetId:D}.png", 32, 16, 8, 8, hash));
    var upper = project.AddLayer("Superior", Guid.Parse("20000000-0000-0000-0000-000000000010"));
    project.SetTile(upper.Id, new(3, 4), new TileRef(tilesetId, 7));
    project.SetLayerVisibility(project.Layers[0].Id, false);
    project.SetLayerLocked(upper.Id, true);

    var directory = Path.Combine(Path.GetTempPath(), $"mosaico-f1-{Guid.NewGuid():N}");
    Directory.CreateDirectory(directory);
    try
    {
        var path = Path.Combine(directory, "roundtrip.mosaico");
        MapProjectFileStore.SaveAtomic(path, project, new Dictionary<Guid, byte[]> { [tilesetId] = png });
        var loaded = MapProjectFileStore.Load(path);

        Equal(project.StructuralHash(), loaded.Project.StructuralHash());
        Equal(hash, Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(loaded.Assets[tilesetId])));
        Equal((32, 16), PngMetadataReader.ReadDimensions(loaded.Assets[tilesetId]));
    }
    finally
    {
        Directory.Delete(directory, recursive: true);
    }
}

static void ProjectZipRejectsTraversalEntries()
{
    using var stream = new MemoryStream();
    using (var archive = new System.IO.Compression.ZipArchive(stream, System.IO.Compression.ZipArchiveMode.Create, leaveOpen: true))
    {
        using var writer = new StreamWriter(archive.CreateEntry("../outside.png").Open());
        writer.Write("hostile");
    }

    stream.Position = 0;
    Throws<MapFormatException>(() => MapProjectFileStore.Load(stream));
}

static void ProjectZipRejectsNullCollectionElements()
{
    var project = MapProject.Create("Null elements", 2, 2, 8, 8);
    var baseline = JsonNode.Parse(MapProjectFileStore.SerializeManifest(project))!.AsObject();

    var tilesetNull = JsonNode.Parse(baseline.ToJsonString())!.AsObject();
    tilesetNull["tilesets"] = new JsonArray((JsonNode?)null);
    using (var archive = ProjectArchive(tilesetNull.ToJsonString()))
        Throws<MapFormatException>(() => MapProjectFileStore.Load(archive));

    var layerNull = JsonNode.Parse(baseline.ToJsonString())!.AsObject();
    layerNull["layers"] = new JsonArray((JsonNode?)null);
    using (var archive = ProjectArchive(layerNull.ToJsonString()))
        Throws<MapFormatException>(() => MapProjectFileStore.Load(archive));

    var cellNull = JsonNode.Parse(baseline.ToJsonString())!.AsObject();
    cellNull["layers"]![0]!["cells"] = new JsonArray((JsonNode?)null);
    using (var archive = ProjectArchive(cellNull.ToJsonString()))
        Throws<MapFormatException>(() => MapProjectFileStore.Load(archive));
}

static MemoryStream ProjectArchive(string manifest)
{
    var stream = new MemoryStream();
    using (var archive = new System.IO.Compression.ZipArchive(stream, System.IO.Compression.ZipArchiveMode.Create, leaveOpen: true))
    {
        var entry = archive.CreateEntry("project.json");
        using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
        writer.Write(manifest);
    }
    stream.Position = 0;
    return stream;
}

static void MosaicPackExportIsDeterministicAndContainsNoCode()
{
    var atlasPath = Path.Combine(AppContext.BaseDirectory, "fixtures", "phase1", "atlas-8.png");
    var png = File.ReadAllBytes(atlasPath);
    var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(png));
    var tilesetId = Guid.Parse("10000000-0000-0000-0000-000000000011");
    var project = MapProject.Create("Export", 16, 9, 8, 8,
        Guid.Parse("30000000-0000-0000-0000-000000000011"),
        Guid.Parse("20000000-0000-0000-0000-000000000011"));
    project.AddTileset(TilesetDefinition.Create(tilesetId, "Atlas", $"assets/{tilesetId:D}.png", 32, 16, 8, 8, hash));
    project.SetTile(project.ActiveLayerId, new(2, 3), new TileRef(tilesetId, 6));
    var assets = new Dictionary<Guid, byte[]> { [tilesetId] = png };

    var first = MosaicPackExporter.CreateBytes(project, assets);
    var second = MosaicPackExporter.CreateBytes(project, assets);
    Equal(Convert.ToHexString(first), Convert.ToHexString(second));

    using var stream = new MemoryStream(first);
    using var archive = new System.IO.Compression.ZipArchive(stream, System.IO.Compression.ZipArchiveMode.Read);
    Equal(2, archive.Entries.Count);
    Equal("manifest.json", archive.Entries[0].FullName);
    Equal($"assets/{tilesetId:D}.png", archive.Entries[1].FullName);
    Equal(false, archive.Entries.Any(entry => entry.FullName.EndsWith(".cs", StringComparison.OrdinalIgnoreCase)
        || entry.FullName.EndsWith(".dll", StringComparison.OrdinalIgnoreCase)
        || entry.FullName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)));
    using var reader = new StreamReader(archive.GetEntry("manifest.json")!.Open());
    var manifest = reader.ReadToEnd();
    Equal(true, manifest.Contains("\"schema\": \"mosaico-export\"", StringComparison.Ordinal));
    Equal(true, manifest.Contains("\"tileId\": 6", StringComparison.Ordinal));
}

static void ExportRejectsAggregateAssetsAboveArchiveLimit()
{
    var source = File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory, "fixtures", "phase1", "atlas-8.png"));
    var bytes = new byte[checked((int)(MapProjectFileStore.MaximumArchiveBytes / 16 + 1))];
    source.CopyTo(bytes, 0);
    var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes));
    var project = MapProject.Create("Bounded export", 1, 1, 8, 8);
    var assets = new Dictionary<Guid, byte[]>();
    for (var index = 0; index < 16; index++)
    {
        var id = Guid.NewGuid();
        project.AddTileset(TilesetDefinition.Create(id, $"Atlas {index}", $"assets/{id:D}.png", 32, 16, 8, 8, hash));
        assets.Add(id, bytes);
    }

    Throws<MapFormatException>(() => MosaicPackExporter.CreateBytes(project, assets));
}

static void RetainedAssetBudgetBlocksRepeatedImportDeletionAbuse()
{
    var retained = Enumerable.Range(0, MapProject.MaximumTilesets + 1)
        .ToDictionary(_ => Guid.NewGuid(), _ => new byte[] { 1 });
    Throws<MapFormatException>(() => MapProjectFileStore.ValidateRetainedAssetBudget(retained));
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
