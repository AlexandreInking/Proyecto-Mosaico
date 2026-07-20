using System.Collections.ObjectModel;
using System.ComponentModel;
using System.IO;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media.Imaging;
using Mosaico.Core;

namespace Mosaico.App;

public sealed record TilePaletteItem(TileRef Tile, string Label, BitmapSource Image);
public sealed class TilesetPaletteTab(Guid? id, string name, int tileCount = 0, bool isImport = false) : INotifyPropertyChanged
{
    private TilePaletteItem? _selectedTile;
    public const int PageSize = 256;
    public Guid? Id { get; } = id;
    public string Name { get; } = name;
    public bool IsImport { get; } = isImport;
    public int TileCount { get; } = tileCount;
    public ObservableCollection<TilePaletteItem> Tiles { get; } = [];
    public TilePaletteItem? SelectedTile
    {
        get => _selectedTile;
        set
        {
            if (ReferenceEquals(_selectedTile, value)) return;
            _selectedTile = value;
            PropertyChanged?.Invoke(this, new(nameof(SelectedTile)));
        }
    }
    public int PageIndex { get; private set; }
    public int PageCount => Math.Max(1, (TileCount + PageSize - 1) / PageSize);
    public string PageLabel => $"{PageIndex + 1} / {PageCount}";
    public bool CanGoPrevious => PageIndex > 0;
    public bool CanGoNext => PageIndex + 1 < PageCount;
    public Visibility PaginationVisibility => PageCount > 1 ? Visibility.Visible : Visibility.Collapsed;

    public event PropertyChangedEventHandler? PropertyChanged;

    public void LoadPage(TilesetDefinition definition, TileBitmapStore bitmaps, int pageIndex, int? selectedTileId = null)
    {
        PageIndex = Math.Clamp(pageIndex, 0, PageCount - 1);
        var first = PageIndex * PageSize;
        var end = Math.Min(TileCount, first + PageSize);
        Tiles.Clear();
        for (var tileId = first; tileId < end; tileId++)
            Tiles.Add(new(new(definition.Id, tileId), $"{definition.Name} · tile #{tileId}", bitmaps.GetTile(definition.Id, tileId)));
        SelectedTile = selectedTileId is { } id
            ? Tiles.FirstOrDefault(item => item.Tile.TileId == id)
            : Tiles.FirstOrDefault();
        PropertyChanged?.Invoke(this, new(nameof(PageIndex)));
        PropertyChanged?.Invoke(this, new(nameof(PageLabel)));
        PropertyChanged?.Invoke(this, new(nameof(CanGoPrevious)));
        PropertyChanged?.Invoke(this, new(nameof(CanGoNext)));
    }
}
public sealed record LayerListItem(Guid Id, string Name, bool IsVisible, bool IsLocked, int CellCount)
{
    public string VisibilityIcon => IsVisible ? "eye" : "eye-off";
    public string LockIcon => IsLocked ? "lock" : "lock-open";
}
public sealed record ProjectIssueListItem(string Code, string Message, string CountLabel, string Details);

public partial class MainWindow : Window
{
    private MapProject _project = MapProject.Create("Mapa sin título", 32, 18, 16, 16);
    private ProjectCommandHistory _history;
    private Dictionary<Guid, byte[]> _assets = [];
    private TileBitmapStore _bitmaps = new();
    private readonly ObservableCollection<TilesetPaletteTab> _tilesetTabs = [];
    private readonly ObservableCollection<LayerListItem> _layerItems = [];
    private readonly ObservableCollection<ProjectIssueListItem> _issueItems = [];
    private string? _currentPath;
    private Guid? _selectedTilesetId;
    private Guid? _paletteProjectId;
    private bool _dirty;
    private bool _openingTilesetImport;
    private bool _refreshingPanels;
    private bool _problemsDirty = true;

    public MainWindow()
    {
        InitializeComponent();
        _history = new(_project);
        TilesetTabs.ItemsSource = _tilesetTabs;
        LayersList.ItemsSource = _layerItems;
        ProblemsList.ItemsSource = _issueItems;
        Viewport.PaintRequested += Viewport_PaintRequested;
        Viewport.FillRequested += Viewport_FillRequested;
        Viewport.PickRequested += Viewport_PickRequested;
        Viewport.SelectionChanged += (_, selection) => StatusText.Text = $"Selección: {selection.Selection.CellCount:N0} celdas";
        Viewport.HoverChanged += (_, cell) => CoordinateText.Text = $"x {cell.X}  y {cell.Y}";
        Viewport.ZoomChanged += (_, zoom) => ZoomText.Text = $"{zoom:P0}";
        Viewport.Loaded += (_, _) => Viewport.FitDocument();
        SetProject(_project, new Dictionary<Guid, byte[]>(), null);
        var startupProject = Environment.GetCommandLineArgs().Skip(1)
            .FirstOrDefault(path => path.EndsWith(".mosaico", StringComparison.OrdinalIgnoreCase) && File.Exists(path));
        if (startupProject is not null) OpenProjectPath(startupProject);
    }

    private void SetProject(MapProject project, IReadOnlyDictionary<Guid, byte[]> assets, string? path)
    {
        var nextAssets = assets.ToDictionary(pair => pair.Key, pair => pair.Value);
        var nextBitmaps = new TileBitmapStore();
        nextBitmaps.ReplaceAssets(project.Tilesets, nextAssets);

        _project = project;
        _history = new(project);
        _assets = nextAssets;
        _bitmaps = nextBitmaps;
        _currentPath = path;
        Viewport.Project = project;
        Viewport.Bitmaps = _bitmaps;
        Viewport.SelectedTile = null;
        _selectedTilesetId = null;
        _paletteProjectId = null;
        _problemsDirty = true;
        SetDirty(false);
        RefreshPanels();
        Viewport.FitDocument();
    }

    private void SetDirty(bool dirty)
    {
        _dirty = dirty;
        DirtyMarkerText.Visibility = dirty ? Visibility.Visible : Visibility.Collapsed;
        Title = $"Mosaico — {_project.Name}{(dirty ? " • sin guardar" : "")}";
    }

    private void RefreshDocumentState()
    {
        ProjectNameText.Text = _project.Name;
        MapMetricsText.Text = $"{_project.Width} × {_project.Height} · celda {_project.CellWidth} × {_project.CellHeight} px";
        CellCountText.Text = $"{_project.OccupiedCellCount:N0} tiles";
        var active = _project.Layers.Single(layer => layer.Id == _project.ActiveLayerId);
        ActiveLayerText.Text = active.IsLocked ? $"{active.Name} · bloqueada" : active.Name;
        UndoButton.IsEnabled = _history.CanUndo;
        RedoButton.IsEnabled = _history.CanRedo;
        RefreshProblems();
        Viewport.InvalidateVisual();
    }

    private void RefreshProblems()
    {
        if (!_problemsDirty) return;
        _problemsDirty = false;
        var issues = MapProjectDiagnostics.Analyze(_project);
        var hadIssues = _issueItems.Count > 0;
        _issueItems.Clear();
        foreach (var issue in issues)
        {
            var details = string.Join(" · ", issue.SampleLocations);
            if (issue.Count > issue.SampleLocations.Count) details += $" · +{issue.Count - issue.SampleLocations.Count} más";
            _issueItems.Add(new(issue.Code, issue.Message, $"{issue.Count:N0} referencias", details));
        }
        var total = issues.Sum(issue => issue.Count);
        ProblemsCountText.Text = total == 0
            ? "0 errores"
            : $"{total:N0} errores en {issues.Count:N0} grupos";
        if (!hadIssues && total > 0) ProblemsToggle.IsChecked = true;
        if (total == 0) ProblemsToggle.IsChecked = false;
    }

    private void ShowError(string title, string message)
    {
        StatusText.Text = title;
        MessageBox.Show(this, message, title, MessageBoxButton.OK, MessageBoxImage.Warning);
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        if (_dirty && !ConfirmReplaceDirtyProject()) e.Cancel = true;
        base.OnClosing(e);
    }
}
