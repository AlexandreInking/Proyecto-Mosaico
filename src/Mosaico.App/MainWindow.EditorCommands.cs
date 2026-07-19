using System.Windows;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using Mosaico.Core;

namespace Mosaico.App;

public partial class MainWindow
{
    private void Viewport_PaintRequested(object? sender, TilePaintRequestedEventArgs e)
        => ExecuteEdit(new PaintTilesCommand(e.LayerId, e.Cells, e.Tile), $"{e.Cells.Count} celdas modificadas");

    private void Viewport_FillRequested(object? sender, TileCoordinateEventArgs e)
    {
        if (Viewport.SelectedTile is null)
        {
            StatusText.Text = "Selecciona un tile antes de usar relleno.";
            return;
        }
        ExecuteEdit(new FloodFillCommand(e.LayerId, e.Coordinate, Viewport.SelectedTile, Viewport.Selection), "Relleno aplicado");
    }

    private void Viewport_PickRequested(object? sender, TileCoordinateEventArgs e)
    {
        var tile = _project.Layers.Reverse().Where(layer => layer.IsVisible)
            .Select(layer => layer.GetTile(e.Coordinate)).FirstOrDefault(value => value is not null);
        if (tile is null)
        {
            StatusText.Text = "No hay tile visible en esa celda.";
            return;
        }
        SelectTile(tile.Value);
        SetTool(TileEditorTool.Paint);
    }

    private void ExecuteEdit(IProjectCommand command, string success)
    {
        try
        {
            if (!_history.Execute(command)) return;
            SetDirty(true);
            RefreshPanels();
            StatusText.Text = success;
        }
        catch (Exception error) when (error is InvalidOperationException or ArgumentException or KeyNotFoundException)
        {
            StatusText.Text = error.Message;
        }
    }

    private void Undo_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            if (_history.Undo())
            {
                SetDirty(true);
                RefreshPanels();
                StatusText.Text = "Deshacer";
            }
        }
        catch (InvalidOperationException error) { StatusText.Text = error.Message; }
    }

    private void Redo_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            if (_history.Redo())
            {
                SetDirty(true);
                RefreshPanels();
                StatusText.Text = "Rehacer";
            }
        }
        catch (InvalidOperationException error) { StatusText.Text = error.Message; }
    }

    private void DeleteSelection_Click(object sender, RoutedEventArgs e)
    {
        if (Viewport.Selection is not { } selection)
        {
            StatusText.Text = "No hay selección activa.";
            return;
        }
        ExecuteEdit(new ClearSelectionCommand(_project.ActiveLayerId, selection), "Contenido de selección borrado");
    }

    private void ClearSelection_Click(object sender, RoutedEventArgs e)
    {
        Viewport.ClearSelection();
        StatusText.Text = "Selección cancelada";
    }

    private void SelectTool_Click(object sender, RoutedEventArgs e) => SetTool(TileEditorTool.Select);
    private void PaintTool_Click(object sender, RoutedEventArgs e) => SetTool(TileEditorTool.Paint);
    private void EraseTool_Click(object sender, RoutedEventArgs e) => SetTool(TileEditorTool.Erase);
    private void FillTool_Click(object sender, RoutedEventArgs e) => SetTool(TileEditorTool.Fill);
    private void PickerTool_Click(object sender, RoutedEventArgs e) => SetTool(TileEditorTool.Picker);
    private void PanTool_Click(object sender, RoutedEventArgs e) => SetTool(TileEditorTool.Pan);
    private void ZoomTool_Click(object sender, RoutedEventArgs e) => SetTool(TileEditorTool.Zoom);
    private void FitMap_Click(object sender, RoutedEventArgs e) => Viewport.FitDocument();

    private void ChangeCellSize_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new CellSizeDialog(_project.CellWidth, _project.CellHeight) { Owner = this };
        if (dialog.ShowDialog() != true || dialog.Result is not { } size) return;
        ExecuteEdit(new ChangeCellSizeCommand(size.Width, size.Height), $"Celda: {size.Width} × {size.Height} px");
        Viewport.FitDocument();
    }

    private void SetTool(TileEditorTool tool)
    {
        Viewport.Tool = tool;
        SelectToolButton.IsChecked = tool == TileEditorTool.Select;
        PaintToolButton.IsChecked = tool == TileEditorTool.Paint;
        EraseToolButton.IsChecked = tool == TileEditorTool.Erase;
        FillToolButton.IsChecked = tool == TileEditorTool.Fill;
        PickerToolButton.IsChecked = tool == TileEditorTool.Picker;
        PanToolButton.IsChecked = tool == TileEditorTool.Pan;
        ZoomToolButton.IsChecked = tool == TileEditorTool.Zoom;
        ActiveToolText.Text = tool switch
        {
            TileEditorTool.Select => "Selección",
            TileEditorTool.Paint => "Pincel",
            TileEditorTool.Erase => "Borrador",
            TileEditorTool.Fill => "Relleno",
            TileEditorTool.Picker => "Tomar tile",
            TileEditorTool.Pan => "Mano",
            _ => "Zoom",
        };
        Viewport.Focus();
        Viewport.InvalidateVisual();
    }

    protected override void OnPreviewKeyDown(KeyEventArgs e)
    {
        base.OnPreviewKeyDown(e);
        var control = Keyboard.Modifiers.HasFlag(ModifierKeys.Control);
        var shift = Keyboard.Modifiers.HasFlag(ModifierKeys.Shift);
        if (control && e.Key == Key.N) { NewMap_Click(this, new()); e.Handled = true; }
        else if (control && e.Key == Key.O) { OpenMap_Click(this, new()); e.Handled = true; }
        else if (control && e.Key == Key.S && shift) { SaveAs(); e.Handled = true; }
        else if (control && e.Key == Key.S) { SaveMap_Click(this, new()); e.Handled = true; }
        else if (control && e.Key == Key.Z) { Undo_Click(this, new()); e.Handled = true; }
        else if (control && e.Key == Key.Y) { Redo_Click(this, new()); e.Handled = true; }
        else if (Keyboard.FocusedElement is not TextBoxBase)
        {
            if (e.Key == Key.M) SetTool(TileEditorTool.Select);
            else if (e.Key == Key.B) SetTool(TileEditorTool.Paint);
            else if (e.Key == Key.E) SetTool(TileEditorTool.Erase);
            else if (e.Key == Key.G) SetTool(TileEditorTool.Fill);
            else if (e.Key == Key.I) SetTool(TileEditorTool.Picker);
            else if (e.Key == Key.H) SetTool(TileEditorTool.Pan);
            else if (e.Key == Key.Z) SetTool(TileEditorTool.Zoom);
            else if (e.Key == Key.Delete) DeleteSelection_Click(this, new());
            else if (e.Key == Key.Escape) ClearSelection_Click(this, new());
            else if (e.Key is Key.D0 or Key.NumPad0) Viewport.FitDocument();
            else return;
            e.Handled = true;
        }
    }
}
