$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$desktopRoot = Join-Path $repoRoot 'DesktopApp'
$executable = Join-Path $desktopRoot 'src-tauri\target\release\mosaico-desktop.exe'
$buildMarker = Join-Path $desktopRoot 'app\dist\index.html'
if (-not (Test-Path -LiteralPath $executable)) { throw 'Mosaico no esta compilado. Ejecuta pnpm installer:build desde la raiz.' }
if ((Test-Path -LiteralPath $buildMarker) -and (Get-Item -LiteralPath $executable).LastWriteTimeUtc -lt (Get-Item -LiteralPath $buildMarker).LastWriteTimeUtc) { throw 'Mosaico Desktop esta desactualizado frente a la UI compilada. Ejecuta pnpm installer:build desde la raiz.' }
Start-Process -FilePath $executable -WorkingDirectory (Split-Path -Parent $executable)
