$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

$pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
$pnpmArguments = @()
if (-not $pnpm) {
    $pnpm = Get-Command corepack.cmd -ErrorAction SilentlyContinue
    $pnpmArguments = @('pnpm')
}
if (-not $pnpm) { throw 'pnpm/corepack no esta disponible. Instala Node.js 24.' }

$serverRoot = Join-Path $repoRoot 'WebApp\server'
$serverEnv = Join-Path $serverRoot '.env'
if (-not (Test-Path -LiteralPath $serverEnv)) {
    Copy-Item -LiteralPath (Join-Path $serverRoot '.env.example') -Destination $serverEnv
    Push-Location $serverRoot
    try {
        node ace generate:key
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar APP_KEY local.' }
    } finally {
        Pop-Location
    }
}

$clientLog = Join-Path $repoRoot 'output\logs\web-client.log'
$apiLog = Join-Path $repoRoot 'output\logs\web-api.log'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $clientLog) | Out-Null

$clientProcess = Start-Process -FilePath $pnpm.Source -ArgumentList ($pnpmArguments + @('dev:web', '--', '--host', '127.0.0.1')) -WorkingDirectory $repoRoot -RedirectStandardOutput $clientLog -RedirectStandardError "$clientLog.err" -WindowStyle Hidden -PassThru
$apiProcess = Start-Process -FilePath $pnpm.Source -ArgumentList ($pnpmArguments + @('dev:api')) -WorkingDirectory $repoRoot -RedirectStandardOutput $apiLog -RedirectStandardError "$apiLog.err" -WindowStyle Hidden -PassThru

function Wait-Endpoint([string]$Uri) {
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing $Uri -TimeoutSec 1
            if ($response.StatusCode -eq 200) { return $true }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    return $false
}

if (-not (Wait-Endpoint 'http://127.0.0.1:5173') -or -not (Wait-Endpoint 'http://127.0.0.1:3333/health')) {
    Stop-Process -Id $clientProcess.Id, $apiProcess.Id -Force -ErrorAction SilentlyContinue
    throw "WebApp o API no respondio. Revisa $clientLog y $apiLog"
}

Start-Process 'http://127.0.0.1:5173'
Write-Host 'Mosaico WebApp iniciado en http://127.0.0.1:5173'
