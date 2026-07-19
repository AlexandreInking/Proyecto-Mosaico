namespace Mosaico.Core;

public sealed record MapProjectIssue(
    string Severity,
    string Code,
    string Message,
    int Count,
    Guid? TilesetId,
    IReadOnlyList<string> SampleLocations);

public static class MapProjectDiagnostics
{
    public static IReadOnlyList<MapProjectIssue> Analyze(MapProject project)
    {
        ArgumentNullException.ThrowIfNull(project);
        var knownTilesets = project.Tilesets.ToDictionary(item => item.Id);
        return project.Layers
            .SelectMany(layer => layer.Cells().Select(cell => (Layer: layer, Cell: cell)))
            .Where(item => !knownTilesets.ContainsKey(item.Cell.Tile.TilesetId))
            .GroupBy(item => item.Cell.Tile.TilesetId)
            .OrderBy(group => group.Key)
            .Select(group =>
            {
                var samples = group.Take(4)
                    .Select(item => $"{item.Layer.Name} ({item.Cell.Coordinate.X}, {item.Cell.Coordinate.Y})")
                    .ToArray();
                return new MapProjectIssue(
                    "Error",
                    "MISSING_TILESET",
                    $"Tileset eliminado o ausente: {group.Key:D}",
                    group.Count(),
                    group.Key,
                    samples);
            }).ToArray();
    }
}
