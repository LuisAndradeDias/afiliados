@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\reiniciar-whatsapp-seguro.ps1"
if errorlevel 1 (
  echo.
  echo A correcao nao foi aplicada para proteger a conversa atual.
  pause
)
