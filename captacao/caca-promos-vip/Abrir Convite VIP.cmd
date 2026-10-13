@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\abrir-central-v02.ps1" -Landing
if errorlevel 1 pause
