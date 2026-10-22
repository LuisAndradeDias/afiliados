$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dataDir=Join-Path $root 'dados\previa-acer'
$server=Join-Path $root 'src\server.mjs'
if(-not(Test-Path (Join-Path $dataDir 'chave-admin.txt'))){throw 'Dados privados 3045 ausentes.'}
foreach($f in @('src\respostas-botoes.mjs','src\whatygo-responder-link.mjs','src\gestao-ui.mjs','src\assets\respostas-botoes.js')){
  & node.exe --check (Join-Path $root $f)
  if($LASTEXITCODE -ne 0){throw ('Erro de sintaxe: '+$f)}
}
$before=Invoke-RestMethod 'http://127.0.0.1:3045/api/local/whatygo/respostas' -TimeoutSec 5
if(-not $before.ok){throw 'Não foi possível validar a Central anterior.'}
$previousAutomation=[bool]$before.automacao.habilitada
$unfinished=@($before.registros|Where-Object {$_.status -in @('auto-na-fila','auto-tentando')})
if($unfinished.Count){throw 'Há respostas automáticas em andamento; aguarde antes da publicação.'}
$state=Invoke-RestMethod 'http://127.0.0.1:3045/api/local/campanhas/convite/whatsapp/estado' -TimeoutSec 5
$conn=Invoke-RestMethod 'http://127.0.0.1:3045/api/local/campanhas/convite/whatsapp/conexao/estado' -TimeoutSec 5
if($state.estado.processoAtivo -or $state.estado.ocupado -or $conn.estado.ocupado -or $state.estado.fase -notin @('inativo','parado','desconectado')){
 throw 'Envio ou conexão WhatsApp em andamento: publicação cancelada.'
}
$listener=Get-NetTCPConnection -LocalPort 3045 -State Listen -ErrorAction Stop|Where-Object {$_.LocalAddress -eq '127.0.0.1'}|Select-Object -First 1
if(-not $listener){throw 'Central 3045 não está em loopback.'}
$old=Get-CimInstance Win32_Process -Filter ('ProcessId='+$listener.OwningProcess)
if($old.Name -ne 'node.exe' -or $old.CommandLine -notlike '*caca-promos-vip\src\server.mjs*'){
 throw 'Processo 3045 inesperado. Não interromper.'
}
if(-not(Test-Path $old.ExecutablePath)){throw 'Executável Node não localizado.'}
Write-Output 'STOPPING_CENTRAL_ONLY'
Stop-Process -Id $old.ProcessId -ErrorAction Stop
$free=$false
for($i=0;$i -lt 50;$i++){
 Start-Sleep -Milliseconds 200
 if(-not(Get-NetTCPConnection -LocalPort 3045 -State Listen -ErrorAction SilentlyContinue)){$free=$true;break}
}
if(-not $free){throw 'A porta 3045 não foi liberada.'}
$env:PORT='3045'
$env:HOST='127.0.0.1'
$env:DATA_DIR=$dataDir
$env:WA_META_ENABLE_SENDING='false'
$out=Join-Path $dataDir 'campanhas-servidor.log'
$err=Join-Path $dataDir 'campanhas-erros.log'
$new=Start-Process -FilePath $old.ExecutablePath -ArgumentList ('"'+$server+'"') -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
$online=$false
for($i=0;$i -lt 60;$i++){
 Start-Sleep -Milliseconds 200
 if($new.HasExited){throw 'Nova Central falhou; consulte o log privado de erros.'}
 try{
  $r=Invoke-RestMethod 'http://127.0.0.1:3045/api/local/whatygo/respostas' -TimeoutSec 3
  $ui=Invoke-WebRequest 'http://127.0.0.1:3045/respostas-botoes' -TimeoutSec 3 -UseBasicParsing
  $asset=Invoke-WebRequest 'http://127.0.0.1:3045/assets/respostas-botoes.js' -TimeoutSec 3 -UseBasicParsing
  if($r.ok -and [bool]$r.automacao.habilitada -eq $previousAutomation -and $ui.Content.Contains('rbAutoEnable') -and $asset.Content.Contains('/api/local/whatygo/automacao')){$online=$true;break}
 }catch{}
}
if(-not $online){throw 'Central ativa, mas rota de automação não respondeu como esperado.'}
Write-Output ('CENTRAL_PROCESS='+$new.Id)
Write-Output 'CENTRAL_3045_AUTOMATION_UI_AND_API_HTTP_200'
Write-Output ('AUTOMATION_STATE_PRESERVED='+$previousAutomation)
Write-Output 'WHATYGO_AND_POSTGRESQL_NOT_RESTARTED'
Write-Output 'NO_MESSAGES_SENT'
