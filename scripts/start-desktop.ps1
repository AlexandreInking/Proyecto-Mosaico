$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$desktopRoot = Join-Path $repoRoot 'DesktopApp'
$executable = Join-Path $desktopRoot 'src-tauri\target\release\mosaico-desktop.exe'
$buildMarker = Join-Path $desktopRoot 'app\dist\index.html'
if (-not (Test-Path -LiteralPath $executable)) { throw 'Mosaico no esta compilado. Ejecuta pnpm installer:build desde la raiz.' }
if (-not (Test-Path -LiteralPath $buildMarker)) { throw 'La UI de Mosaico no esta compilada. Ejecuta pnpm installer:build desde la raiz.' }
Start-Process -FilePath $executable -WorkingDirectory (Split-Path -Parent $executable)
