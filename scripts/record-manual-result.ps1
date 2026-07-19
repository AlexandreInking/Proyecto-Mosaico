param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('PASS', 'FAIL', 'BLOCKED')]
    [string]$Status,

    [Parameter(Mandatory = $true)]
    [string]$Operator,

    [string]$Notes = '',
    [string]$Display = 'no registrado'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$resultPath = Join-Path $repoRoot 'output\gate\gate-result.json'
if (-not (Test-Path -LiteralPath $resultPath)) {
    throw 'Ejecuta scripts/manual-gate.ps1 antes de registrar resultado humano.'
}

$result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
if ($result.worktreeDirty -ne $false) { throw 'Resultado automático no corresponde a un worktree limpio.' }
$result.manualStatus = $Status
$result | Add-Member -NotePropertyName manualEvidence -NotePropertyValue ([ordered]@{
    operator = $Operator
    recordedAtUtc = [DateTimeOffset]::UtcNow.ToString('O')
    display = $Display
    notes = $Notes
}) -Force
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $resultPath -Encoding UTF8
Write-Host "Resultado manual registrado: $Status"
