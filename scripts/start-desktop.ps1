$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$desktopRoot = Join-Path $repoRoot 'DesktopApp'
$executable = Join-Path $desktopRoot 'src-tauri\target\release\mosaico-desktop.exe'
$tauri = Join-Path $desktopRoot 'app\node_modules\.bin\tauri.cmd'
$sourceRoots = @(
    (Join-Path $repoRoot 'Shared\ui\src'),
    (Join-Path $repoRoot 'Shared\canvas\src'),
    (Join-Path $repoRoot 'Shared\domain\src'),
    (Join-Path $desktopRoot 'app\src'),
    (Join-Path $desktopRoot 'src-tauri\src')
)

$latestSource = $sourceRoots |
    Where-Object { Test-Path -LiteralPath $_ } |
    ForEach-Object { Get-ChildItem -LiteralPath $_ -Recurse -File } |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

$needsBuild = -not (Test-Path -LiteralPath $executable)
if (-not $needsBuild -and $latestSource) {
    $needsBuild = $latestSource.LastWriteTimeUtc -gt (Get-Item -LiteralPath $executable).LastWriteTimeUtc
}

if ($needsBuild) {
    if (-not (Test-Path -LiteralPath $tauri)) { throw 'Dependencias ausentes. Ejecuta pnpm install desde raiz.' }
    Write-Host 'Actualizando Mosaico Desktop con UI compartida...'
    Push-Location $desktopRoot
    try {
        & $tauri build --config 'src-tauri\tauri.conf.json' --no-bundle
        if ($LASTEXITCODE -ne 0) { throw "Compilacion Desktop fallo con codigo $LASTEXITCODE." }
    } finally { Pop-Location }
}

if (-not (Test-Path -LiteralPath $executable)) { throw 'No se pudo generar Mosaico Desktop.' }
Start-Process -FilePath $executable -WorkingDirectory (Split-Path -Parent $executable)
