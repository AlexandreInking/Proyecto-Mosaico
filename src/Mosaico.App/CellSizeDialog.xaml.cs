using System.Windows;

namespace Mosaico.App;

public partial class CellSizeDialog : Window
{
    public CellSizeDialog(int cellWidth, int cellHeight)
    {
        InitializeComponent();
        CellWidthBox.Text = cellWidth.ToString();
        CellHeightBox.Text = cellHeight.ToString();
    }

    public (int Width, int Height)? Result { get; private set; }

    private void Confirm_Click(object sender, RoutedEventArgs e)
    {
        if (!int.TryParse(CellWidthBox.Text, out var width) || !int.TryParse(CellHeightBox.Text, out var height)
            || width is < 8 or > 2_048 || height is < 8 or > 2_048)
        {
            ErrorText.Text = "Usa enteros entre 8 y 2048 píxeles.";
            return;
        }
        Result = (width, height);
        DialogResult = true;
    }

    private void Cancel_Click(object sender, RoutedEventArgs e) => DialogResult = false;
}
