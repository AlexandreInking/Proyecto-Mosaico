$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$desktopRoot = Join-Path $repoRoot 'DesktopApp'
$tauri = Join-Path $desktopRoot 'app\node_modules\.bin\tauri.cmd'

if (-not (Test-Path -LiteralPath $tauri)) {
    throw 'Dependencias ausentes. Ejecuta pnpm install desde raiz.'
}

Push-Location $desktopRoot
try {
    & $tauri dev --config 'src-tauri\tauri.conf.json'
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
