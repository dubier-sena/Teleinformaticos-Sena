@echo off
setlocal
set SCRIPT_DIR=%~dp0
set WORKBOOK=G:\Mi unidad\Calendario\Calendario_Pro_2026.xlsx
title Sincronizacion Calendario Excel
echo Verificando si hay una sincronizacion anterior bloqueada...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$sync = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'powershell.exe' -and $_.CommandLine -like '*calendar_excel_sync.ps1*' }; ^
if ($sync) { $sync | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }; Start-Sleep -Milliseconds 800 }; ^
$locked = $false; ^
try { $stream = [System.IO.File]::Open('%WORKBOOK%',[System.IO.FileMode]::Open,[System.IO.FileAccess]::ReadWrite,[System.IO.FileShare]::None); $stream.Close() } catch { $locked = $true }; ^
if ($locked) { ^
  $excel = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'EXCEL.EXE' -and $_.CommandLine -like '*/automation -Embedding*' }; ^
  $excel | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} } ^
}"
echo Servicio anterior liberado.
echo.
echo Iniciando servicio de sincronizacion con Excel...
echo.
echo Deja esta ventana abierta mientras uses el calendario.
echo Cierra la ventana solo cuando ya no necesites guardar en Excel.
echo.
powershell -NoExit -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%calendar_excel_sync.ps1" -WorkbookPath "%WORKBOOK%" -Port 8765
