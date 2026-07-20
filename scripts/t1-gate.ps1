param(
    [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

$dirty = git status --porcelain --untracked-files=all
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar Git.' }
if ($dirty) { throw 'Gate rechazado: worktree debe estar limpio.' }

$pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if (-not $pnpm) { throw 'pnpm.cmd no esta disponible.' }

& $pnpm.Source install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $pnpm.Source typecheck
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $pnpm.Source test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $pnpm.Source build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $pnpm.Source audit --audit-level high
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

cargo test --manifest-path DesktopApp/src-tauri/Cargo.toml
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$commit = (git rev-parse HEAD).Trim()
$gateDirectory = Join-Path $repoRoot 'output\gate'
New-Item -ItemType Directory -Force -Path $gateDirectory | Out-Null
$result = [ordered]@{
    schema = 'mosaico-t1-gate-v1'
    commit = $commit
    recordedAtUtc = [DateTimeOffset]::UtcNow.ToString('O')
    automaticStatus = 'PASS'
    manualStatus = 'PENDING_HUMAN'
    walkthrough = 'docs/manual/MG-T1-image-pipeline.md'
}
$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $gateDirectory 't1-gate-result.json') -Encoding UTF8

if (-not $NoLaunch) {
    Start-Process -FilePath (Join-Path $repoRoot 'Mosaico-Web.cmd')
}

Write-Host 'Gate T1 automatico PASS.'
Write-Host 'Completa MG-T1 y reporta PASS T1 o el paso que falla.'
