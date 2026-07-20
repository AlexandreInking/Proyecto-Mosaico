using Mosaico.App;
using Mosaico.Core;
using System.IO;
using System.Reflection;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace Mosaico.App.Tests;

internal static class Program
{
    [STAThread]
    private static int Main()
    {
        var application = new App();
        application.InitializeComponent();
        var tests = new (string Name, Action Run)[]
        {
            ("Viewport clips rendered cells to its layout bounds", ViewportClipsToBounds),
            ("Embedded Lucide paintbrush parses as vector shapes", LucidePaintbrushParses),
            ("Tile bitmap store crops real sprite sheet tiles", TileBitmapStoreCropsSpriteSheet),
            ("Tile bitmap replacement is atomic on decode failure", TileBitmapReplacementIsAtomicOnFailure),
            ("Project swap preserves current session on bitmap failure", ProjectSwapPreservesSessionOnBitmapFailure),
            ("F1 tile viewport clips layered sprites", F1TileViewportClipsLayeredSprites),
            ("F1 tile viewport clips large tiles to map bounds", F1TileViewportClipsLargeTilesToMapBounds),
            ("Viewport culling retains tall tiles anchored below view", ViewportCullingRetainsTallTilesAnchoredBelowView),
            ("Orphan tile renders a high contrast error marker", OrphanTileRendersErrorMarker),
            ("Tileset slice preview exposes a 2x2 comparison", TilesetSlicePreviewExposesTwoByTwoComparison),
            ("F1 dialogs use the dark application palette", F1DialogsUseDarkApplicationPalette),
            ("Tileset palette exposes a dedicated import tab", TilesetPaletteExposesImportTab),
            ("Large tileset palettes paginate thumbnails", LargeTilesetPalettesPaginateThumbnails),
            ("Problems console groups orphan references", ProblemsConsoleGroupsOrphanReferences),
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
        return failures == 0 ? 0 : 1;
    }

    private static void ViewportClipsToBounds()
    {
        if (!new MapViewport().ClipToBounds) throw new InvalidOperationException("ClipToBounds must be true.");
    }

    private static void LucidePaintbrushParses()
    {
        if (LucideIconCatalog.ShapeCount("paintbrush") < 1)
            throw new InvalidOperationException("Expected embedded vector shapes.");
    }

    private static void TileBitmapStoreCropsSpriteSheet()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "fixtures", "phase1", "atlas-8.png");
        var bytes = File.ReadAllBytes(path);
        var id = Guid.Parse("10000000-0000-0000-0000-000000000020");
        var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes));
        var tileset = TilesetDefinition.Create(id, "Atlas", $"assets/{id:D}.png", 32, 16, 8, 8, hash);
        var store = new TileBitmapStore();
        store.ReplaceAssets([tileset], new Dictionary<Guid, byte[]> { [id] = bytes });

        var tile = store.GetTile(id, 6);
        if (tile.PixelWidth != 8 || tile.PixelHeight != 8)
            throw new InvalidOperationException($"Expected 8x8; got {tile.PixelWidth}x{tile.PixelHeight}.");
    }

    private static void TileBitmapReplacementIsAtomicOnFailure()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "fixtures", "phase1", "atlas-8.png");
        var bytes = File.ReadAllBytes(path);
        var id = Guid.NewGuid();
        var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes));
        var tileset = TilesetDefinition.Create(id, "Atlas", $"assets/{id:D}.png", 32, 16, 8, 8, hash);
        var store = new TileBitmapStore();
        store.ReplaceAssets([tileset], new Dictionary<Guid, byte[]> { [id] = bytes });

        try
        {
            store.ReplaceAssets([tileset], new Dictionary<Guid, byte[]> { [id] = [1, 2, 3, 4] });
            throw new InvalidOperationException("Corrupt PNG was accepted.");
        }
        catch (Exception error) when (error is not InvalidOperationException || error.Message != "Corrupt PNG was accepted.")
        {
            var tile = store.GetTile(id, 0);
            if (tile.PixelWidth != 8 || tile.PixelHeight != 8)
                throw new InvalidOperationException("Previous bitmap state was not preserved.");
        }
    }

    private static void ProjectSwapPreservesSessionOnBitmapFailure()
    {
        var window = new MainWindow();
        try
        {
            var viewport = (TileMapViewport)window.FindName("Viewport");
            var previous = viewport.Project;
            var project = MapProject.Create("Hostile", 1, 1, 8, 8);
            var id = Guid.NewGuid();
            var bytes = new byte[] { 1, 2, 3, 4 };
            project.AddTileset(TilesetDefinition.Create(
                id, "Broken", $"assets/{id:D}.png", 1, 1, 1, 1,
                Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes))));
            var setProject = typeof(MainWindow).GetMethod("SetProject", BindingFlags.Instance | BindingFlags.NonPublic)
                ?? throw new InvalidOperationException("SetProject was not found.");

            try
            {
                setProject.Invoke(window, [project, new Dictionary<Guid, byte[]> { [id] = bytes }, null]);
                throw new InvalidOperationException("Hostile bitmap project was accepted.");
            }
            catch (TargetInvocationException error) when (error.InnerException is MapFormatException)
            {
                if (!ReferenceEquals(previous, viewport.Project))
                    throw new InvalidOperationException("Current session changed before bitmap validation completed.");
            }
        }
        finally { window.Close(); }
    }

    private static void F1TileViewportClipsLayeredSprites()
    {
        var viewport = new TileMapViewport();
        if (!viewport.ClipToBounds) throw new InvalidOperationException("F1 viewport must clip overhanging sprites.");
        if (viewport.Tool != TileEditorTool.Paint) throw new InvalidOperationException("Paint must be default tool.");
    }

    private static void F1TileViewportClipsLargeTilesToMapBounds()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "fixtures", "phase1", "atlas-large.png");
        var bytes = File.ReadAllBytes(path);
        var tilesetId = Guid.Parse("10000000-0000-0000-0000-000000000021");
        var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes));
        var tileset = TilesetDefinition.Create(tilesetId, "Large", $"assets/{tilesetId:D}.png", 64, 64, 64, 64, hash);
        var project = MapProject.Create("Clip", 1, 1, 16, 16);
        project.AddTileset(tileset);
        project.SetTile(project.ActiveLayerId, new(0, 0), new TileRef(tilesetId, 0));
        var store = new TileBitmapStore();
        store.ReplaceAssets([tileset], new Dictionary<Guid, byte[]> { [tilesetId] = bytes });
        var viewport = new TileMapViewport { Project = project, Bitmaps = store };
        viewport.Measure(new Size(100, 100));
        viewport.Arrange(new Rect(0, 0, 100, 100));
        viewport.FitDocument();

        var bitmap = new RenderTargetBitmap(100, 100, 96, 96, PixelFormats.Pbgra32);
        bitmap.Render(viewport);
        if (!RegionContainsOnlyColor(bitmap, new Int32Rect(32, 0, 36, 32), 39, 39, 39))
            throw new InvalidOperationException("Large tile rendered above the map rectangle.");
        var interior = ReadPixel(bitmap, 50, 50);
        if (interior[0] == 39 && interior[1] == 39 && interior[2] == 39)
            throw new InvalidOperationException("Regression fixture did not render its large tile inside map bounds.");
    }

    private static void ViewportCullingRetainsTallTilesAnchoredBelowView()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "fixtures", "phase1", "atlas-large.png");
        var bytes = File.ReadAllBytes(path);
        var tilesetId = Guid.NewGuid();
        var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes));
        var tileset = TilesetDefinition.Create(tilesetId, "Tall", $"assets/{tilesetId:D}.png", 64, 64, 64, 64, hash);
        var project = MapProject.Create("Cull", 20, 20, 16, 16);
        project.AddTileset(tileset);
        project.SetTile(project.ActiveLayerId, new(0, 5), new TileRef(tilesetId, 0));
        var store = new TileBitmapStore();
        store.ReplaceAssets([tileset], new Dictionary<Guid, byte[]> { [tilesetId] = bytes });
        var viewport = new TileMapViewport { Project = project, Bitmaps = store };
        viewport.Measure(new Size(100, 100));
        viewport.Arrange(new Rect(0, 0, 100, 100));

        var bitmap = new RenderTargetBitmap(100, 100, 96, 96, PixelFormats.Pbgra32);
        bitmap.Render(viewport);
        var interior = ReadPixel(bitmap, 60, 90);
        if (interior[0] == 24 && interior[1] == 24 && interior[2] == 24)
            throw new InvalidOperationException("Tall tile was culled although its sprite intersects the viewport.");
    }

    private static void OrphanTileRendersErrorMarker()
    {
        var tilesetId = Guid.NewGuid();
        var project = MapProject.Create("Missing", 1, 1, 16, 16);
        project.AddTileset(TilesetDefinition.Create(tilesetId, "Deleted", $"assets/{tilesetId:D}.png", 16, 16, 16, 16, new string('A', 64)));
        project.SetTile(project.ActiveLayerId, new(0, 0), new TileRef(tilesetId, 0));
        project.RemoveTileset(tilesetId);
        var viewport = new TileMapViewport { Project = project, Bitmaps = new TileBitmapStore() };
        viewport.Measure(new Size(100, 100));
        viewport.Arrange(new Rect(0, 0, 100, 100));
        viewport.FitDocument();

        var bitmap = new RenderTargetBitmap(100, 100, 96, 96, PixelFormats.Pbgra32);
        bitmap.Render(viewport);
        if (!RegionContainsColor(bitmap, new Int32Rect(32, 32, 36, 36), 168, 0, 255))
            throw new InvalidOperationException("Missing tile marker must include high-contrast magenta pixels.");
    }

    private static void TilesetSlicePreviewExposesTwoByTwoComparison()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "fixtures", "phase1", "atlas-8.png");
        var source = new BitmapImage(new Uri(path));
        var preview = new TilesetSlicePreview();
        preview.Configure(source, 8, 8, 0, 0, 0, 0);

        var expected = new[]
        {
            new Int32Rect(0, 0, 8, 8),
            new Int32Rect(8, 0, 8, 8),
            new Int32Rect(0, 8, 8, 8),
            new Int32Rect(8, 8, 8, 8),
        };
        if (!preview.TileRectangles.SequenceEqual(expected))
            throw new InvalidOperationException("2x2 preview rectangles do not match row-major slicing.");
    }

    private static void F1DialogsUseDarkApplicationPalette()
    {
        var darkWindowStyle = Application.Current.FindResource("DarkWindowStyle");
        var surface = Application.Current.FindResource("SurfaceBrush");
        var text = Application.Current.FindResource("TextBrush");
        Window[] dialogs =
        [
            new NewMapDialog(),
            new CellSizeDialog(16, 16),
            new TilesetImportDialog(
                Path.Combine(AppContext.BaseDirectory, "fixtures", "phase1", "atlas-8.png"),
                File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory, "fixtures", "phase1", "atlas-8.png")),
                Guid.NewGuid()),
        ];
        foreach (var dialog in dialogs)
        {
            if (!ReferenceEquals(dialog.Style, darkWindowStyle)
                || !ReferenceEquals(dialog.Background, surface)
                || !ReferenceEquals(dialog.Foreground, text))
                throw new InvalidOperationException($"{dialog.GetType().Name} does not use the dark window style.");
        }
    }

    private static void TilesetPaletteExposesImportTab()
    {
        var window = new MainWindow();
        try
        {
            if (window.FindName("TilesetTabs") is not TabControl { Items.Count: 1 } tabs
                || tabs.Items[0] is not TilesetPaletteTab { IsImport: true })
                throw new InvalidOperationException("Empty project must expose one dedicated import tab.");
            if (Application.Current.FindResource("TopLevelMenuHeaderTemplate") is not ControlTemplate
                || Application.Current.FindResource("SubmenuItemTemplate") is not ControlTemplate)
                throw new InvalidOperationException("Dark menu templates are missing.");
        }
        finally { window.Close(); }
    }

    private static void LargeTilesetPalettesPaginateThumbnails()
    {
        var tab = new TilesetPaletteTab(Guid.NewGuid(), "Atlas grande", 600);
        if (tab.PageCount != 3 || tab.PageLabel != "1 / 3" || tab.CanGoPrevious || !tab.CanGoNext)
            throw new InvalidOperationException("Large tilesets must expose bounded thumbnail pages.");
        if (tab.PaginationVisibility != Visibility.Visible)
            throw new InvalidOperationException("Pagination controls must be visible for large tilesets.");
    }

    private static void ProblemsConsoleGroupsOrphanReferences()
    {
        var tilesetId = Guid.NewGuid();
        var project = MapProject.Create("Problems", 4, 4, 16, 16);
        project.AddTileset(TilesetDefinition.Create(tilesetId, "Deleted", $"assets/{tilesetId:D}.png", 16, 16, 16, 16, new string('A', 64)));
        project.SetTile(project.ActiveLayerId, new(0, 0), new TileRef(tilesetId, 0));
        project.SetTile(project.ActiveLayerId, new(1, 0), new TileRef(tilesetId, 0));
        project.RemoveTileset(tilesetId);
        var window = new MainWindow();
        try
        {
            var setProject = typeof(MainWindow).GetMethod("SetProject", BindingFlags.Instance | BindingFlags.NonPublic)
                ?? throw new InvalidOperationException("SetProject was not found.");
            setProject.Invoke(window, [project, new Dictionary<Guid, byte[]>(), null]);
            if (window.FindName("ProblemsList") is not ListBox { Items.Count: 1 } problems)
                throw new InvalidOperationException("Two similar orphan references must render as one problem group.");
            if (problems.Items[0] is not ProjectIssueListItem { Code: "MISSING_TILESET" })
                throw new InvalidOperationException("Problems console must expose a stable diagnostic code.");
            if (window.FindName("ProblemsCountText") is not TextBlock count || !count.Text.Contains("2", StringComparison.Ordinal))
                throw new InvalidOperationException("Problems console must show aggregate reference count.");
            if (window.FindName("DeleteLayerButton") is null || window.FindName("DeleteTilesetButton") is null)
                throw new InvalidOperationException("Delete controls must be accessible by name.");
            if (window.FindName("ProblemsToggle") is not System.Windows.Controls.Primitives.ToggleButton toggle)
                throw new InvalidOperationException("Problems console toggle was not found.");
            toggle.IsChecked = true;
            window.UpdateLayout();
            if (problems.Visibility != Visibility.Visible)
                throw new InvalidOperationException("Problems console must become visible when expanded.");
        }
        finally { window.Close(); }
    }

    private static byte[] ReadPixel(BitmapSource bitmap, int x, int y)
    {
        var pixel = new byte[4];
        bitmap.CopyPixels(new Int32Rect(x, y, 1, 1), pixel, 4, 0);
        return pixel;
    }

    private static bool RegionContainsOnlyColor(BitmapSource bitmap, Int32Rect region, byte blue, byte green, byte red)
    {
        var pixels = new byte[bitmap.PixelWidth * bitmap.PixelHeight * 4];
        bitmap.CopyPixels(pixels, bitmap.PixelWidth * 4, 0);
        for (var y = region.Y; y < region.Y + region.Height; y++)
        for (var x = region.X; x < region.X + region.Width; x++)
        {
            var offset = (y * bitmap.PixelWidth + x) * 4;
            if (pixels[offset] != blue || pixels[offset + 1] != green || pixels[offset + 2] != red) return false;
        }
        return true;
    }

    private static bool RegionContainsColor(BitmapSource bitmap, Int32Rect region, byte blue, byte green, byte red)
    {
        var pixels = new byte[bitmap.PixelWidth * bitmap.PixelHeight * 4];
        bitmap.CopyPixels(pixels, bitmap.PixelWidth * 4, 0);
        for (var y = region.Y; y < region.Y + region.Height; y++)
        for (var x = region.X; x < region.X + region.Width; x++)
        {
            var offset = (y * bitmap.PixelWidth + x) * 4;
            if (pixels[offset] == blue && pixels[offset + 1] == green && pixels[offset + 2] == red) return true;
        }
        return false;
    }
}
