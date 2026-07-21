param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('PASS', 'FAIL', 'BLOCKED')]
    [string]$WebStatus,

    [Parameter(Mandatory = $true)]
    [ValidateSet('PASS', 'FAIL', 'BLOCKED')]
    [string]$DesktopStatus,

    [Parameter(Mandatory = $true)]
    [string]$Operator,

    [Parameter(Mandatory = $true)]
    [string]$Notes,

    [string[]]$Captures = @()
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$gateDirectory = Join-Path $repoRoot 'output\gate'
$automaticPath = Join-Path $gateDirectory 't1-gate-result.json'
$manualPath = Join-Path $gateDirectory 't1-manual-result.json'

function Assert-FileEvidence([object]$Evidence, [string]$Label) {
    if ($null -eq $Evidence -or [string]::IsNullOrWhiteSpace([string]$Evidence.path)) {
        throw "Evidencia automatica incompleta: $Label."
    }
    $path = [System.IO.Path]::GetFullPath([string]$Evidence.path)
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "$Label no encontrado: $path" }
    $item = Get-Item -LiteralPath $path
    $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
    if ($item.Length -ne [long]$Evidence.length -or $hash -ne [string]$Evidence.sha256) {
        throw "$Label cambio desde gate automatico: $path"
    }
}

if ([string]::IsNullOrWhiteSpace($Operator)) { throw 'Operator no puede estar vacio.' }
if ([string]::IsNullOrWhiteSpace($Notes)) { throw 'Notes no puede estar vacio.' }
if (-not (Test-Path -LiteralPath $automaticPath -PathType Leaf)) {
    throw 'Ejecuta scripts/t1-gate.ps1 antes de registrar resultado humano.'
}

$automatic = Get-Content -LiteralPath $automaticPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($automatic.schema -ne 'mosaico-t1-gate-v2' -or $automatic.automaticStatus -ne 'PASS') {
    throw 'Gate automatico T1 ausente u obsoleto; repite scripts/t1-gate.ps1.'
}

$dirtyEntries = @(git -C $repoRoot status --porcelain --untracked-files=all)
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar Git.' }
if ($dirtyEntries.Count -gt 0) { throw 'Worktree ya no esta limpio; repite gate T1.' }
$commit = (git -C $repoRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $commit -ne [string]$automatic.commit) {
    throw 'Commit actual no coincide con paquete T1 evaluado.'
}

Assert-FileEvidence $automatic.artifacts.executable 'Ejecutable Desktop'
Assert-FileEvidence $automatic.artifacts.walkthrough 'Walkthrough'
Assert-FileEvidence $automatic.artifacts.benchmark 'Benchmark'
$benchmark = Get-Content -LiteralPath $automatic.artifacts.benchmark.path -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string]$benchmark.commit -ne $commit) { throw 'Benchmark no corresponde al commit actual.' }

$captureEvidence = @()
foreach ($capture in @($Captures)) {
    $fullPath = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $capture))
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { throw "Captura no encontrada: $capture" }
    $captureEvidence += [ordered]@{
        path = $fullPath
        length = (Get-Item -LiteralPath $fullPath).Length
        sha256 = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash
    }
}

$overallStatus = if ($WebStatus -eq 'PASS' -and $DesktopStatus -eq 'PASS') {
    'PASS'
} elseif ($WebStatus -eq 'FAIL' -or $DesktopStatus -eq 'FAIL') {
    'FAIL'
} else {
    'BLOCKED'
}

$result = [ordered]@{
    schema = 'mosaico-t1-manual-gate-v1'
    status = $overallStatus
    webStatus = $WebStatus
    desktopStatus = $DesktopStatus
    operator = $Operator.Trim()
    notes = $Notes.Trim()
    commit = $commit
    recordedAtUtc = [DateTimeOffset]::UtcNow.ToString('O')
    captures = $captureEvidence
}
$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manualPath -Encoding UTF8
Write-Host "Resultado humano T1 registrado: $overallStatus"
Write-Host "Evidencia: $manualPath"
