param([switch]$Enviar)
$ErrorActionPreference='Stop'
$base=$PSScriptRoot
$private=Join-Path $base 'private'
$api='http://127.0.0.1:4000'
$tokenFile=Join-Path $private 'instancia-remetente-4306.token'
$senderFile=Join-Path $private 'numero-remetente-teste.txt'
$destinationFile=Join-Path $private 'numero-destinatario-teste.txt'
$lockFile=Join-Path $private 'convite-um-unico-envio.lock'
foreach($file in @($tokenFile,$senderFile,$destinationFile)){
  if(-not(Test-Path $file)){throw 'Configuracao privada do laboratorio incompleta.'}
}
$token=([IO.File]::ReadAllText($tokenFile)).Trim()
$sender=([IO.File]::ReadAllText($senderFile)).Trim()
$destination=([IO.File]::ReadAllText($destinationFile)).Trim()
if($sender -notmatch '^55[0-9]{10,11}$' -or $destination -notmatch '^55[0-9]{10,11}$'){
  throw 'Formato de telefone invalido.'
}
if($sender -eq $destination){throw 'Remetente e destinatario nao podem ser iguais.'}
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
Write-Output 'LAB WHATYGO - ENVIO CONTROLADO'
Write-Output ('Remetente esperado: ***'+$sender.Substring($sender.Length-4))
Write-Output ('Destinatario permitido: ***'+$destination.Substring($destination.Length-4))
Write-Output 'Botoes: Entrar no grupo / Nao tenho interesse'
if(-not $Enviar){
  Write-Output 'MODO PREVIA: nenhuma mensagem foi enviada.'
  Write-Output 'Somente o parametro -Enviar permite uma tentativa.'
  exit 0
}
if(Test-Path $lockFile){throw 'Ja existe uma tentativa anterior. Sem reenvio automatico.'}
if(-not (Get-NetTCPConnection -State Listen -LocalPort 4000 -ErrorAction SilentlyContinue)){
  throw 'WhatyGo nao esta ativo.'
}
$status=Invoke-RestMethod -Uri ($api+'/instance/status') -Headers @{apikey=$token} -TimeoutSec 8
if($status.data.connected -ne $true -or $status.data.loggedIn -ne $true){
  throw 'Remetente secundario ainda nao esta conectado e autenticado.'
}
$jid=[string]$status.data.myJid
$current=(($jid -split '@')[0]) -replace '[^0-9]',''
if($current -ne $sender){throw 'A conta conectada nao corresponde ao remetente autorizado. ENVIO BLOQUEADO.'}
[IO.File]::WriteAllText($lockFile,('Tentativa iniciada UTC '+[DateTime]::UtcNow.ToString('o')+' - nao reenviar automaticamente'),(New-Object System.Text.UTF8Encoding($false)))
try{
  $response=Invoke-RestMethod -Method Post -Uri ($api+'/send/button') -Headers @{apikey=$token} -ContentType 'application/json' -Body ($payload|ConvertTo-Json -Depth 6 -Compress) -TimeoutSec 30
  Write-Output ('API_RESPONSE='+[string]$response.message)
  Write-Output 'Tentativa concluida. Confira no telefone e no monitor de cliques.'
}catch{
  Write-Output 'RESULTADO INCERTO: nao repetir o envio. Conferir no aparelho e em logs privados.'
  throw 'O servico nao confirmou a tentativa.'
}
