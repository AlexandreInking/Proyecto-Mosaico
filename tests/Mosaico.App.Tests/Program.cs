using Mosaico.App;

namespace Mosaico.App.Tests;

internal static class Program
{
    [STAThread]
    private static int Main()
    {
        var viewport = new MapViewport();
        if (!viewport.ClipToBounds)
        {
            Console.Error.WriteLine("FAIL Viewport clips rendered cells to its layout bounds");
            return 1;
        }

        Console.WriteLine("PASS Viewport clips rendered cells to its layout bounds");
        return 0;
    }
}
