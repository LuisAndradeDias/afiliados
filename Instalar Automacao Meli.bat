@echo off
setlocal
set "EXT=%~dp0browser-extension\mercadolivre-affiliate"

echo.
echo Automacao Meli - instalacao da extensao local
echo.
echo 1. O Chrome sera aberto na pagina de extensoes.
echo 2. Ative "Modo do desenvolvedor".
echo 3. Clique em "Carregar sem compactacao".
echo 4. Selecione esta pasta:
echo.
echo    %EXT%
echo.
start "" explorer.exe "%EXT%"
start "" chrome.exe "chrome://extensions/"
echo.
pause
