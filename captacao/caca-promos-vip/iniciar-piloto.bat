@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo Erro: instale o Node.js 18 ou superior para executar o piloto.
 echo https://nodejs.org/
 pause
 exit /b 1
)
echo ============================================
echo       CACA PROMOS VIP - PILOTO DE CAPTACAO
 echo ============================================
node src\server.mjs
if errorlevel 1 (
 echo.
 echo O servidor parou com um erro. Veja a mensagem acima.
 pause
)
