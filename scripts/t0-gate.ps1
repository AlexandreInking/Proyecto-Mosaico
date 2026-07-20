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
if (-not $pnpm) { throw 'pnpm.cmd no esta disponible. Ejecuta corepack enable o instala pnpm 11.' }

& $pnpm.Source install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

node --test tests/t0/*.test.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $pnpm.Source -r --if-present typecheck
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $pnpm.Source -r --if-present test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $pnpm.Source --filter '@mosaico/web-server' lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $pnpm.Source -r --if-present build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

cargo test --manifest-path DesktopApp/src-tauri/Cargo.toml
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Push-Location (Join-Path $repoRoot 'DesktopApp')
try {
    & '.\app\node_modules\.bin\tauri.cmd' build --config 'src-tauri\tauri.conf.json'
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}

$commit = (git rev-parse HEAD).Trim()
$shortCommit = (git rev-parse --short=12 HEAD).Trim()
$packageDirectory = Join-Path $repoRoot "output\manual\Mosaico-T0-$shortCommit"
New-Item -ItemType Directory -Force -Path $packageDirectory | Out-Null

$builtExecutable = Join-Path $repoRoot 'DesktopApp\src-tauri\target\release\mosaico-desktop.exe'
$executable = Join-Path $packageDirectory 'Mosaico.exe'
Copy-Item -LiteralPath $builtExecutable -Destination $executable -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs\manual\MG-T0-dual-shell.md') -Destination $packageDirectory -Force

$launchStatus = 'SKIPPED'
if (-not $NoLaunch) {
    Start-Process -FilePath $executable
    $launchStatus = 'STARTED'
}

$gateDirectory = Join-Path $repoRoot 'output\gate'
New-Item -ItemType Directory -Force -Path $gateDirectory | Out-Null
$result = [ordered]@{
    schema = 'mosaico-t0-gate-v1'
    commit = $commit
    recordedAtUtc = [DateTimeOffset]::UtcNow.ToString('O')
    automaticStatus = 'PASS'
    manualStatus = 'PENDING_HUMAN'
    launchStatus = $launchStatus
    executable = $executable
    walkthrough = 'docs/manual/MG-T0-dual-shell.md'
}
$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $gateDirectory 't0-gate-result.json') -Encoding UTF8

Write-Host "Gate T0 automatico PASS. Ejecutable: $executable"
Write-Host 'Completa MG-T0 y reporta PASS/FAIL/BLOCKED.'
