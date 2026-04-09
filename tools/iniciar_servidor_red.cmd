@echo off
setlocal
set "ROOT=%~dp0.."
start "Servidor local SENA" "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "& '%~dp0servidor_web_red.ps1' -Root '%ROOT%' -Port 8080"
