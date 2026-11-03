# Auditoria somente leitura. Nao cria tarefa, janela, registro ou inicializacao automatica.
[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"
$projeto = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "../.."))
$arquivoConfig = Join-Path $projeto ".env"
$launcher = Join-Path $projeto "scripts/launcher/iniciar-painel.cmd"
$verificado = (Test-Path -LiteralPath $arquivoConfig) -and (Test-Path -LiteralPath $launcher)
Write-Output ("PROJETO_VALIDO=" + $verificado)
if (-not $verificado) { exit 2 }
$linhas = Get-Content -LiteralPath $arquivoConfig
$autoEnvio = @($linhas | Where-Object { $_ -match '^WHATSAPP_AUTO_SEND_ENABLED=true\s*$' }).Count -gt 0
Write-Output ("AUTOENVIO_DESATIVADO=" + (-not $autoEnvio))
try {
  $estado = Invoke-RestMethod -Uri "http://127.0.0.1:3030/api/status" -TimeoutSec 3 -ErrorAction Stop
  Write-Output "CENTRAL_HTTP=200"
  Write-Output ("OFERTA_PENDENTE=" + [bool]$estado.ofertaPreparada)
  Write-Output ("ENVIO_INCERTO=" + [bool]$estado.whatsappEnvioIncerto)
  Write-Output ("PREPARACAO_ATIVA=" + (@($estado.executando) -contains "preparar"))
  Write-Output ("CLIQUES_AUTOMATICOS_DESATIVADOS=" + (-not [bool]$estado.whatsappAutoEnvioAtivo))
} catch { Write-Output "CENTRAL_HTTP=INDISPONIVEL" }
Write-Output "TAREFA_AGENDADA_NAO_CRIADA=TRUE"
Write-Output "NENHUMA_MENSAGEM_ENVIADA=TRUE"
if ($autoEnvio) { exit 3 }
