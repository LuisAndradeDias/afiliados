$ErrorActionPreference='Stop'
$dados=Join-Path ((Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path) 'dados\previa-acer'
$confFile=Join-Path $dados 'denuncias-netlify-config.json'
if(!(Test-Path -LiteralPath $confFile)){throw 'Configuração local do Netlify não encontrada.'}
$config=Get-Content -LiteralPath $confFile -Raw | ConvertFrom-Json
$url=([string]$config.publicBaseUrl).TrimEnd('/')
$secret=[string]$config.segredo
if($url -ne 'https://cacapromosdenuncias.netlify.app' -or
   $secret -notmatch '^[a-fA-F0-9]{64}$') {
  throw 'Endereço ou chave local não correspondem à instalação conhecida.'
}
$pagina=Invoke-WebRequest -Uri ($url+'/nao-tenho-interesse/') -UseBasicParsing -TimeoutSec 14
if($pagina.StatusCode -ne 200 -or $pagina.Content -notmatch '/assets/recusar.js' -or
   $pagina.Content -notmatch 'confirmarRecusa') {
  throw 'Página Não tenho interesse ainda não foi publicada no Netlify.'
}
$script=Invoke-WebRequest -Uri ($url+'/assets/recusar.js') -UseBasicParsing -TimeoutSec 14
if($script.StatusCode -ne 200 -or $script.Content -notmatch '/api/recusar'){
  throw 'O código público de recusa ainda não foi publicado.'
}
$http=0
try{
  $test=Invoke-WebRequest -Uri ($url+'/api/recusar') -Method Post -ContentType 'application/json' -Headers @{Origin=$url} -Body '{"token":"invalido"}' -UseBasicParsing -TimeoutSec 14
  $http=[int]$test.StatusCode
}catch{
  if(!$_.Exception.Response){throw}
  $http=[int]$_.Exception.Response.StatusCode
}
if($http -ne 404){
  throw ('A função /api/recusar não está ativa (HTTP '+$http+').')
}
$queue=Invoke-RestMethod -Uri ($url+'/api/denuncias-pendentes') -Headers @{Authorization=('Bearer '+$secret)} -TimeoutSec 16
if($queue.ok -ne $true){throw 'Sincronização autenticada com Netlify indisponível.'}
$backupDir=Join-Path $dados 'backups-privados'
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$dest=Join-Path $backupDir ('config-antes-recusa-'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff')+'.json')
Copy-Item -LiteralPath $confFile -Destination $dest -ErrorAction Stop
if((Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash -ne
   (Get-FileHash -LiteralPath $confFile -Algorithm SHA256).Hash){
  throw 'Backup da configuração divergente.'
}
if($config.PSObject.Properties['recusaAtiva']){
  $config.recusaAtiva=$true
}else{
  $config|Add-Member -NotePropertyName recusaAtiva -NotePropertyValue $true
}
$json=$config|ConvertTo-Json -Compress
[System.IO.File]::WriteAllText($confFile,$json,[System.Text.UTF8Encoding]::new($false))
Write-Output 'NETLIFY_RECUSA_ATIVA=SIM'
Write-Output 'POST_TOKEN_INVALIDO_HTTP=404'
Write-Output 'CONFIGURACAO_BACKUP=SIM'
Write-Output 'SEGREDO_OMITIDO_DA_SAIDA=SIM'
Write-Output 'REINICIE_O_PAINEL_3045_APOS_VERIFICAR_QUE_NAO_HA_ENVIO_ATIVO'
