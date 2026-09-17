# Compila la UI de Desktop (vite) y el ejecutable Tauri con firma de updater.
# Uso: pnpm desktop:build  |  scripts\build-desktop.ps1 [-SkipInstaller]
# Evita el problema de "exe viejo": siempre reconstruye dist antes del exe.
param(
    [switch]$SkipInstaller
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$desktopRoot = Join-Path $repoRoot 'DesktopApp'
$tauri = Join-Path $desktopRoot 'app\node_modules\.bin\tauri.cmd'
$defaultKeyPath = Join-Path $env:USERPROFILE '.tauri\mosaico-updater.key'

$pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if (-not $pnpm) { $pnpm = Get-Command corepack.cmd -ErrorAction SilentlyContinue }
if (-not $pnpm) { throw 'pnpm/corepack no esta disponible. Instala Node.js 24.' }

Write-Host '[1/2] Construyendo UI (vite build)...' -ForegroundColor Cyan
$pnpmArgs = @()
$pnpmExe = $pnpm.Source
if ($pnpmExe -match 'corepack') { $pnpmArgs = @('pnpm') }
& $pnpmExe @pnpmArgs --dir (Join-Path $repoRoot 'DesktopApp/app') run build
if ($LASTEXITCODE -ne 0) { throw "vite build fallo con codigo $LASTEXITCODE." }

if ($SkipInstaller) {
    Write-Host '[2/2] Omitiendo instalador NSIS (-SkipInstaller).' -ForegroundColor Yellow
    exit 0
}

Write-Host '[2/2] Compilando Tauri release + instalador NSIS...' -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $tauri -PathType Leaf)) { throw 'Dependencias Desktop ausentes. Ejecuta pnpm install.' }

$keyPath = if ($env:TAURI_SIGNING_PRIVATE_KEY_PATH) { $env:TAURI_SIGNING_PRIVATE_KEY_PATH }
    elseif ($env:TAURI_SIGNING_PRIVATE_KEY -and (Test-Path -LiteralPath $env:TAURI_SIGNING_PRIVATE_KEY -PathType Leaf)) { $env:TAURI_SIGNING_PRIVATE_KEY }
    else { $defaultKeyPath }
if (-not (Test-Path -LiteralPath $keyPath -PathType Leaf)) {
    throw "Falta clave de firma. Genera una con: tauri signer generate -w `"$defaultKeyPath`""
}
$env:TAURI_SIGNING_PRIVATE_KEY = $keyPath
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = $keyPath
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = if ($env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) { $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD } else { '' }

$running = Get-Process mosaico-desktop -ErrorAction SilentlyContinue
if ($running) { throw 'Mosaico esta en ejecucion; cierralo antes de compilar (bloquea el exe).' }

Push-Location $desktopRoot
try {
    & $tauri build --config 'src-tauri\tauri.conf.json' --bundles nsis --ci
    if ($LASTEXITCODE -ne 0) { throw "Tauri build fallo con codigo $LASTEXITCODE." }
}
finally { Pop-Location }

Write-Host "Listo: $($desktopRoot)\src-tauri\target\release\mosaico-desktop.exe" -ForegroundColor Green
