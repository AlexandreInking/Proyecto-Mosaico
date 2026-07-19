using System.IO;
using System.Windows;
using Microsoft.Win32;
using Mosaico.Core;

namespace Mosaico.App;

public partial class MainWindow
{
    private void NewMap_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new NewMapDialog { Owner = this };
        if (dialog.ShowDialog() != true || dialog.Result is null || !ConfirmReplaceDirtyProject()) return;
        SetProject(dialog.Result, new Dictionary<Guid, byte[]>(), null);
        SetDirty(true);
        StatusText.Text = "Mapa ortogonal creado. Importa un sprite sheet para comenzar.";
    }

    private void OpenMap_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFileDialog
        {
            Filter = "Proyecto Mosaico (*.mosaico)|*.mosaico",
            CheckFileExists = true,
            Multiselect = false,
        };
        if (dialog.ShowDialog(this) != true || !ConfirmReplaceDirtyProject()) return;
        OpenProjectPath(dialog.FileName);
    }

    private void OpenProjectPath(string path)
    {
        try
        {
            var loaded = MapProjectFileStore.Load(path);
            SetProject(loaded.Project, loaded.Assets, path);
            StatusText.Text = $"Abierto: {path}";
        }
        catch (Exception error) when (error is MapFormatException or IOException or UnauthorizedAccessException
            or NotSupportedException or InvalidOperationException)
        {
            ShowError("No se pudo abrir el proyecto", $"{error.Message}\n\nEl proyecto actual no cambió.");
        }
    }

    private void SaveMap_Click(object sender, RoutedEventArgs e)
    {
        if (_currentPath is null) SaveAs();
        else SaveTo(_currentPath);
    }

    private void SaveMapAs_Click(object sender, RoutedEventArgs e) => SaveAs();

    private bool SaveAs()
    {
        var dialog = new SaveFileDialog
        {
            Filter = "Proyecto Mosaico (*.mosaico)|*.mosaico",
            FileName = _currentPath is null ? "mapa.mosaico" : Path.GetFileName(_currentPath),
            InitialDirectory = _currentPath is null ? null : Path.GetDirectoryName(_currentPath),
            AddExtension = true,
            DefaultExt = ".mosaico",
        };
        return dialog.ShowDialog(this) == true && SaveTo(dialog.FileName);
    }

    private bool SaveTo(string path)
    {
        try
        {
            MapProjectFileStore.SaveAtomic(path, _project, _assets);
            _currentPath = path;
            SetDirty(false);
            StatusText.Text = $"Guardado: {path}";
            return true;
        }
        catch (Exception error) when (error is MapFormatException or IOException or UnauthorizedAccessException or ArgumentException or InvalidOperationException)
        {
            ShowError("No se pudo guardar", $"{error.Message}\n\nNo se confirmó ningún archivo parcial.");
            return false;
        }
    }

    private void ImportTileset_Click(object sender, RoutedEventArgs e) => ImportTileset();

    private bool ImportTileset()
    {
        var fileDialog = new OpenFileDialog
        {
            Filter = "Sprite sheet PNG (*.png)|*.png",
            CheckFileExists = true,
            Multiselect = false,
        };
        if (fileDialog.ShowDialog(this) != true) return false;
        try
        {
            var info = new FileInfo(fileDialog.FileName);
            if (info.Length > MapProjectFileStore.MaximumAssetBytes)
                throw new MapFormatException($"PNG excede {MapProjectFileStore.MaximumAssetBytes / 1024 / 1024} MiB.");
            var bytes = File.ReadAllBytes(fileDialog.FileName);
            var importDialog = new TilesetImportDialog(fileDialog.FileName, bytes, Guid.NewGuid()) { Owner = this };
            if (importDialog.ShowDialog() != true || importDialog.Result is null) return false;
            var definition = importDialog.Result.Definition;
            _project.ValidateTilesetAddition(definition);
            var nextAssets = _assets.ToDictionary(pair => pair.Key, pair => pair.Value);
            nextAssets.Add(definition.Id, importDialog.Result.PngBytes);
            var nextBitmaps = new TileBitmapStore();
            nextBitmaps.ReplaceAssets(_project.Tilesets.Append(definition), nextAssets);
            _project.AddTileset(definition);
            _assets = nextAssets;
            _bitmaps = nextBitmaps;
            Viewport.Bitmaps = _bitmaps;
            SetDirty(true);
            RefreshPanels(importDialog.Result.Definition.Id);
            StatusText.Text = $"Tileset importado: {importDialog.Result.Definition.TileCount} tiles";
            return true;
        }
        catch (Exception error) when (error is MapFormatException or IOException or UnauthorizedAccessException
            or ArgumentException or NotSupportedException or InvalidOperationException)
        {
            ShowError("No se pudo importar el sprite sheet", error.Message);
            return false;
        }
    }

    private void ExportPack_Click(object sender, RoutedEventArgs e)
    {
        if (_project.Tilesets.Count == 0)
        {
            ShowError("No se puede exportar", "Importa al menos un tileset PNG primero.");
            return;
        }
        var dialog = new SaveFileDialog
        {
            Filter = "Bundle Mosaico para importador (*.mosaicpack)|*.mosaicpack",
            FileName = $"{SanitizeFileName(_project.Name)}.mosaicpack",
            AddExtension = true,
            DefaultExt = ".mosaicpack",
        };
        if (dialog.ShowDialog(this) != true) return;
        try
        {
            MosaicPackExporter.SaveAtomic(dialog.FileName, _project, _assets);
            StatusText.Text = $"Bundle exportado: {dialog.FileName}";
        }
        catch (Exception error) when (error is MapFormatException or IOException or UnauthorizedAccessException or ArgumentException)
        {
            ShowError("No se pudo exportar", error.Message);
        }
    }

    private bool ConfirmReplaceDirtyProject()
    {
        if (!_dirty) return true;
        var result = MessageBox.Show(this,
            "Hay cambios sin guardar. ¿Guardarlos antes de continuar?",
            "Cambios sin guardar",
            MessageBoxButton.YesNoCancel,
            MessageBoxImage.Warning);
        return result switch
        {
            MessageBoxResult.Yes => _currentPath is null ? SaveAs() : SaveTo(_currentPath),
            MessageBoxResult.No => true,
            _ => false,
        };
    }

    private static string SanitizeFileName(string name)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var result = new string(name.Select(character => invalid.Contains(character) ? '_' : character).ToArray()).Trim();
        return string.IsNullOrWhiteSpace(result) ? "mapa" : result;
    }

    private void Exit_Click(object sender, RoutedEventArgs e) => Close();

    private void About_Click(object sender, RoutedEventArgs e)
        => MessageBox.Show(this,
            "Mosaico F1\nEditor ortogonal por tiles\n\nEditor gratuito · export neutral .mosaicpack\nImportador Unity distribuido por separado.\nIconos Lucide 1.16.0 (ISC/MIT).",
            "Acerca de Mosaico",
            MessageBoxButton.OK,
            MessageBoxImage.Information);
}
