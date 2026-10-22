param([switch]$Publicar,[switch]$Restaurar)
$ErrorActionPreference='Stop'
$base=$PSScriptRoot
$mgr=Join-Path $base '_upstream\manager'
$dist=Join-Path $mgr 'dist'
$stage=Join-Path $mgr 'dist-cpv-stage'
$backup=Join-Path $base 'runtime\manager-dist-before-custom'
$oldIndex=Join-Path $backup 'index.html'
$newIndex=Join-Path $stage 'index.html'
$liveIndex=Join-Path $dist 'index.html'
if($Publicar -and $Restaurar){throw 'Use somente -Publicar ou -Restaurar.'}
if($Restaurar){
  if(-not(Test-Path $oldIndex)){throw 'Backup de index.html nao encontrado.'}
  Copy-Item -LiteralPath $oldIndex -Destination $liveIndex -Force
  Write-Output 'INDEX_ORIGINAL_RESTAURADO. Atualize a aba com Ctrl+Shift+R.'
  exit 0
}
if(-not(Test-Path $newIndex)){throw 'Build stage ausente. Compile o Manager primeiro.'}
$contents=[IO.File]::ReadAllText($newIndex)
$pattern='src="/assets/(index-[^"]+\.js)"'
$match=[regex]::Match($contents,$pattern)
if(-not $match.Success){throw 'Indice novo nao tem bundle JS verificavel.'}
$js=$match.Groups[1].Value
$assetFile=Join-Path $stage ('assets\'+$js)
if(-not(Test-Path $assetFile)){throw 'Bundle referenciado pelo index nao existe.'}
$bundle=[IO.File]::ReadAllText($assetFile)
if(-not ($bundle.Contains('btn_custom_cpv') -and $bundle.Contains('aceitar_grupo'))){throw 'Build stage nao contem o convite personalizado.'}
Write-Output ('VERIFIED_BUNDLE='+$js)
Write-Output ('BUILD_HAS_EDITABLE_CPV_FIELDS=true')
if(-not $Publicar){
  Write-Output 'PREVIA_APROVADA: use -Publicar para aplicar. Nenhum arquivo ativo foi alterado.'
  exit 0
}
foreach($port in @(3045,4000,4011)){
  if(-not (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)){
    throw ('Servico de porta '+$port+' ausente; publicacao bloqueada.')
  }
}
if(-not(Test-Path $oldIndex)){
  New-Item -ItemType Directory -Force -Path $backup | Out-Null
  Copy-Item -Path (Join-Path $dist '*') -Destination $backup -Recurse -Force
  if(-not(Test-Path $oldIndex)){throw 'Backup nao foi criado.'}
}
$hashBefore=(Get-FileHash -LiteralPath $liveIndex -Algorithm SHA256).Hash
try{
  # Copy hashed assets first; existing sessions can continue using old hashes.
  Copy-Item -Path (Join-Path $stage 'assets\*') -Destination (Join-Path $dist 'assets') -Recurse -Force
  # Move the small HTML entry point last, after all of its assets exist.
  Copy-Item -LiteralPath $newIndex -Destination $liveIndex -Force
  $received=Invoke-WebRequest -Uri 'http://127.0.0.1:4000/manager' -UseBasicParsing -TimeoutSec 8
  if($received.StatusCode -ne 200 -or -not $received.Content.Contains($js)){throw 'Painel nao apresenta index novo.'}
  $asset=Invoke-WebRequest -Uri ('http://127.0.0.1:4000/assets/'+$js) -UseBasicParsing -TimeoutSec 12
  if($asset.StatusCode -ne 200 -or $asset.Content.Length -lt 400000){throw 'Bundle JS novo nao esta acessivel.'}
  $central=Invoke-WebRequest -Uri 'http://127.0.0.1:3045/' -UseBasicParsing -TimeoutSec 8
  if($central.StatusCode -ne 200){throw 'Central principal nao esta saudavel.'}
  $health=Invoke-RestMethod -Uri 'http://127.0.0.1:4000/health' -TimeoutSec 8
  if($health.status -ne 'ok'){throw 'WhatyGo nao esta saudavel.'}
  Write-Output ('LIVE_MANAGER_HTTP='+$received.StatusCode)
  Write-Output ('LIVE_BUNDLE_HTTP='+$asset.StatusCode)
  Write-Output ('CENTRAL_HTTP='+$central.StatusCode)
  Write-Output 'WHATYGO_HEALTH_OK'
  Write-Output ('OLD_INDEX_SHA256='+$hashBefore)
  Write-Output 'PAINEL_PERSONALIZADO_PUBLICADO: Ctrl+Shift+R no navegador.'
  Write-Output 'Nenhuma mensagem enviada por esta rotina.'
}catch{
  Copy-Item -LiteralPath $oldIndex -Destination $liveIndex -Force
  Write-Output 'ROLLBACK_AUTOMATICO_DO_INDEX'
  throw
}
