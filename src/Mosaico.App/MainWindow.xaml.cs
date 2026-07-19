using System.ComponentModel;
using System.IO;
using System.Windows;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using Microsoft.Win32;
using Mosaico.Core;

namespace Mosaico.App;

public partial class MainWindow : Window
{
    private MapDocument _document = MapDocument.Create("Prueba Ñ", 32, 18);
    private CommandHistory _history;
    private string? _currentPath;
    private bool _dirty;

    public MainWindow()
    {
        InitializeComponent();
        _history = new CommandHistory(_document);
        Viewport.StrokeCommitted += Viewport_StrokeCommitted;
        Viewport.HoverChanged += (_, cell) => HoverText.Text = $"({cell.X}, {cell.Y})";
        Viewport.ZoomChanged += (_, zoom) => ZoomText.Text = $"Zoom {zoom:P0}";
        Viewport.Loaded += (_, _) => Viewport.FitDocument();
        SetDocument(_document, null);
    }

    private void NewMap_Click(object sender, RoutedEventArgs e)
    {
        NameBox.Focus();
        NameBox.SelectAll();
        StatusText.Text = "Define nombre y dimensiones; luego pulsa Crear mapa.";
    }

    private void CreateMap_Click(object sender, RoutedEventArgs e)
    {
        if (!int.TryParse(WidthBox.Text, out var width) || !int.TryParse(HeightBox.Text, out var height))
        {
            ShowError("Dimensiones inválidas", "Usa enteros entre 1 y 16.384.");
            return;
        }
        try
        {
            var candidate = MapDocument.Create(NameBox.Text, width, height);
            if (!ConfirmReplaceDirtyDocument()) return;
            SetDocument(candidate, null);
            SetDirty(true);
            StatusText.Text = "Mapa nuevo creado. Pinta también fuera del borde para probar coordenadas negativas.";
        }
        catch (ArgumentException error)
        {
            ShowError("No se pudo crear el mapa", error.Message);
        }
    }

    private void OpenMap_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFileDialog { Filter = "Mapa Mosaico experimental (*.mosaic.json)|*.mosaic.json|JSON (*.json)|*.json", CheckFileExists = true };
        if (dialog.ShowDialog(this) != true) return;
        try
        {
            var candidate = MapFileStore.Load(dialog.FileName);
            if (!ConfirmReplaceDirtyDocument()) return;
            SetDocument(candidate, dialog.FileName);
            StatusText.Text = $"Abierto: {dialog.FileName}";
        }
        catch (Exception error) when (error is MapFormatException or IOException or UnauthorizedAccessException)
        {
            ShowError("No se pudo abrir el recurso", $"Causa: {error.Message}\nAcción: revisa formato, permisos y límites; el documento actual no cambió.");
        }
    }

    private void SaveMap_Click(object sender, RoutedEventArgs e) => SaveAs();

    private bool SaveAs()
    {
        var dialog = new SaveFileDialog
        {
            Filter = "Mapa Mosaico experimental (*.mosaic.json)|*.mosaic.json",
            FileName = _currentPath is null ? "prueba.mosaic.json" : System.IO.Path.GetFileName(_currentPath),
            InitialDirectory = _currentPath is null ? null : System.IO.Path.GetDirectoryName(_currentPath),
            AddExtension = true,
        };
        if (dialog.ShowDialog(this) != true) return false;
        try
        {
            MapFileStore.SaveAtomic(dialog.FileName, _document);
            _currentPath = dialog.FileName;
            SetDirty(false);
            StatusText.Text = $"Guardado atómico: {dialog.FileName}";
            return true;
        }
        catch (Exception error) when (error is MapFormatException or IOException or UnauthorizedAccessException or ArgumentException or InvalidOperationException)
        {
            ShowError("No se pudo guardar", $"Recurso: {dialog.FileName}\nCausa: {error.Message}\nAcción: elige otra ruta; no se confirmó ningún archivo parcial.");
            return false;
        }
    }

    private void Undo_Click(object sender, RoutedEventArgs e)
    {
        if (_history.Undo()) { SetDirty(true); Viewport.InvalidateVisual(); RefreshDocumentInfo(); }
    }

    private void Redo_Click(object sender, RoutedEventArgs e)
    {
        if (_history.Redo()) { SetDirty(true); Viewport.InvalidateVisual(); RefreshDocumentInfo(); }
    }

    private void PaintTool_Click(object sender, RoutedEventArgs e) => SetTool(EditorTool.Paint);
    private void EraseTool_Click(object sender, RoutedEventArgs e) => SetTool(EditorTool.Erase);
    private void FitMap_Click(object sender, RoutedEventArgs e) => Viewport.FitDocument();

    private void SetTool(EditorTool tool)
    {
        Viewport.Tool = tool;
        PaintButton.IsChecked = tool == EditorTool.Paint;
        EraseButton.IsChecked = tool == EditorTool.Erase;
        StatusText.Text = tool == EditorTool.Paint ? "Pincel activo" : "Borrador activo";
        Viewport.Focus();
    }

    private void Viewport_StrokeCommitted(object? sender, StrokeCommittedEventArgs e)
    {
        _history.Execute(new PaintCellsCommand(e.Cells, e.TileId));
        SetDirty(true);
        RefreshDocumentInfo();
        StatusText.Text = $"Transacción: {e.Cells.Count} celda(s)";
    }

    private void SetDocument(MapDocument document, string? path)
    {
        _document = document;
        _history = new CommandHistory(document);
        _currentPath = path;
        Viewport.Document = document;
        Viewport.FitDocument();
        NameBox.Text = document.Name;
        WidthBox.Text = document.Width.ToString();
        HeightBox.Text = document.Height.ToString();
        SetDirty(false);
        RefreshDocumentInfo();
    }

    private void RefreshDocumentInfo()
    {
        DocumentInfoText.Text = $"{_document.Name}\n{_document.Width} × {_document.Height}\nID {_document.Id}";
        HashText.Text = _document.StructuralHash();
        CellCountText.Text = $"{_document.OccupiedCellCount} celdas con contenido";
        UndoButton.IsEnabled = _history.CanUndo;
        RedoButton.IsEnabled = _history.CanRedo;
    }

    private void SetDirty(bool value)
    {
        _dirty = value;
        Title = $"Mosaico — Spike F0{(_dirty ? " • sin guardar" : "")}";
    }

    private void ShowError(string title, string message)
    {
        StatusText.Text = title;
        MessageBox.Show(this, message, title, MessageBoxButton.OK, MessageBoxImage.Warning);
    }

    private bool ConfirmReplaceDirtyDocument()
    {
        if (!_dirty) return true;
        var result = MessageBox.Show(
            this,
            "Hay cambios sin guardar. ¿Guardarlos antes de continuar?\n\nSí: guardar · No: descartar · Cancelar: volver al mapa",
            "Cambios sin guardar",
            MessageBoxButton.YesNoCancel,
            MessageBoxImage.Warning);
        return result switch
        {
            MessageBoxResult.Yes => SaveAs(),
            MessageBoxResult.No => true,
            _ => false,
        };
    }

    protected override void OnPreviewKeyDown(KeyEventArgs e)
    {
        base.OnPreviewKeyDown(e);
        var control = Keyboard.Modifiers.HasFlag(ModifierKeys.Control);
        var shift = Keyboard.Modifiers.HasFlag(ModifierKeys.Shift);
        if (control && e.Key == Key.N) { NewMap_Click(this, new RoutedEventArgs()); e.Handled = true; }
        else if (control && e.Key == Key.O) { OpenMap_Click(this, new RoutedEventArgs()); e.Handled = true; }
        else if (control && shift && e.Key == Key.S) { SaveAs(); e.Handled = true; }
        else if (control && e.Key == Key.Z) { Undo_Click(this, new RoutedEventArgs()); e.Handled = true; }
        else if (control && e.Key == Key.Y) { Redo_Click(this, new RoutedEventArgs()); e.Handled = true; }
        else if (!control && Keyboard.FocusedElement is not TextBoxBase && e.Key == Key.P) { SetTool(EditorTool.Paint); e.Handled = true; }
        else if (!control && Keyboard.FocusedElement is not TextBoxBase && e.Key == Key.E) { SetTool(EditorTool.Erase); e.Handled = true; }
        else if (!control && Keyboard.FocusedElement is not TextBoxBase && e.Key == Key.D0) { Viewport.FitDocument(); e.Handled = true; }
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        if (_dirty && !ConfirmReplaceDirtyDocument()) e.Cancel = true;
        base.OnClosing(e);
    }
}
