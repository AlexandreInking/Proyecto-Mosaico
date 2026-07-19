param(
    [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot
$dirty = git status --porcelain --untracked-files=all
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar Git.' }
if ($dirty) {
    throw 'Gate rechazado: el worktree debe estar limpio para vincular binario y commit.'
}

$outputDirectory = Join-Path $repoRoot 'output\gate'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$commit = (git rev-parse HEAD).Trim()
$shortCommit = (git rev-parse --short=12 HEAD).Trim()
$env:MOSAICO_COMMIT = $commit

dotnet build ProyectoMosaico.slnx -c Release
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

dotnet run --project tests/Mosaico.Core.Tests/Mosaico.Core.Tests.csproj -c Release --no-build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

dotnet run --project tests/Mosaico.App.Tests/Mosaico.App.Tests.csproj -c Release --no-build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$benchmarkPath = Join-Path $outputDirectory 'phase0-baseline.json'
dotnet run --project tests/Mosaico.Benchmarks/Mosaico.Benchmarks.csproj -c Release --no-build -- --output $benchmarkPath
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$packageDirectory = Join-Path $repoRoot "output\manual\Mosaico-F0-$shortCommit"
dotnet publish src/Mosaico.App/Mosaico.App.csproj -c Release --no-restore --no-self-contained -o $packageDirectory
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$packageFixtureDirectory = Join-Path $packageDirectory 'fixtures\phase0'
New-Item -ItemType Directory -Force -Path $packageFixtureDirectory | Out-Null
Copy-Item -LiteralPath (Join-Path $repoRoot 'fixtures\phase0\sample.mosaic.json') -Destination $packageFixtureDirectory -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'fixtures\phase0\invalid-null-cells.mosaic.json') -Destination $packageFixtureDirectory -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs\manual\MG-01-primer-mapa.md') -Destination $packageDirectory -Force

$executable = Join-Path $packageDirectory 'Mosaico.App.exe'
$packageHashes = @(Get-ChildItem -LiteralPath $packageDirectory -File -Recurse | Sort-Object FullName | ForEach-Object {
    [ordered]@{
        path = $_.FullName.Substring($packageDirectory.Length + 1)
        sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    }
})

$launchStatus = 'SKIPPED'
if (-not $NoLaunch) {
    $process = Start-Process -FilePath $executable -PassThru
    if (-not $process.WaitForInputIdle(5000)) { throw 'El proceso abrió, pero la ventana no quedó lista en 5 segundos.' }
    $launchStatus = 'STARTED'
}

$result = [ordered]@{
    schema = 'mosaico-manual-gate-v0'
    commit = $commit
    worktreeDirty = $false
    recordedAtUtc = [DateTimeOffset]::UtcNow.ToString('O')
    sdk = (dotnet --version).Trim()
    automaticStatus = 'PASS'
    manualStatus = 'PENDING_HUMAN'
    launchStatus = $launchStatus
    benchmark = $benchmarkPath
    package = $packageDirectory
    executable = $executable
    packageHashes = $packageHashes
    walkthrough = 'docs/manual/MG-01-primer-mapa.md'
}
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputDirectory 'gate-result.json') -Encoding UTF8

Write-Host "Gate automatico PASS. Ejecutable: $executable"
Write-Host 'Completa MG-01 y registra PASS/FAIL/BLOCKED.'
