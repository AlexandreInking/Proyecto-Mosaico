using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using Mosaico.Core;

var output = GetOption(args, "--output") ?? Path.Combine("output", "benchmarks", "phase0-baseline.json");
var samples = 30;
var warmups = 5;
var brushCells = Enumerable.Range(0, 10_000).Select(index => new GridCoordinate(index % 200 - 100, index / 200 - 25)).ToArray();
var brushDocument = MapDocument.Create("Benchmark brush", 256, 256);
var brushCommand = new PaintCellsCommand(brushCells, 1);

for (var index = 0; index < warmups; index++)
{
    brushCommand.Execute(brushDocument);
    brushCommand.Undo(brushDocument);
}

var brushMilliseconds = Measure(samples, () =>
{
    brushCommand.Execute(brushDocument);
    brushCommand.Undo(brushDocument);
});

var roundTripDocument = MapDocument.Create("Benchmark open", 512, 512);
foreach (var cell in brushCells) roundTripDocument.SetTile(cell, 1);
var temporaryDirectory = Path.Combine(Path.GetTempPath(), $"mosaico-benchmark-{Guid.NewGuid():N}");
Directory.CreateDirectory(temporaryDirectory);
var mapPath = Path.Combine(temporaryDirectory, "medium.mosaic.json");
MapFileStore.SaveAtomic(mapPath, roundTripDocument);
for (var index = 0; index < warmups; index++) _ = MapFileStore.Load(mapPath);
var openMilliseconds = Measure(samples, () => _ = MapFileStore.Load(mapPath));

GC.Collect();
GC.WaitForPendingFinalizers();
var report = new
{
    schema = "mosaico-benchmark-v0",
    commit = Environment.GetEnvironmentVariable("MOSAICO_COMMIT") ?? "unknown",
    recordedAtUtc = DateTimeOffset.UtcNow,
    configuration = "Release",
    samples,
    warmups,
    environment = new
    {
        os = RuntimeInformation.OSDescription,
        architecture = RuntimeInformation.OSArchitecture.ToString(),
        runtime = RuntimeInformation.FrameworkDescription,
        processor = Environment.GetEnvironmentVariable("PROCESSOR_IDENTIFIER") ?? "unavailable",
        logicalProcessors = Environment.ProcessorCount,
        availableMemoryBytes = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes,
        gpu = "unavailable-with-current-permissions",
        displayScale = "manual-record-required",
    },
    fixtures = new
    {
        brushCells = brushCells.Length,
        openCells = roundTripDocument.OccupiedCellCount,
        mapBytes = new FileInfo(mapPath).Length,
    },
    metrics = new
    {
        brushExecuteUndoMs = Percentiles(brushMilliseconds),
        openJsonMs = Percentiles(openMilliseconds),
        processWorkingSetBytes = Environment.WorkingSet,
    },
};

var fullOutput = Path.GetFullPath(output);
Directory.CreateDirectory(Path.GetDirectoryName(fullOutput)!);
File.WriteAllText(fullOutput, JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }) + "\n");
Directory.Delete(temporaryDirectory, recursive: true);
Console.WriteLine($"Benchmark written: {fullOutput}");
Console.WriteLine($"Brush p95: {Percentile(brushMilliseconds, 0.95):F3} ms; open p95: {Percentile(openMilliseconds, 0.95):F3} ms");
return 0;

static double[] Measure(int count, Action action)
{
    var values = new double[count];
    for (var index = 0; index < count; index++)
    {
        var timer = Stopwatch.StartNew();
        action();
        timer.Stop();
        values[index] = timer.Elapsed.TotalMilliseconds;
    }
    return values;
}

static object Percentiles(double[] values) => new
{
    p50 = Percentile(values, 0.50),
    p95 = Percentile(values, 0.95),
    p99 = Percentile(values, 0.99),
    max = values.Max(),
};

static double Percentile(double[] values, double percentile)
{
    var ordered = values.Order().ToArray();
    var rank = Math.Clamp((int)Math.Ceiling(percentile * ordered.Length) - 1, 0, ordered.Length - 1);
    return ordered[rank];
}

static string? GetOption(string[] values, string name)
{
    var index = Array.IndexOf(values, name);
    return index >= 0 && index + 1 < values.Length ? values[index + 1] : null;
}
