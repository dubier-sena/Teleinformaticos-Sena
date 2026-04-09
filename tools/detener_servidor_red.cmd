@echo off
setlocal
set "ROOT=%~dp0.."
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0detener_servidor_red.ps1" -Root "%ROOT%" -Port 8080
