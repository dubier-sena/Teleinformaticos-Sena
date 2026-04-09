param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [int]$Port = 8080
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "SilentlyContinue"

$tmpDir = Join-Path $Root "tmp"
$pidPath = Join-Path $tmpDir "servidor_red.pid"
$statusPath = Join-Path $tmpDir "servidor_red_status.json"

try {
  Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$Port/__stop" -TimeoutSec 3 | Out-Null
  Start-Sleep -Milliseconds 800
}
catch {
}

if (Test-Path -LiteralPath $pidPath) {
  $pidValue = Get-Content -Path $pidPath -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($pidValue -match '^\d+$') {
    Stop-Process -Id ([int]$pidValue) -Force -ErrorAction SilentlyContinue
  }
}

$processes = Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -match 'servidor_web_red\.ps1' }

foreach ($process in $processes) {
  Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}

Remove-Item -LiteralPath $pidPath -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $statusPath -ErrorAction SilentlyContinue

Write-Host "Servidor local detenido." -ForegroundColor Yellow
