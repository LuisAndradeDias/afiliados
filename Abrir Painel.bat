@echo off
setlocal EnableExtensions
set "PROJECT_ROOT=%~dp0"

if not exist "%PROJECT_ROOT%package.json" (
  echo Falha: package.json nao encontrado ao lado deste inicializador.
  exit /b 2
)
if not exist "%PROJECT_ROOT%scripts\launcher\iniciar-painel.cmd" (
  echo Falha: scripts\launcher\iniciar-painel.cmd ausente.
  exit /b 2
)

rem Modo somente de inspecao: nao inicia Chrome, Node ou WhatsApp.
if /I "%~1"=="--verificar" (
  echo PAINEL_VERIFICADO: caminho do projeto valido.
  exit /b 0
)

cd /d "%PROJECT_ROOT%" || (
  echo Falha ao acessar a pasta do projeto.
  exit /b 2
)

rem A versao EXE identifica a porta e evita criar processos duplicados.
if exist "%PROJECT_ROOT%Iniciar-Painel-Afiliados.exe" (
  "%PROJECT_ROOT%Iniciar-Painel-Afiliados.exe"
  exit /b %ERRORLEVEL%
)

rem Sem EXE, esperar pela rota local antes de abrir o navegador.
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "$url='http://127.0.0.1:3030/api/status'; for($i=0;$i -lt 40;$i++){try{$r=Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop;if($r.StatusCode -eq 200){Start-Process 'http://127.0.0.1:3030';break}}catch{};Start-Sleep -Seconds 1}"

call "%PROJECT_ROOT%scripts\launcher\iniciar-painel.cmd"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" echo Painel encerrado com codigo %EXIT_CODE%.
pause
exit /b %EXIT_CODE%
