@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\abrir-campanhas.ps1" -CadastroVoluntario
if errorlevel 1 pause
