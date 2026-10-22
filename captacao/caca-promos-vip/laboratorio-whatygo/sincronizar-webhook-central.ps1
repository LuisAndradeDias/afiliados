param([switch]$Aplicar)
$ErrorActionPreference = 'Stop'
$lab = $PSScriptRoot
$central = Join-Path $lab '..'
$data = if (Test-Path (Join-Path $central 'dados\previa-acer\chave-admin.txt')) {
  Join-Path $central 'dados\previa-acer'
} else {
  Join-Path $central 'dados'
}
$keyFile = Join-Path $lab 'private\webhook-recebimento-chave.txt'
$bridgeFile = Join-Path $data 'whatygo-ponte-chave.txt'
$envFile = Join-Path $lab '.env.native'
$instance = 'cpv-lab-remetente-4306'
foreach ($f in @($keyFile,$bridgeFile,$envFile)) {
  if (-not (Test-Path $f)) { throw ('Configuração local pendente: '+(Split-Path $f -Leaf)) }
}
$secret = ([IO.File]::ReadAllText($keyFile)).Trim()
$bridge = ([IO.File]::ReadAllText($bridgeFile)).Trim()
if ($secret -notmatch '^[a-f0-9]{64}$' -or $bridge -notmatch '^[a-f0-9]{64}$') {
  throw 'Chaves privadas inválidas.'
}
$line = Get-Content $envFile | Where-Object { $_ -like 'GLOBAL_API_KEY=*' } | Select-Object -First 1
if (-not $line) { throw 'GLOBAL_API_KEY privada ausente.' }
$admin = $line.Substring('GLOBAL_API_KEY='.Length)
$headers = @{ apikey = $admin }
$api = 'http://127.0.0.1:4000'
$list = Invoke-RestMethod -Uri ($api+'/instance/all') -Headers $headers -TimeoutSec 9
$found = @($list.data | Where-Object { $_.name -eq $instance })
if ($found.Count -ne 1) { throw 'A instância de testes não foi identificada.' }
$x = $found[0]
if ($x.connected -ne $true) { Write-Output 'INSTANCIA_DESCONECTADA: apenas webhook será configurado; não reconectar.' }
$phone = [string]$x.jid
$expectedFile = Join-Path $lab 'private\remetente-autorizado-jid.txt'
if (-not (Test-Path $expectedFile)) { throw 'Identidade autorizada não foi preservada.' }
$expected = ([IO.File]::ReadAllText($expectedFile)).Trim()
if ($phone -ne $expected -or $phone -notmatch '^55[0-9]{10,11}(?::[0-9]+)?@s\.whatsapp\.net$') {
  throw 'A conta conectada não corresponde ao remetente previamente autorizado.'
}
foreach ($pt in @(3045,4000,4011)) {
  if (-not (Get-NetTCPConnection -LocalPort $pt -State Listen -ErrorAction SilentlyContinue)) {
    throw ('Serviço local indisponível na porta '+$pt)
  }
}
$status = Invoke-RestMethod -Uri 'http://127.0.0.1:4011/status' -TimeoutSec 4
if (-not $status.active) { throw 'Monitor não responde.' }
$health = Invoke-RestMethod -Uri 'http://127.0.0.1:3045/api/local/whatygo/respostas' -TimeoutSec 4
if (-not $health.ok) { throw 'A Central ainda não possui a integração.' }
Write-Output ('INSTANCIA_VERIFICADA=SIM')
Write-Output ('REMETENTE_FINAL=1632')
Write-Output ('CENTRAL_E_MONITOR=PRONTOS')
if (-not $Aplicar) {
  Write-Output 'PRÉVIA: não foi alterado o webhook. Use -Aplicar para atualizar.'
  exit 0
}
$webhookUrl = 'http://127.0.0.1:4011/webhook?key='+$secret
$body = @{ webhookUrl = $webhookUrl; subscribe = @('BUTTON_CLICK','SEND_MESSAGE','CONNECTION') } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Put -Uri ($api+'/instance/'+$x.id+'/integrations') -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 12 | Out-Null
Write-Output 'WEBHOOK_AUTENTICADO_CONFIGURADO'
Write-Output 'EVENTOS_ASSINADOS_LOGICAMENTE_POR_SEGREDO_LOCAL'
Write-Output 'NENHUM_ENVIO_REAL_EFETUADO'
