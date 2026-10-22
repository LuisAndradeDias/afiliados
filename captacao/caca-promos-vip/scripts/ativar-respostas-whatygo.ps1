$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$entry=Join-Path $root 'src\server.mjs'
$preview=Join-Path $root 'dados\previa-acer'
if(-not(Test-Path (Join-Path $preview 'chave-admin.txt'))){
  throw 'Dados esperados da Central 3045 não encontrados. Não reiniciar.'
}
function CheckUrl([string]$url) {
  try {$response=Invoke-WebRequest -Uri $url -TimeoutSec 4 -UseBasicParsing;return $response.StatusCode -eq 200}
  catch {return $false}
}
if(CheckUrl 'http://127.0.0.1:3045/api/local/whatygo/respostas'){
  Write-Output 'CENTRAL_ALREADY_UPDATED'
  exit 0
}
$w=Invoke-RestMethod 'http://127.0.0.1:3045/api/local/campanhas/convite/whatsapp/estado' -TimeoutSec 5
$c=Invoke-RestMethod 'http://127.0.0.1:3045/api/local/campanhas/convite/whatsapp/conexao/estado' -TimeoutSec 5
if($w.estado.processoAtivo -or $w.estado.ocupado -or $c.estado.ocupado -or
   $w.estado.fase -notin @('inativo','parado','desconectado')){
  throw 'Envio ou conexão WhatsApp em andamento. Não reiniciar.'
}
$listener=Get-NetTCPConnection -State Listen -LocalPort 3045 -ErrorAction Stop|Where-Object {$_.LocalAddress -eq '127.0.0.1'}|Select-Object -First 1
if(-not $listener){throw 'Central original 3045 não encontrada em loopback.'}
$proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+$listener.OwningProcess)
if($proc.Name -ne 'node.exe' -or $proc.CommandLine -notlike '*caca-promos-vip\src\server.mjs*'){
  throw 'Processo inesperado na porta 3045; não interromper.'
}
$node=$proc.ExecutablePath
if(-not(Test-Path $node)){throw 'Node.js original não encontrado.'}
$env:PORT='3045'
$env:HOST='127.0.0.1'
$env:DATA_DIR=$preview
if(-not $env:WA_META_ENABLE_SENDING){$env:WA_META_ENABLE_SENDING='false'}
Write-Output 'STOPPING_ONLY_CENTRAL_3045'
Stop-Process -Id $proc.ProcessId -ErrorAction Stop
$freed=$false
for($i=0;$i -lt 40;$i++){
  Start-Sleep -Milliseconds 250
  if(-not(Get-NetTCPConnection -State Listen -LocalPort 3045 -ErrorAction SilentlyContinue)){$freed=$true;break}
}
if(-not $freed){throw 'A porta 3045 não foi liberada; não substituir outros processos.'}
$stdout=Join-Path $preview 'campanhas-servidor.log'
$stderr=Join-Path $preview 'campanhas-erros.log'
$new=Start-Process -FilePath $node -ArgumentList ('"'+$entry+'"') -WorkingDirectory $root -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
$healthy=$false
for($i=0;$i -lt 50;$i++){
  Start-Sleep -Milliseconds 250
  if($new.HasExited){throw ('Central falhou na partida. Consulte '+$stderr)}
  if((CheckUrl 'http://127.0.0.1:3045/api/local/whatygo/respostas') -and
     (CheckUrl 'http://127.0.0.1:3045/inicio') -and
     (CheckUrl 'http://127.0.0.1:3045/respostas-botoes')){
    $healthy=$true;break
  }
}
if(-not $healthy){throw 'Nova Central iniciou, mas rotas não ficaram prontas.'}
Write-Output ('CENTRAL_PID='+$new.Id)
Write-Output 'CENTRAL_3045_OLD_AND_NEW_ROUTES_HTTP_200'
Write-Output 'DADOS_PREVIA_ACER_PRESERVADOS'
Write-Output 'NENHUM_ENVIO_EXECUTADO'
