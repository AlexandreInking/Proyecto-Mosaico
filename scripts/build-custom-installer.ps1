$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$desktopRoot = Join-Path $repoRoot 'DesktopApp'
$tauri = Join-Path $desktopRoot 'app\node_modules\.bin\tauri.cmd'
$makensis = Join-Path $env:LOCALAPPDATA 'tauri\NSIS\makensis.exe'
$config = Join-Path $desktopRoot 'src-tauri\installer.conf.json'
$baseConfig = Get-Content -LiteralPath (Join-Path $desktopRoot 'src-tauri\tauri.conf.json') -Raw | ConvertFrom-Json
$version = [string]$baseConfig.version
$script = Join-Path $desktopRoot 'installer\MosaicoInstaller.nsi'
$icon = Join-Path $desktopRoot 'src-tauri\icons\icon.ico'
$hero = Join-Path $desktopRoot 'src-tauri\icons\installer-sidebar.bmp'
$outputDirectory = Join-Path $desktopRoot 'dist'
$output = Join-Path $outputDirectory "mosaico-setup-$version.exe"

if (-not (Test-Path -LiteralPath $tauri)) { throw 'Tauri CLI no está instalado. Ejecuta pnpm install.' }
if (-not (Test-Path -LiteralPath $makensis)) { throw 'NSIS no está disponible. Ejecuta primero pnpm --dir DesktopApp/app tauri build.' }

Push-Location $desktopRoot
try {
    & $tauri build --config $config
    if ($LASTEXITCODE -ne 0) { throw "Tauri build falló con código $LASTEXITCODE." }
} finally {
    Pop-Location
}

$innerPath = Join-Path $desktopRoot "src-tauri\target\release\bundle\nsis\Mosaico_${version}_x64-setup.exe"
if (-not (Test-Path -LiteralPath $innerPath -PathType Leaf)) { throw "No se encontrÃ³ el instalador interno de Tauri para la versiÃ³n $version." }
$inner = Get-Item -LiteralPath $innerPath
if (-not $inner) { throw 'No se encontró el instalador interno de Tauri.' }

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
& $makensis "/INPUTCHARSET" "UTF8" "/DINNER_INSTALLER=$($inner.FullName)" "/DOUTPUT_FILE=$output" "/DAPP_ICON=$icon" "/DHERO_BITMAP=$hero" "/DPRODUCT_VERSION=$version" $script
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $output)) { throw "El instalador personalizado falló con código $LASTEXITCODE." }

$artifact = Get-Item -LiteralPath $output
Write-Host "Instalador listo: $($artifact.FullName) ($([math]::Round($artifact.Length / 1MB, 2)) MB)"
