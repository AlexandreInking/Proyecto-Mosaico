using System.Windows;
using Mosaico.Core;

namespace Mosaico.App;

public partial class NewMapDialog : Window
{
    public NewMapDialog() => InitializeComponent();

    public MapProject? Result { get; private set; }

    private void Confirm_Click(object sender, RoutedEventArgs e)
    {
        if (!int.TryParse(WidthBox.Text, out var width) || !int.TryParse(HeightBox.Text, out var height)
            || !int.TryParse(CellWidthBox.Text, out var cellWidth) || !int.TryParse(CellHeightBox.Text, out var cellHeight))
        {
            ErrorText.Text = "Usa valores enteros válidos.";
            return;
        }
        try
        {
            Result = MapProject.Create(NameBox.Text, width, height, cellWidth, cellHeight);
            DialogResult = true;
        }
        catch (ArgumentException error)
        {
            ErrorText.Text = error.Message;
        }
    }

    private void Cancel_Click(object sender, RoutedEventArgs e) => DialogResult = false;
}
