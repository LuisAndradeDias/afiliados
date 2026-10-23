$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
Write-Output 'LABORATORIO CPV - DIAGNOSTICO (SEM ENVIOS)'
if(-not (Test-Path -LiteralPath '.env')) { throw 'Falta .env privado' }
if(-not (Get-Command docker -ErrorAction SilentlyContinue)){
  Write-Output 'PENDENTE: Docker Desktop nao instalado ou nao esta no PATH.'
  exit 2
}
docker compose version
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
docker compose config -q
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
docker compose ps
try { 
  $resp=Invoke-RestMethod -Uri 'http://127.0.0.1:4000/health' -TimeoutSec 4
  Write-Output ("HEALTH STATUS: " + $resp.status)
} catch { Write-Output 'Servidor ainda nao iniciado.' }
