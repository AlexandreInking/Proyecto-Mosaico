param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('PASS', 'FAIL', 'BLOCKED')]
    [string]$Status,

    [Parameter(Mandatory = $true)]
    [string]$Operator,

    [Parameter(Mandatory = $true)]
    [string]$Display,

    [Parameter(Mandatory = $true)]
    [string]$Notes,

    [string[]]$Captures = @()
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$gateDirectory = Join-Path $repoRoot 'output\gate\phase1'
$automaticPath = Join-Path $gateDirectory 'gate-result.json'
$manualPath = Join-Path $gateDirectory 'manual-result.json'

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

function Assert-FileEvidence([object]$Evidence, [string]$Label) {
    if ($null -eq $Evidence -or [string]::IsNullOrWhiteSpace([string]$Evidence.path)) {
        throw "Evidencia automatica incompleta: $Label."
    }
    $path = [System.IO.Path]::GetFullPath([string]$Evidence.path)
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "$Label no encontrado: $path" }
    $item = Get-Item -LiteralPath $path
    if ($item.Length -ne [long]$Evidence.length -or (Get-Sha256 $path) -ne [string]$Evidence.sha256) {
        throw "$Label cambio desde el gate automatico: $path"
    }
}

function Assert-TreeEvidence([object]$Evidence, [string]$Label) {
    if ($null -eq $Evidence -or [string]::IsNullOrWhiteSpace([string]$Evidence.path)) {
        throw "Evidencia automatica incompleta: $Label."
    }
    $root = [System.IO.Path]::GetFullPath([string]$Evidence.path).TrimEnd('\')
    if (-not (Test-Path -LiteralPath $root -PathType Container)) { throw "$Label no encontrado: $root" }
    $actualFiles = @(Get-ChildItem -LiteralPath $root -File -Recurse | Sort-Object FullName)
    $expectedFiles = @($Evidence.files)
    if ($actualFiles.Count -ne $expectedFiles.Count) {
        throw "$Label cambio desde el gate: cantidad de archivos $($actualFiles.Count), esperada $($expectedFiles.Count)."
    }
    $manifestLines = @()
    foreach ($expected in ($expectedFiles | Sort-Object { $_.path })) {
        $relative = ([string]$expected.path).Replace('/', '\')
        $path = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
        if (-not $path.StartsWith($root + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "$Label contiene ruta invalida: $($expected.path)"
        }
        Assert-FileEvidence ([pscustomobject]@{ path = $path; length = $expected.length; sha256 = $expected.sha256 }) "$Label/$($expected.path)"
        $manifestLines += "$($expected.path)`t$($expected.length)`t$($expected.sha256)"
    }
    $manifest = ($manifestLines -join "`n") + "`n"
    if ((Get-TextSha256 $manifest) -ne [string]$Evidence.sha256) {
        throw "Hash de manifiesto de $Label no coincide con gate automatico."
    }
}

if ([string]::IsNullOrWhiteSpace($Operator)) { throw 'Operator no puede estar vacio.' }
if ([string]::IsNullOrWhiteSpace($Display)) { throw 'Display no puede estar vacio.' }
if ([string]::IsNullOrWhiteSpace($Notes)) { throw 'Notes no puede estar vacio.' }
if ($Status -eq 'PASS' -and @($Captures).Count -eq 0) {
    throw 'PASS requiere al menos una captura.'
}

if (-not (Test-Path -LiteralPath $automaticPath -PathType Leaf)) {
    throw 'Ejecuta scripts/phase1-gate.ps1 antes de registrar resultado humano.'
}

$automatic = Get-Content -LiteralPath $automaticPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($automatic.schema -ne 'mosaico-phase1-gate-v2') { throw 'Schema de gate F1 obsoleto; repite phase1-gate.ps1.' }
if ($automatic.automaticStatus -ne 'PASS') { throw 'Gate automatico F1 no esta aprobado.' }
if ($automatic.formal -ne $true -or $automatic.worktreeDirty -ne $false -or $automatic.importer.worktreeDirty -ne $false) {
    throw 'Gate automatico no corresponde a editor e importador limpios. Repite phase1-gate.ps1 sin -AllowDirty.'
}
if ($automatic.launchStatus -ne 'STARTED') {
    throw 'Gate automatico no inicio la aplicacion. Repite phase1-gate.ps1 sin -NoLaunch.'
}

$dirtyEntries = @(git -C $repoRoot status --porcelain --untracked-files=all)
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar Git del editor.' }
if ($dirtyEntries.Count -gt 0) { throw 'Worktree del editor ya no esta limpio; repite gate completo.' }

$commit = (git -C $repoRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $commit -ne $automatic.commit) {
    throw 'Commit actual no coincide con paquete evaluado por gate F1.'
}

$importerRepository = [System.IO.Path]::GetFullPath([string]$automatic.importer.repository)
$importerCommit = (& git -c "safe.directory=$importerRepository" -C $importerRepository rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $importerCommit -ne $automatic.importer.commit) {
    throw 'Commit actual del importador no coincide con gate F1.'
}
$importerDirty = @(& git -c "safe.directory=$importerRepository" -C $importerRepository status --porcelain --untracked-files=all)
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar Git del importador.' }
if ($importerDirty.Count -gt 0) { throw 'Worktree del importador ya no esta limpio; repite gate completo.' }

Assert-FileEvidence $automatic.artifacts.executable 'Ejecutable'
foreach ($assembly in @($automatic.artifacts.assemblies)) { Assert-FileEvidence $assembly "Assembly $($assembly.path)" }
foreach ($fixture in @($automatic.artifacts.fixtures)) { Assert-FileEvidence $fixture "Fixture $($fixture.path)" }
Assert-TreeEvidence $automatic.artifacts.package 'Paquete editor'
Assert-TreeEvidence $automatic.importer.package 'Paquete importador'
foreach ($evidenceName in @('coreTests', 'appTests', 'unitySmoke')) {
    $evidence = $automatic.evidence.$evidenceName
    $path = [System.IO.Path]::GetFullPath([string]$evidence.path)
    if (-not (Test-Path -LiteralPath $path -PathType Leaf) -or (Get-Sha256 $path) -ne [string]$evidence.sha256) {
        throw "Evidencia automatica cambio o falta: $evidenceName"
    }
}

$captureEvidence = @()
foreach ($capture in @($Captures)) {
    if ([string]::IsNullOrWhiteSpace($capture)) { throw 'Ruta de captura vacia.' }
    $fullPath = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $capture))
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        throw "Captura no encontrada: $capture"
    }
    $captureEvidence += [ordered]@{
        path = $fullPath
        length = (Get-Item -LiteralPath $fullPath).Length
        sha256 = Get-Sha256 $fullPath
    }
}

$result = [ordered]@{
    schema = 'mosaico-phase1-manual-gate-v2'
    status = $Status
    operator = $Operator.Trim()
    recordedAtUtc = [DateTimeOffset]::UtcNow.ToString('O')
    commit = $commit
    importerCommit = $importerCommit
    package = $automatic.artifacts.package.path
    packageSha256 = $automatic.artifacts.package.sha256
    display = $Display.Trim()
    notes = $Notes.Trim()
    captures = $captureEvidence
}
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manualPath -Encoding UTF8
Write-Host "Resultado humano F1 registrado: $Status"
Write-Host "Evidencia: $manualPath"
