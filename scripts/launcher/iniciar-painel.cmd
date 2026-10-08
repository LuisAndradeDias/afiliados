@echo off
setlocal enableextensions
cd /d "%~dp0..\.."
if not exist "data\logs" mkdir "data\logs" >nul 2>&1

set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
if not exist "%NPM_CMD%" set "NPM_CMD=npm.cmd"

echo [%DATE% %TIME%] Iniciando painel Afiliados... >> "data\logs\painel-launcher.log"
call "%NPM_CMD%" run painel >> "data\logs\painel-launcher.log" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"
echo [%DATE% %TIME%] Painel encerrado com codigo %EXIT_CODE%. >> "data\logs\painel-launcher.log"
exit /b %EXIT_CODE%
