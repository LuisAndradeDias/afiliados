[CmdletBinding()]
param([string]$UrlProduto,[switch]$ConfirmarTesteManual,[switch]$VerificarDestino)
$ErrorActionPreference='Stop'

# Nunca executar por engano nem a partir de agendador.
if(-not $ConfirmarTesteManual -or [string]::IsNullOrWhiteSpace($UrlProduto)){
  Write-Output 'EXECUTION_REFUSED: requires -ConfirmarTesteManual and -UrlProduto'
  exit 3
}

$base='http://127.0.0.1:3030'
$confirmacao='TESTE_LINK_SEM_ENVIO'
$jobId=''
$completed=$false

function Read-State {
  return Invoke-RestMethod -Uri ($base+'/api/status') -Method GET -TimeoutSec 6
}
function Post-Action([string]$action,[string]$product=''){
  $body=@{action=$action;confirmacao=$confirmacao}
  if($product){
    $body.urlProduto=$product
    $body.verificarDestino=$VerificarDestino.IsPresent
  }
  return Invoke-RestMethod -Uri ($base+'/api/action') -Method POST -ContentType 'application/json' -Headers @{Origin=$base} -Body ($body|ConvertTo-Json -Compress) -TimeoutSec 8
}
$state=Read-State
if($state.operacaoEstado -ne 'paused' -or
   $state.whatsappAutoEnvioAtivo -or $state.whatsappEnvioPendente -or
   $state.mercadoLivreMonitorAtivo -or $state.monitorAlternadoAtivo -or
   $null -ne $state.mercadoLivreLinkJob -or
   $null -ne $state.mercadoLivreTesteLinkJob -or
   -not $state.mercadoLivreExtensionConectada -or
   @($state.executando).Count -gt 0){
  throw 'TEST_NOT_STARTED: panel, WhatsApp or extension state is unsafe'
}
foreach($f in @(
 'C:\projeto02\data\ultima-oferta-mercadolivre.json',
 'C:\projeto02\data\ultima-mensagem-whatsapp.txt',
 'C:\projeto02\data\ultima-oferta-whatsapp.json'
)){
  if(Test-Path -LiteralPath $f){throw 'TEST_NOT_STARTED: existing offer/message must not be replaced'}
}
Write-Output 'SAFE_TEST_START: ONE_MANUAL_URL NO_WHATSAPP NO_OFFER_FILE'
try {
  $request=Post-Action 'mercadolivre-link-diagnostico' $UrlProduto
  if(-not $request.ok){throw 'Panel rejected controlled test'}
  $initial=Read-State
  $jobId=[string]$initial.mercadoLivreTesteLinkJob.id
  if($jobId.Length -lt 10 -or $initial.mercadoLivreTesteLinkJob.status -ne 'pending'){
    throw 'Test job was not acknowledged'
  }
  Write-Output 'DIAGNOSTIC_JOB=CREATED; EXTENSION=WAITING'
  $deadline=[DateTime]::UtcNow.AddSeconds(123)
  $lastStatus=''
  while([DateTime]::UtcNow -lt $deadline){
    Start-Sleep -Seconds 2
    $status=Read-State
    $job=$status.mercadoLivreTesteLinkJob
    if([string]$job.id -ne $jobId){throw 'Test job replaced unexpectedly'}
    if($job.status -ne $lastStatus){
      $lastStatus=[string]$job.status
      Write-Output ('DIAGNOSTIC_JOB_STATUS='+$lastStatus)
    }
    if($job.status -in @('done','error')){$completed=$true;break}
  }
  if(-not $completed){throw 'Diagnostic timeout; no link confirmed'}
  if($lastStatus -ne 'done'){
    $message=[string](Read-State).mercadoLivreTesteLinkJob.mensagem
    $category=if($message -match '(?i)gerar desabilitado|bot.o gerar'){'GENERATE_BUTTON_DISABLED'}
      elseif($message -match '(?i)campo|textarea'){'URL_INPUT_NOT_FOUND'}
      elseif($message -match '(?i)etiqueta'){'AFFILIATE_TAG'}
      elseif($message -match '(?i)link oficial|n.o exibiu'){'LINK_RESULT_MISSING'}
      elseif($message -match '(?i)expirou|timeout'){'TIMEOUT'}
      else{'OTHER'}
    Write-Output ('TECHNICAL_LINK_RESULT=FAILED CATEGORY='+$category)
  }else{
    Write-Output 'TECHNICAL_LINK_RESULT=OFFICIAL_URL_RECOGNIZED'
    if($VerificarDestino){
      $destino='verificando'
      # HEAD e GET podem consumir tempo por salto; nao relatar pendente prematuramente.
      for($i=0;$i -lt 28;$i++){
        $atual=Read-State
        $destino=[string]$atual.mercadoLivreTesteLinkJob.destinoStatus
        if($destino -ne 'verificando'){break}
        Start-Sleep -Seconds 1
      }
      $reason=[string]$atual.mercadoLivreTesteLinkJob.destinoMotivo
      $reasonCode=switch($reason){
        'redirecionamento identificou o mesmo catalogo' {'CATALOG_MATCH'}
        'redirecionamento identificou catalogo diferente' {'CATALOG_MISMATCH'}
        'redirecionamento para dominio nao permitido' {'UNAPPROVED_DOMAIN'}
        'site nao permitiu validar redirecionamento' {'NETWORK_OR_ACCESS_BLOCKED'}
        'destino nao foi exposto por redirecionamento' {'NO_HTTP_REDIRECT'}
        'redirecionamento ciclico' {'REDIRECT_LOOP'}
        'limite de redirecionamentos atingido' {'TOO_MANY_REDIRECTS'}
        default {'OTHER_OR_PENDING'}
      }
      Write-Output ('DESTINATION_STATUS='+$destino)
      Write-Output ('DESTINATION_REASON_CODE='+$reasonCode)
      Write-Output 'AFFILIATE_ATTRIBUTION_PROVEN=false'
    }else{
      Write-Output 'DESTINATION_STATUS=NOT_CHECKED'
    }
    Write-Output 'STOCK_CHECKED=false OFFER_SAVED=false WHATSAPP_SENT=false'
  }
}finally{
  if($jobId){
    try{
      $current=Read-State
      if([string]$current.mercadoLivreTesteLinkJob.id -eq $jobId){
        $null=Post-Action 'mercadolivre-link-diagnostico-limpar'
        Write-Output 'DIAGNOSTIC_JOB_CLEANED=true'
      }else{Write-Output 'DIAGNOSTIC_JOB_CLEANUP=SKIPPED_UNEXPECTED_STATE'}
    }catch{Write-Output 'DIAGNOSTIC_JOB_CLEANUP=REQUIRES_REVIEW'}
  }
  $after=Read-State
  Write-Output ('FINAL_AUTO_SEND_OFF='+(-not $after.whatsappAutoEnvioAtivo)+
    ' FINAL_MONITORS_OFF='+(-not $after.mercadoLivreMonitorAtivo -and -not $after.monitorAlternadoAtivo)+
    ' WHATSAPP_PENDING='+[bool]$after.whatsappEnvioPendente+
    ' OFFER_FILE_ABSENT='+(-not(Test-Path 'C:\projeto02\data\ultima-oferta-mercadolivre.json')))
}
