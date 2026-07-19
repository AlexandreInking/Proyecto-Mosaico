param(
    [switch]$AllowDirty,
    [switch]$NoLaunch,
    [string]$ImporterRepository = '',
    [string]$UnityPath = 'C:\Program Files\Unity\Hub\Editor\6000.3.11f1\Editor\Unity.exe'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

function Get-Sha256([string]$Path) {
    (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}

function Get-TextSha256([string]$Text) {
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
        ([System.BitConverter]::ToString($algorithm.ComputeHash($bytes))).Replace('-', '')
    }
    finally {
        $algorithm.Dispose()
    }
}

function Get-FileEvidence([string]$Path, [string]$RelativeTo = '') {
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        throw "Artefacto requerido no encontrado: $fullPath"
    }
    $name = $fullPath
    if (-not [string]::IsNullOrWhiteSpace($RelativeTo)) {
        $root = [System.IO.Path]::GetFullPath($RelativeTo).TrimEnd('\') + '\'
        if (-not $fullPath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Artefacto fuera de raiz esperada: $fullPath"
        }
        $name = $fullPath.Substring($root.Length).Replace('\', '/')
    }
    [ordered]@{
        path = $name
        length = (Get-Item -LiteralPath $fullPath).Length
        sha256 = Get-Sha256 $fullPath
    }
}

function Get-TreeEvidence([string]$Directory) {
    $root = [System.IO.Path]::GetFullPath($Directory).TrimEnd('\')
    if (-not (Test-Path -LiteralPath $root -PathType Container)) {
        throw "Directorio requerido no encontrado: $root"
    }
    $files = @(
        Get-ChildItem -LiteralPath $root -File -Recurse |
            ForEach-Object { Get-FileEvidence $_.FullName $root } |
            Sort-Object { $_.path }
    )
    if ($files.Count -eq 0) { throw "Directorio sin archivos: $root" }
    $manifest = (($files | ForEach-Object { "$($_.path)`t$($_.length)`t$($_.sha256)" }) -join "`n") + "`n"
    [ordered]@{
        path = $root
        sha256 = Get-TextSha256 $manifest
        files = $files
    }
}

function Get-TestEvidence([object[]]$Output, [string]$EvidencePath, [switch]$RequireSummary) {
    $text = ($Output -join [Environment]::NewLine).Trim()
    $passCount = ([regex]::Matches($text, '(?m)^PASS(?:\s|$)')).Count
    if ($passCount -eq 0) { throw "Evidencia sin casos PASS: $EvidencePath" }
    $summary = $null
    if ($RequireSummary) {
        $match = [regex]::Match($text, '(?m)^(?<passed>\d+)/(?<total>\d+) tests passed\s*$')
        if (-not $match.Success) { throw "Resumen de pruebas no reconocido: $EvidencePath" }
        $passed = [int]$match.Groups['passed'].Value
        $total = [int]$match.Groups['total'].Value
        if ($passed -ne $total -or $passed -ne $passCount) {
            throw "Conteo de pruebas inconsistente: $passCount lineas PASS; resumen $passed/$total."
        }
        $summary = "$passed/$total"
    }
    else {
        $summary = "$passCount/$passCount"
    }
    [ordered]@{
        path = $EvidencePath
        sha256 = Get-Sha256 $EvidencePath
        passed = $passCount
        total = $passCount
        summary = $summary
    }
}

if ([string]::IsNullOrWhiteSpace($ImporterRepository)) {
    $ImporterRepository = Join-Path (Split-Path -Parent $repoRoot) 'Proyecto_Mosaico_Unity_Importer'
}
$ImporterRepository = [System.IO.Path]::GetFullPath($ImporterRepository)

$dirtyEntries = @(git status --porcelain --untracked-files=all)
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar Git del editor.' }
$isDirty = $dirtyEntries.Count -gt 0

$importerCommit = (& git -c "safe.directory=$ImporterRepository" -C $ImporterRepository rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar commit Git del importador.' }
$importerDirtyEntries = @(& git -c "safe.directory=$ImporterRepository" -C $ImporterRepository status --porcelain --untracked-files=all)
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar estado Git del importador.' }
$importerIsDirty = $importerDirtyEntries.Count -gt 0

if (($isDirty -or $importerIsDirty) -and -not $AllowDirty) {
    throw "Gate formal rechazado: editor e importador deben estar limpios (editorDirty=$isDirty; importerDirty=$importerIsDirty). Use -AllowDirty solo durante desarrollo."
}

$outputDirectory = Join-Path $repoRoot 'output\gate\phase1'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$artifactDirectory = Join-Path $outputDirectory 'artifacts'
$commit = (git rev-parse HEAD).Trim()
$shortCommit = (git rev-parse --short=12 HEAD).Trim()

dotnet build ProyectoMosaico.slnx -c Release --artifacts-path $artifactDirectory
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$coreAssembly = Join-Path $artifactDirectory 'bin\Mosaico.Core.Tests\release\Mosaico.Core.Tests.dll'
$appAssembly = Join-Path $artifactDirectory 'bin\Mosaico.App.Tests\release\Mosaico.App.Tests.dll'
$coreEvidencePath = Join-Path $outputDirectory 'core-tests.txt'
$appEvidencePath = Join-Path $outputDirectory 'app-tests.txt'
$unityEvidencePath = Join-Path $outputDirectory 'unity-smoke.txt'

$coreOutput = @(& dotnet $coreAssembly 2>&1)
if ($LASTEXITCODE -ne 0) { $coreOutput; exit $LASTEXITCODE }
$coreOutput | Set-Content -LiteralPath $coreEvidencePath -Encoding UTF8
$coreEvidence = Get-TestEvidence $coreOutput $coreEvidencePath -RequireSummary

$appOutput = @(& dotnet $appAssembly 2>&1)
if ($LASTEXITCODE -ne 0) { $appOutput; exit $LASTEXITCODE }
$appOutput | Set-Content -LiteralPath $appEvidencePath -Encoding UTF8
$appEvidence = Get-TestEvidence $appOutput $appEvidencePath

$requiredFixtures = @(
    'README.md',
    'atlas-8.png',
    'atlas-16.png',
    'atlas-large.png',
    'atlas-rectangular.png',
    'sample.mosaico',
    'sample.mosaicpack'
)
$fixtureDirectory = Join-Path $repoRoot 'fixtures\phase1'
$fixtureEvidence = @($requiredFixtures | ForEach-Object { Get-FileEvidence (Join-Path $fixtureDirectory $_) $repoRoot })
$expectedFixtureHash = '08C7CD8D11BB891E9DC36A469A319DD7B06BAF764C71C547AD70CB8D2A89A13C'
$exportFixture = $fixtureEvidence | Where-Object { $_.path -eq 'fixtures/phase1/sample.mosaicpack' }
if ($exportFixture.sha256 -ne $expectedFixtureHash) {
    throw "Fixture export hash mismatch: $($exportFixture.sha256)"
}

$importerTest = Join-Path $ImporterRepository 'tools\test-unity.ps1'
if (-not (Test-Path -LiteralPath $importerTest -PathType Leaf)) {
    throw "Importador Unity separado no encontrado: $importerTest"
}
$unityOutput = @(& powershell -NoProfile -ExecutionPolicy Bypass -File $importerTest -UnityPath $UnityPath 2>&1)
if ($LASTEXITCODE -ne 0) { $unityOutput; exit $LASTEXITCODE }
$unityOutput | Set-Content -LiteralPath $unityEvidencePath -Encoding UTF8
$unityText = ($unityOutput -join [Environment]::NewLine).Trim()
if ($unityText -notmatch '(?m)^PASS\s*$') { throw 'Evidencia Unity no contiene veredicto PASS.' }
$unityValues = [ordered]@{}
foreach ($match in [regex]::Matches($unityText, '(?m)^(?<key>Map|Layers|Cells|Textures|Sprites|Tiles)=(?<value>[^\r\n]+)\s*$')) {
    $unityValues[$match.Groups['key'].Value] = $match.Groups['value'].Value
}
foreach ($requiredKey in @('Map', 'Layers', 'Cells', 'Textures', 'Sprites', 'Tiles')) {
    if (-not $unityValues.Contains($requiredKey)) { throw "Evidencia Unity incompleta: falta $requiredKey." }
}
$unityEvidence = [ordered]@{
    path = $unityEvidencePath
    sha256 = Get-Sha256 $unityEvidencePath
    status = 'PASS'
    values = $unityValues
}

$packageDirectory = Join-Path $repoRoot "output\manual\Mosaico-F1-$shortCommit"
dotnet publish src/Mosaico.App/Mosaico.App.csproj -c Release --no-restore --no-self-contained `
    --artifacts-path $artifactDirectory -o $packageDirectory
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$packageFixtureDirectory = Join-Path $packageDirectory 'fixtures\phase1'
New-Item -ItemType Directory -Force -Path $packageFixtureDirectory | Out-Null
foreach ($fixtureName in $requiredFixtures) {
    Copy-Item -LiteralPath (Join-Path $fixtureDirectory $fixtureName) -Destination $packageFixtureDirectory -Force
}
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs\manual\MG-02-editor-tilemaps.md') -Destination $packageDirectory -Force

$executable = Join-Path $packageDirectory 'Mosaico.App.exe'
$assemblies = @(
    Get-FileEvidence (Join-Path $packageDirectory 'Mosaico.App.dll') $repoRoot
    Get-FileEvidence (Join-Path $packageDirectory 'Mosaico.Core.dll') $repoRoot
)
$executableEvidence = Get-FileEvidence $executable $repoRoot
$packageEvidence = Get-TreeEvidence $packageDirectory
$importerPackage = Get-TreeEvidence (Join-Path $ImporterRepository 'Packages\com.proyectomosaico.unity-importer')

$launchStatus = 'SKIPPED'
if (-not $NoLaunch) {
    $process = Start-Process -FilePath $executable -ArgumentList @((Join-Path $packageFixtureDirectory 'sample.mosaico')) -PassThru
    if (-not $process.WaitForInputIdle(10000)) { throw 'La ventana no quedo lista en 10 segundos.' }
    $launchStatus = 'STARTED'
}

$finalCommit = (git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $finalCommit -ne $commit) { throw 'Commit del editor cambio durante gate F1.' }
$finalDirtyEntries = @(git status --porcelain --untracked-files=all)
if ($LASTEXITCODE -ne 0) { throw 'No se pudo revalidar Git del editor.' }
$finalIsDirty = $finalDirtyEntries.Count -gt 0

$finalImporterCommit = (& git -c "safe.directory=$ImporterRepository" -C $ImporterRepository rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $finalImporterCommit -ne $importerCommit) { throw 'Commit del importador cambio durante gate F1.' }
$finalImporterDirtyEntries = @(& git -c "safe.directory=$ImporterRepository" -C $ImporterRepository status --porcelain --untracked-files=all)
if ($LASTEXITCODE -ne 0) { throw 'No se pudo revalidar Git del importador.' }
$finalImporterIsDirty = $finalImporterDirtyEntries.Count -gt 0
$editorWasOrIsDirty = $isDirty -or $finalIsDirty
$importerWasOrIsDirty = $importerIsDirty -or $finalImporterIsDirty

$result = [ordered]@{
    schema = 'mosaico-phase1-gate-v2'
    commit = $commit
    formal = (-not $editorWasOrIsDirty) -and (-not $importerWasOrIsDirty)
    worktreeDirty = $editorWasOrIsDirty
    recordedAtUtc = [DateTimeOffset]::UtcNow.ToString('O')
    sdk = (dotnet --version).Trim()
    unity = '6000.3.11f1'
    automaticStatus = 'PASS'
    manualStatus = 'PENDING_HUMAN'
    launchStatus = $launchStatus
    artifacts = [ordered]@{
        executable = $executableEvidence
        assemblies = $assemblies
        package = $packageEvidence
        fixtures = $fixtureEvidence
    }
    evidence = [ordered]@{
        coreTests = $coreEvidence
        appTests = $appEvidence
        unitySmoke = $unityEvidence
    }
    importer = [ordered]@{
        repository = $ImporterRepository
        commit = $importerCommit
        worktreeDirty = $importerWasOrIsDirty
        package = $importerPackage
    }
    walkthrough = 'docs/manual/MG-02-editor-tilemaps.md'
}
$result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $outputDirectory 'gate-result.json') -Encoding UTF8

Write-Host "Gate F1 automatico PASS. Formal: $($result.formal)"
Write-Host "Ejecutable: $executable"
Write-Host "SHA-256 paquete editor: $($packageEvidence.sha256)"
Write-Host 'Falta walkthrough humano MG-02 antes de abrir F2.'
