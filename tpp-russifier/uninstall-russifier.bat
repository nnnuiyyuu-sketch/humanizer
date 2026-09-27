@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0russifier\uninstall.ps1" -GameDir "%~dp0."
echo.
pause
