@echo off
cd /d C:\PromocoesAfiliados
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3030'"
npm run painel
pause
