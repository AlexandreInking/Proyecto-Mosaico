param(
    [string]$Version = '',
    [string]$ReleaseBaseUrl = 'https://github.com/AlexandreInking/Proyecto-Mosaico/releases/download',
    [string]$OutputDirectory = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$desktopRoot = Join-Path $repoRoot 'DesktopApp'
$tauri = Join-Path $desktopRoot 'app\node_modules\.bin\tauri.cmd'
$tauriConfig = Join-Path $desktopRoot 'src-tauri\tauri.conf.json'
$defaultKeyPath = Join-Path $env:USERPROFILE '.tauri\mosaico-updater.key'

if (-not (Test-Path -LiteralPath $tauri -PathType Leaf)) { throw 'Dependencias Desktop ausentes. Ejecuta pnpm install.' }
if (-not (Test-Path -LiteralPath $tauriConfig -PathType Leaf)) { throw "Configuración Tauri no encontrada: $tauriConfig" }

$config = Get-Content -LiteralPath $tauriConfig -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($Version)) { $Version = [string]$config.version }
elseif ([string]$config.version -ne $Version) { throw "Versiones no coinciden: tauri.conf.json=$($config.version), argumento=$Version. Actualiza tauri.conf.json primero." }
if ($Version -notmatch '^\d+\.\d+\.\d+([-.][0-9A-Za-z.-]+)?$') { throw "Versión SemVer inválida: $Version" }

$keyPath = if ($env:TAURI_SIGNING_PRIVATE_KEY_PATH) { $env:TAURI_SIGNING_PRIVATE_KEY_PATH } elseif ($env:TAURI_SIGNING_PRIVATE_KEY -and (Test-Path -LiteralPath $env:TAURI_SIGNING_PRIVATE_KEY -PathType Leaf)) { $env:TAURI_SIGNING_PRIVATE_KEY } else { $defaultKeyPath }
if (-not (Test-Path -LiteralPath $keyPath -PathType Leaf)) {
    throw "Falta clave de firma. Genera una con: tauri signer generate -w `"$defaultKeyPath`""
}

$env:TAURI_SIGNING_PRIVATE_KEY = $keyPath
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = $keyPath
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = if ($env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) { $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD } else { '' }

Push-Location $desktopRoot
$buildStarted = Get-Date
try {
    & $tauri build --config 'src-tauri\tauri.conf.json' --bundles nsis --ci
    if ($LASTEXITCODE -ne 0) { throw "Build Demo falló con código $LASTEXITCODE." }
}
finally { Pop-Location }

$bundleDirectory = Join-Path $desktopRoot 'src-tauri\target\release\bundle\nsis'
$installer = Get-ChildItem -LiteralPath $bundleDirectory -Filter '*-setup.exe' -File |
    Where-Object { $_.Name -match [regex]::Escape($Version) -and $_.LastWriteTime -ge $buildStarted } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
$signature = if ($installer) { Get-Item -LiteralPath "$($installer.FullName).sig" -ErrorAction SilentlyContinue } else { $null }
if (-not $installer -or -not $signature) { throw "Bundle NSIS incompleto en $bundleDirectory" }

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) { $OutputDirectory = Join-Path $repoRoot "output\demo\Mosaico-$Version" }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
Copy-Item -LiteralPath $installer.FullName -Destination $OutputDirectory -Force
Copy-Item -LiteralPath $signature.FullName -Destination $OutputDirectory -Force

$releaseUrl = "$($ReleaseBaseUrl.TrimEnd('/'))/v$Version/$($installer.Name)"
$manifest = [ordered]@{
    version = $Version
    notes = "Mosaico $Version"
    pub_date = [DateTimeOffset]::UtcNow.ToString('O')
    platforms = [ordered]@{
        'windows-x86_64' = [ordered]@{
            signature = (Get-Content -LiteralPath $signature.FullName -Raw -Encoding UTF8).Trim()
            url = $releaseUrl
        }
    }
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'latest.json') -Encoding UTF8

$readme = @"
Mosaico Demo $Version

Entrega sin código fuente. Ejecuta el archivo *-setup.exe para instalar o actualizar una instalación existente.

Actualizador automático:
1. Publica el archivo *-setup.exe, su *.sig y latest.json en GitHub Release v$Version.
4. Para reparar, abre Aplicaciones instaladas, selecciona Mosaico y pulsa Modificar/Reparar.
3. Conserva la clave privada de Tauri fuera del repositorio.
3. Las futuras versiones deben incrementar la versión y volver a ejecutar este script.
"@
$readme = $readme -replace '(?m)^4\. Para reparar', '2. Para reparar'
$readme = $readme -replace '(?m)^2\. Conserva', '3. Conserva'
$readme = $readme -replace '(?m)^3\. Las futuras', '4. Las futuras'
$readme | Set-Content -LiteralPath (Join-Path $OutputDirectory 'README.txt') -Encoding UTF8

Write-Host "Demo generada: $OutputDirectory"
Write-Host "Instalador actualizable y reparable: $($installer.Name)"
Write-Host "Manifest updater: $(Join-Path $OutputDirectory 'latest.json')"
