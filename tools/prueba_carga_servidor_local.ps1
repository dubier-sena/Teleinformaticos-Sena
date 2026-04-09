param(
  [string]$BaseUrl = "http://localhost:8080/",
  [int]$ConcurrentUsers = 30,
  [int]$TimeoutSec = 20,
  [string[]]$Paths = @(
    "index.html"
  )
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($ConcurrentUsers -lt 1) {
  throw "ConcurrentUsers debe ser mayor o igual a 1."
}

$requests = @()
for ($i = 0; $i -lt $ConcurrentUsers; $i += 1) {
  $path = $Paths[$i % $Paths.Count]
  $requests += [pscustomobject]@{
    User = $i + 1
    Path = $path
    Url = [Uri]::new([Uri]$BaseUrl, $path).AbsoluteUri
  }
}

$jobs = foreach ($request in $requests) {
  Start-Job -ScriptBlock {
    param($WorkItem, $Timeout)

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
      $response = Invoke-WebRequest -Uri $WorkItem.Url -UseBasicParsing -TimeoutSec $Timeout
      $stopwatch.Stop()

      [pscustomobject]@{
        User = $WorkItem.User
        Path = $WorkItem.Path
        Url = $WorkItem.Url
        Ok = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
        StatusCode = [int]$response.StatusCode
        Milliseconds = [int]$stopwatch.ElapsedMilliseconds
        Bytes = if ($null -ne $response.RawContentLength) { [int]$response.RawContentLength } else { 0 }
        Error = ""
      }
    }
    catch {
      $stopwatch.Stop()
      [pscustomobject]@{
        User = $WorkItem.User
        Path = $WorkItem.Path
        Url = $WorkItem.Url
        Ok = $false
        StatusCode = 0
        Milliseconds = [int]$stopwatch.ElapsedMilliseconds
        Bytes = 0
        Error = $_.Exception.Message
      }
    }
  } -ArgumentList $request, $TimeoutSec
}

Wait-Job -Job $jobs | Out-Null
$results = $jobs | Receive-Job
$jobs | Remove-Job -Force | Out-Null

if (-not $results) {
  throw "No se obtuvieron resultados de la prueba."
}

$ordered = $results | Sort-Object Milliseconds
$total = $ordered.Count
$success = @($ordered | Where-Object Ok)
$failed = @($ordered | Where-Object { -not $_.Ok })

function Get-PercentileValue {
  param(
    [object[]]$Items,
    [double]$Percentile
  )

  if (-not $Items -or $Items.Count -eq 0) {
    return 0
  }

  $index = [Math]::Ceiling(($Percentile / 100) * $Items.Count) - 1
  $index = [Math]::Max(0, [Math]::Min($index, $Items.Count - 1))
  return [int]$Items[$index].Milliseconds
}

$avgMs = [int][Math]::Round((($ordered | Measure-Object -Property Milliseconds -Average).Average), 0)
$p50 = Get-PercentileValue -Items $ordered -Percentile 50
$p95 = Get-PercentileValue -Items $ordered -Percentile 95
$maxMs = [int](($ordered | Measure-Object -Property Milliseconds -Maximum).Maximum)
$minMs = [int](($ordered | Measure-Object -Property Milliseconds -Minimum).Minimum)

Write-Host ""
Write-Host "Prueba de carga del servidor local" -ForegroundColor Cyan
Write-Host "Base URL      : $BaseUrl"
Write-Host "Usuarios      : $ConcurrentUsers"
Write-Host "Rutas probadas: $($Paths -join ', ')"
Write-Host ""
Write-Host "Resumen"
Write-Host "- Exitosas : $($success.Count) / $total"
Write-Host "- Fallidas : $($failed.Count)"
Write-Host "- Min (ms) : $minMs"
Write-Host "- Avg (ms) : $avgMs"
Write-Host "- P50 (ms) : $p50"
Write-Host "- P95 (ms) : $p95"
Write-Host "- Max (ms) : $maxMs"

if ($failed.Count -gt 0) {
  Write-Host ""
  Write-Host "Errores detectados" -ForegroundColor Yellow
  $failed | Select-Object User, Path, StatusCode, Milliseconds, Error | Format-Table -AutoSize
  exit 1
}

if ($p95 -gt 3000) {
  Write-Host ""
  Write-Host "Advertencia: el percentil 95 supera 3000 ms. Conviene revisar capacidad o concurrencia del servidor." -ForegroundColor Yellow
  exit 2
}

Write-Host ""
Write-Host "Resultado aceptable para la concurrencia solicitada." -ForegroundColor Green
