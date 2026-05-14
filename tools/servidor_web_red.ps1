param(
    [string]$Root = "G:\Mi unidad\Para Subir\HTML",
    [int]$Port = 8080
)

Set-Location $Root
Write-Host "Servidor iniciado en http://localhost:$Port" -ForegroundColor Green
Write-Host "Raiz: $Root" -ForegroundColor Cyan
Write-Host "Presiona Ctrl+C para detener." -ForegroundColor Yellow

python -m http.server $Port
