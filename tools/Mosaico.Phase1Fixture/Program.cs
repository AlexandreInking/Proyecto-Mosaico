using System.Security.Cryptography;
using Mosaico.Core;

var root = FindRepositoryRoot();
var fixtureDirectory = Path.Combine(root, "fixtures", "phase1");
var project = MapProject.Create(
    "Ciudad F1",
    16,
    10,
    16,
    16,
    Guid.Parse("80000000-0000-0000-0000-000000000001"),
    Guid.Parse("81000000-0000-0000-0000-000000000001"));
project.RenameLayer(project.ActiveLayerId, "Suelo");

var assets = new Dictionary<Guid, byte[]>();
var atlas16 = AddTileset("atlas-16.png", "Terreno 16", 16, 16, Guid.Parse("82000000-0000-0000-0000-000000000001"));
var atlas8 = AddTileset("atlas-8.png", "Detalles 8", 8, 8, Guid.Parse("82000000-0000-0000-0000-000000000002"));
var atlasLarge = AddTileset("atlas-large.png", "Edificio 64", 64, 64, Guid.Parse("82000000-0000-0000-0000-000000000003"));

var ground = project.Layers[0];
for (var y = 0; y < project.Height; y++)
    for (var x = 0; x < project.Width; x++)
        project.SetTile(ground.Id, new(x, y), new(atlas16.Id, (x + y) % atlas16.TileCount));

var details = project.AddLayer("Detalles", Guid.Parse("81000000-0000-0000-0000-000000000002"));
project.SetTile(details.Id, new(2, 2), new(atlas8.Id, 6));
project.SetTile(details.Id, new(3, 2), new(atlas8.Id, 7));
project.SetTile(details.Id, new(8, 5), new(atlasLarge.Id, 0));

MapProjectFileStore.SaveAtomic(Path.Combine(fixtureDirectory, "sample.mosaico"), project, assets);
MosaicPackExporter.SaveAtomic(Path.Combine(fixtureDirectory, "sample.mosaicpack"), project, assets);
Console.WriteLine(project.StructuralHash());

return;

TilesetDefinition AddTileset(string fileName, string name, int tileWidth, int tileHeight, Guid id)
{
    var bytes = File.ReadAllBytes(Path.Combine(fixtureDirectory, fileName));
    var dimensions = PngMetadataReader.ReadDimensions(bytes);
    var definition = TilesetDefinition.Create(id, name, $"assets/{id:D}.png",
        dimensions.Width, dimensions.Height, tileWidth, tileHeight,
        Convert.ToHexString(SHA256.HashData(bytes)));
    project.AddTileset(definition);
    assets.Add(id, bytes);
    return definition;
}

static string FindRepositoryRoot()
{
    var directory = new DirectoryInfo(AppContext.BaseDirectory);
    while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "ProyectoMosaico.slnx")))
        directory = directory.Parent;
    return directory?.FullName ?? throw new DirectoryNotFoundException("Repository root was not found.");
}
