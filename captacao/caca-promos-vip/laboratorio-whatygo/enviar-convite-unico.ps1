param([switch]$Enviar)
$ErrorActionPreference='Stop'
$base=$PSScriptRoot
$private=Join-Path $base 'private'
$api='http://127.0.0.1:4000'
$tokenFile=Join-Path $private 'instancia-remetente-4306.token'
$senderJidFile=Join-Path $private 'remetente-autorizado-jid.txt'
$destinationFile=Join-Path $private 'numero-destinatario-teste.txt'
$envFile=Join-Path $base '.env.native'
$lockFile=Join-Path $private 'convite-um-unico-envio.lock'
$name='cpv-lab-remetente-4306' # Nome historico da instancia; o numero secundario sera o destinatario
foreach($f in @($tokenFile,$senderJidFile,$destinationFile,$envFile)){if(-not(Test-Path $f)){throw 'Configuracao privada incompleta.'}}
$token=([IO.File]::ReadAllText($tokenFile)).Trim()
$expectedJid=([IO.File]::ReadAllText($senderJidFile)).Trim()
$destination=([IO.File]::ReadAllText($destinationFile)).Trim()
if($destination -ne '5522998024306'){throw 'Destino nao autorizado. Envio bloqueado.'}
if($expectedJid -notmatch '^([0-9]+)(?::[0-9]+)?@s\.whatsapp\.net$'){throw 'Identificador da conta remetente invalido.'}
$senderDigits=$Matches[1]
if($senderDigits -ne '5522999931632'){throw 'Remetente nao corresponde ao WhatsApp principal autorizado.'}
if($senderDigits -eq $destination){throw 'Remetente e destinatario sao iguais.'}
$payload=@{
  number=$destination
  title=('Convite Ca'+[char]0x00E7+'a Promos VIP '+[char]::ConvertFromUtf32(0x1F451))
  description=('Ol'+[char]0x00E1+'! Gostaria de participar do nosso grupo VIP e receber as melhores promo'+[char]0x00E7+[char]0x00F5+'es? Este '+[char]0x00E9+' um teste autorizado. Escolha uma op'+[char]0x00E7+[char]0x00E3+'o abaixo:')
  footer=('Ca'+[char]0x00E7+'a Promos VIP')
  buttons=@(
    @{type='reply';displayText='Entrar no grupo';id='aceitar_grupo'},
    @{type='reply';displayText=('N'+[char]0x00E3+'o tenho interesse');id='recusar_grupo'}
  )
}
Write-Output 'LAB WHATYGO - TESTE UNICO DE BOTOES'
Write-Output 'Remetente: conta atualmente vinculada a instancia de testes'
Write-Output ('Destinatario: ***'+$destination.Substring($destination.Length-4))
Write-Output 'Botoes: Entrar no grupo / Nao tenho interesse'
if(-not $Enviar){
  Write-Output 'PREVIA APENAS: nenhuma mensagem enviada.'
  exit 0
}
if(Test-Path $lockFile){throw 'Tentativa anterior ja registrada; nao reenviar.'}
$status=Invoke-RestMethod -Uri ($api+'/instance/status') -Headers @{apikey=$token} -TimeoutSec 8
if($status.data.connected -ne $true -or $status.data.loggedIn -ne $true){throw 'WhatsApp ainda nao esta conectado.'}
$line=Get-Content $envFile|Where-Object {$_ -like 'GLOBAL_API_KEY=*'}|Select-Object -First 1
if(-not $line){throw 'Chave admin local ausente.'}
$admin=$line.Substring('GLOBAL_API_KEY='.Length)
$instances=Invoke-RestMethod -Uri ($api+'/instance/all') -Headers @{apikey=$admin} -TimeoutSec 8
$matching=@($instances.data|Where-Object {$_.name -eq $name})
if($matching.Count -ne 1){throw 'Instancia inesperada ou duplicada.'}
$currentJid=([string]$matching[0].jid).Trim()
if($matching[0].connected -ne $true -or $currentJid -ne $expectedJid){throw 'A identidade da sessao mudou: envio bloqueado.'}
$currentToken=[string]$matching[0].token
if($currentToken -ne $token){throw 'Token e instancia nao coincidem.'}
$created=[IO.File]::Open($lockFile,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try {
  $info='Tentativa unica iniciada '+[DateTime]::UtcNow.ToString('o')+'Z; nao reenviar sem avaliacao manual.'
  $bytes=[Text.Encoding]::UTF8.GetBytes($info)
  $created.Write($bytes,0,$bytes.Length)
} finally { $created.Dispose() }
Write-Output 'Tentativa registrada; sem repeticao automatica.'
try {
  $r=Invoke-RestMethod -Method Post -Uri ($api+'/send/button') -Headers @{apikey=$token} -ContentType 'application/json' -Body ($payload|ConvertTo-Json -Depth 6 -Compress) -TimeoutSec 30
  Write-Output ('API_STATUS='+[string]$r.message)
  Write-Output ('API_MESSAGE_ID_PRESENT='+[bool]$r.data.Info.ID)
  Write-Output 'Confira no destinatario se os botoes aparecem e funcionam.'
}catch{
  Write-Output 'RESULTADO INCERTO: nao repetir. Verificar aparelho e logs.'
  throw 'Servico nao confirmou a mensagem.'
}
