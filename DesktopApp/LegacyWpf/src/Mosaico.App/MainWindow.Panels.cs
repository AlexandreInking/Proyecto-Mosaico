using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using Mosaico.Core;

namespace Mosaico.App;

public partial class MainWindow
{
    private void RefreshPanels(Guid? preferredTileset = null)
    {
        _refreshingPanels = true;
        var selectedTileset = preferredTileset ?? _selectedTilesetId ?? Viewport.SelectedTile?.TilesetId;
        var previousTile = Viewport.SelectedTile;

        var paletteIsCurrent = _paletteProjectId == _project.Id
            && _tilesetTabs.Count == _project.Tilesets.Count + 1
            && _project.Tilesets.Select(item => item.Id)
                .SequenceEqual(_tilesetTabs.Where(item => !item.IsImport).Select(item => item.Id!.Value))
            && _project.Tilesets.Zip(_tilesetTabs.Where(item => !item.IsImport))
                .All(pair => pair.First.TileCount == pair.Second.TileCount);

        if (!paletteIsCurrent)
        {
            _tilesetTabs.Clear();
            foreach (var tileset in _project.Tilesets)
            {
                var tab = new TilesetPaletteTab(tileset.Id, tileset.Name, tileset.TileCount);
                var selectedTileId = previousTile is { } selected && selected.TilesetId == tileset.Id ? selected.TileId : (int?)null;
                tab.LoadPage(tileset, _bitmaps, selectedTileId.GetValueOrDefault() / TilesetPaletteTab.PageSize, selectedTileId);
                _tilesetTabs.Add(tab);
            }
            _tilesetTabs.Add(new(null, "Importar", isImport: true));
            _paletteProjectId = _project.Id;
        }

        var selectedTab = _tilesetTabs.FirstOrDefault(tab => tab.Id == selectedTileset)
            ?? _tilesetTabs.FirstOrDefault(tab => !tab.IsImport)
            ?? _tilesetTabs[0];
        TilesetTabs.SelectedItem = selectedTab;
        DeleteTilesetButton.IsEnabled = !selectedTab.IsImport;
        DeleteTilesetMenuItem.IsEnabled = !selectedTab.IsImport;

        var selectedLayer = _project.ActiveLayerId;
        _layerItems.Clear();
        foreach (var layer in _project.Layers.Reverse())
            _layerItems.Add(new(layer.Id, layer.Name, layer.IsVisible, layer.IsLocked, layer.OccupiedCellCount));
        LayersList.SelectedItem = _layerItems.FirstOrDefault(item => item.Id == selectedLayer);
        DeleteLayerButton.IsEnabled = _project.Layers.Count > 1;
        DeleteLayerMenuItem.IsEnabled = _project.Layers.Count > 1;
        _refreshingPanels = false;

        if (!selectedTab.IsImport) ApplyPaletteSelection(selectedTab, selectedTab.SelectedTile);
        else
        {
            Viewport.SelectedTile = null;
            ActiveTileText.Text = "Ninguno";
            PaletteSummaryText.Text = "Importa un sprite sheet para crear la primera paleta.";
        }
        RefreshDocumentState();
    }

    private void TilesetTabs_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_refreshingPanels || TilesetTabs.SelectedItem is not TilesetPaletteTab tab) return;
        if (!tab.IsImport)
        {
            ApplyPaletteSelection(tab, tab.SelectedTile ?? tab.Tiles.FirstOrDefault());
            return;
        }

        var fallback = _tilesetTabs.FirstOrDefault(item => item.Id == _selectedTilesetId)
            ?? _tilesetTabs.FirstOrDefault(item => !item.IsImport);
        _refreshingPanels = true;
        TilesetTabs.SelectedItem = fallback;
        _refreshingPanels = false;
        if (_openingTilesetImport) return;
        _openingTilesetImport = true;
        try
        {
            if (!ImportTileset()) RefreshPanels(_selectedTilesetId);
        }
        finally { _openingTilesetImport = false; }
    }

    private void PaletteList_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_refreshingPanels || sender is not ListBox { DataContext: TilesetPaletteTab tab, SelectedItem: TilePaletteItem item }) return;
        tab.SelectedTile = item;
        ApplyPaletteSelection(tab, item);
    }

    private void ApplyPaletteSelection(TilesetPaletteTab tab, TilePaletteItem? item)
    {
        if (tab.Id is not { } tilesetId || item is null) return;
        _selectedTilesetId = tilesetId;
        tab.SelectedTile = item;
        Viewport.SelectedTile = item.Tile;
        var tileset = _project.Tilesets.Single(value => value.Id == tilesetId);
        PaletteSummaryText.Text = $"{tileset.Name} · {tileset.TileCount} tiles · {tileset.TileWidth}×{tileset.TileHeight}";
        ActiveTileText.Text = $"{tileset.Name} #{item.Tile.TileId}";
        Viewport.InvalidateVisual();
    }

    private void SelectTile(TileRef tile)
    {
        var tab = _tilesetTabs.FirstOrDefault(item => item.Id == tile.TilesetId);
        if (tab is null)
        {
            StatusText.Text = "El tile usa un tileset eliminado. Revisa la consola.";
            ProblemsToggle.IsChecked = true;
            return;
        }
        if (tab.Tiles.All(item => item.Tile.TileId != tile.TileId))
        {
            var tileset = _project.Tilesets.Single(item => item.Id == tile.TilesetId);
            tab.LoadPage(tileset, _bitmaps, tile.TileId / TilesetPaletteTab.PageSize, tile.TileId);
        }
        var paletteItem = tab.Tiles.First(item => item.Tile == tile);
        tab.SelectedTile = paletteItem;
        _refreshingPanels = true;
        TilesetTabs.SelectedItem = tab;
        _refreshingPanels = false;
        ApplyPaletteSelection(tab, paletteItem);
    }

    private void PreviousTilePage_Click(object sender, RoutedEventArgs e)
        => ChangeTilePage(sender, -1);

    private void NextTilePage_Click(object sender, RoutedEventArgs e)
        => ChangeTilePage(sender, 1);

    private void ChangeTilePage(object sender, int delta)
    {
        if (sender is not Button { DataContext: TilesetPaletteTab { Id: { } id } tab }) return;
        var tileset = _project.Tilesets.Single(item => item.Id == id);
        tab.LoadPage(tileset, _bitmaps, tab.PageIndex + delta);
        if (ReferenceEquals(TilesetTabs.SelectedItem, tab))
            ApplyPaletteSelection(tab, tab.SelectedTile);
    }

    private void LayersList_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_refreshingPanels || LayersList.SelectedItem is not LayerListItem layer) return;
        ExecuteEdit(new SetActiveLayerCommand(layer.Id), $"Capa activa: {layer.Name}");
    }

    private void AddLayer_Click(object sender, RoutedEventArgs e)
        => ExecuteEdit(new AddLayerCommand($"Capa {_project.Layers.Count + 1}", Guid.NewGuid()), "Capa creada");

    private void DeleteLayer_Click(object sender, RoutedEventArgs e)
    {
        if (_project.Layers.Count <= 1)
        {
            StatusText.Text = "El mapa debe conservar al menos una capa.";
            return;
        }
        var layer = _project.Layers.Single(item => item.Id == _project.ActiveLayerId);
        var result = MessageBox.Show(this,
            $"¿Eliminar la capa «{layer.Name}» y sus {layer.OccupiedCellCount:N0} tiles?\n\nPuedes deshacer esta acción.",
            "Eliminar capa", MessageBoxButton.YesNo, MessageBoxImage.Warning);
        if (result == MessageBoxResult.Yes)
            ExecuteEdit(new RemoveLayerCommand(layer.Id), $"Capa eliminada: {layer.Name}");
    }

    private void DeleteTileset_Click(object sender, RoutedEventArgs e)
    {
        if (TilesetTabs.SelectedItem is not TilesetPaletteTab { Id: { } tilesetId }) return;
        var tileset = _project.Tilesets.Single(item => item.Id == tilesetId);
        var references = _project.Layers.Sum(layer => layer.Cells().Count(cell => cell.Tile.TilesetId == tilesetId));
        var result = MessageBox.Show(this,
            $"¿Eliminar el tileset «{tileset.Name}»?\n\n{references:N0} tiles colocados se conservarán como referencias huérfanas y mostrarán el marcador de error. La consola los agrupará. Puedes deshacer esta acción.",
            "Eliminar tileset", MessageBoxButton.YesNo, MessageBoxImage.Warning);
        if (result == MessageBoxResult.Yes)
            ExecuteEdit(new RemoveTilesetCommand(tilesetId), $"Tileset eliminado: {tileset.Name}");
    }

    private void MoveLayerUp_Click(object sender, RoutedEventArgs e)
    {
        var index = _project.IndexOfLayer(_project.ActiveLayerId);
        if (index < _project.Layers.Count - 1)
            ExecuteEdit(new MoveLayerCommand(_project.ActiveLayerId, index + 1), "Capa subida");
    }

    private void MoveLayerDown_Click(object sender, RoutedEventArgs e)
    {
        var index = _project.IndexOfLayer(_project.ActiveLayerId);
        if (index > 0) ExecuteEdit(new MoveLayerCommand(_project.ActiveLayerId, index - 1), "Capa bajada");
    }

    private void LayerVisibility_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not ToggleButton { Tag: Guid id }) return;
        var layer = _project.Layers.Single(item => item.Id == id);
        ExecuteEdit(new SetLayerVisibilityCommand(id, !layer.IsVisible), layer.IsVisible ? "Capa oculta" : "Capa visible");
        e.Handled = true;
    }

    private void LayerLock_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not ToggleButton { Tag: Guid id }) return;
        var layer = _project.Layers.Single(item => item.Id == id);
        ExecuteEdit(new SetLayerLockedCommand(id, !layer.IsLocked), layer.IsLocked ? "Capa desbloqueada" : "Capa bloqueada");
        e.Handled = true;
    }

    private void ToggleLayerVisibilityMenu_Click(object sender, RoutedEventArgs e)
    {
        var layer = _project.Layers.Single(item => item.Id == _project.ActiveLayerId);
        ExecuteEdit(new SetLayerVisibilityCommand(layer.Id, !layer.IsVisible), layer.IsVisible ? "Capa oculta" : "Capa visible");
    }

    private void ToggleLayerLockMenu_Click(object sender, RoutedEventArgs e)
    {
        var layer = _project.Layers.Single(item => item.Id == _project.ActiveLayerId);
        ExecuteEdit(new SetLayerLockedCommand(layer.Id, !layer.IsLocked), layer.IsLocked ? "Capa desbloqueada" : "Capa bloqueada");
    }
}
