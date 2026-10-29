[CmdletBinding()]
param([switch]$ConfirmarTesteManual)
$ErrorActionPreference='Stop'
if(-not $ConfirmarTesteManual){
  Write-Output 'EXECUTION_REFUSED: supply -ConfirmarTesteManual only with user authorization and a paused runtime'
  exit 3
}
$root='C:\projeto02'
$offerFile=Join-Path $root 'data\ultima-oferta-mercadolivre.json'
$whatsMsg=Join-Path $root 'data\ultima-mensagem-whatsapp.txt'
$whatsOffer=Join-Path $root 'data\ultima-oferta-whatsapp.json'
$lock=Join-Path $root 'data\etapa50-link-controlado.lock'
$panel='http://127.0.0.1:3030'
$createdOffer=$false
$terminal=$false
$jobId=''
$catalogID=''
$officialValidated=$false
function Get-Panel { Invoke-RestMethod -Uri ($panel+'/api/status') -Method GET -TimeoutSec 7 -ErrorAction Stop }
function Validate-Paused([object]$state){
  if($state.operacaoEstado -ne 'paused' -or $state.whatsappAutoEnvioAtivo -or
    $state.whatsappEnvioPendente -or $state.mercadoLivreMonitorAtivo -or
    $state.monitorAlternadoAtivo -or @($state.executando).Count -ne 0){
    throw 'Runtime is not safely paused'
  }
}
if(!(Test-Path -LiteralPath $root -PathType Container)){throw 'Main installation absent'}
if(Test-Path -LiteralPath $offerFile){throw 'Existing ML offer: test refused'}
if(Test-Path -LiteralPath $lock){throw 'Another link test already running'}
if((Test-Path $whatsMsg) -or (Test-Path $whatsOffer)){throw 'Pending WhatsApp preparation: test refused'}
$state=Get-Panel
Validate-Paused $state
if($null -ne $state.mercadoLivreLinkJob){throw 'Existing link job: test refused'}
if(-not $state.mercadoLivreExtensionConectada){throw 'Extension heartbeat absent'}
$lines=@([IO.File]::ReadAllLines((Join-Path $root '.env')) | Where-Object { $_ -match '^MERCADOLIVRE_ACCESS_TOKEN=' })
if($lines.Count -ne 1){throw 'Access token not uniquely configured'}
$token=$lines[0].Substring('MERCADOLIVRE_ACCESS_TOKEN='.Length).Trim().Trim('"')
if($token.Length -lt 12){throw 'Access token invalid'}
$headers=@{Authorization=('Bearer '+$token);Accept='application/json'}
Write-Output 'PREFLIGHT=PASS; AUTO_ACTIONS=OFF; OFFER=ABSENT; EXTENSION_HEARTBEAT=PRESENT'
try{
  $response=Invoke-WebRequest -Method GET -Uri 'https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=fone%20bluetooth&limit=8&offset=0' -UseBasicParsing -Headers $headers -TimeoutSec 15 -MaximumRedirection 0 -ErrorAction Stop
  if($response.StatusCode -ne 200){throw 'Catalog HTTP not 200'}
  $products=@(($response.Content|ConvertFrom-Json).results | Where-Object { $_.id -match '^MLB[0-9]+$' -and $_.status -eq 'active' } | Select-Object -First 8)
  if($products.Count -eq 0){throw 'No active catalog product found'}
  # Catalog status active does not prove a customer can buy. Require
  # one new priced listing matching the winning item, with positive stock.
  $checked=0
  $winningItem=$null
  $stock=0
  foreach($candidate in $products){
    $checked++
    Start-Sleep -Milliseconds 900
    try{
      $details=Invoke-WebRequest -Method GET -UseBasicParsing -Headers $headers -TimeoutSec 12 -MaximumRedirection 0 -ErrorAction Stop -Uri ('https://api.mercadolibre.com/products/'+[Uri]::EscapeDataString([string]$candidate.id)+'/items')
      $listings=@(($details.Content|ConvertFrom-Json).results | Where-Object {
        $_.item_id -match '^MLB[0-9]+$' -and $_.price -gt 0 -and
        $_.seller_id -gt 0 -and $_.condition -eq 'new'
      })
      if($details.StatusCode -ne 200 -or $listings.Count -eq 0){continue}
      Start-Sleep -Milliseconds 900
      $catalogResponse=Invoke-WebRequest -Method GET -UseBasicParsing -Headers $headers -TimeoutSec 12 -MaximumRedirection 0 -ErrorAction Stop -Uri ('https://api.mercadolibre.com/products/'+[Uri]::EscapeDataString([string]$candidate.id))
      $catalog=$catalogResponse.Content | ConvertFrom-Json -ErrorAction Stop
      $winner=$catalog.buy_box_winner
      if($catalogResponse.StatusCode -ne 200 -or $catalog.id -ne $candidate.id -or
        $catalog.status -ne 'active' -or -not $winner -or
        $winner.available_quantity -le 0 -or $winner.price -le 0){continue}
      foreach($listing in $listings){
        if($listing.item_id -eq $winner.item_id -and
          $listing.seller_id -eq $winner.seller_id -and
          [math]::Abs($listing.price-$winner.price) -le 0.01 -and
          ($null -eq $listing.available_quantity -or $listing.available_quantity -gt 0)){
          $winningItem=$listing
          $stock=[double]$winner.available_quantity
          $catalogID=[string]$candidate.id
          Write-Output ('TEST_CATALOG=VERIFIED_WINNER_AND_STOCK; CHECKED='+$checked)
          break
        }
      }
      if($catalogID){break}
    }catch{
      $code=0
      if($_.Exception.Response){$code=[int]$_.Exception.Response.StatusCode}
      if($code -eq 429){throw 'Rate limited; test aborted without retry'}
      if($code -eq 401 -or $code -eq 403){throw 'Catalog availability authorization failed; test aborted'}
    }
  }
  if(-not $catalogID -or -not $winningItem -or $stock -le 0){
    throw 'No purchasable catalog with confirmed winning item and stock; refusing link test'
  }
  $offer=[ordered]@{
    plataforma='Mercado Livre'
    produtoId=$catalogID
    anuncioId=[string]$winningItem.item_id
    vendedorId=[double]$winningItem.seller_id
    estoqueDisponivel=$stock
    disponibilidadeConfirmada=$true
    disponibilidadeVerificadaEm=[DateTime]::UtcNow.ToString('o')
    titulo='TESTE TECNICO INTERNO - NAO PUBLICAR'
    precoAtual=[double]$winningItem.price
    descontoPercentual=0
    categoria='teste tecnico da extensao'
    urlProduto=('https://www.mercadolivre.com.br/p/'+$catalogID)
    encontradoEm=[DateTime]::UtcNow.ToString('o')
    etapa50TesteControlado=$true
  }
  $bytes=[Text.UTF8Encoding]::new($false).GetBytes(($offer|ConvertTo-Json -Depth 6))
  $stream=[IO.File]::Open($offerFile,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try{$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
  $createdOffer=$true
  [IO.File]::WriteAllText($lock,'Controlled test: no WhatsApp',[Text.UTF8Encoding]::new($false))
  Validate-Paused (Get-Panel)
  Write-Output 'TEMP_OFFER=CREATED_FOR_LINK_TEST_ONLY; ACTION=REQUEST_OFFICIAL_LINK'
  $request=Invoke-RestMethod -Uri ($panel+'/api/action') -Method POST -ContentType 'application/json' -Body '{"action":"mercadolivre-link-auto"}' -TimeoutSec 8 -ErrorAction Stop
  if(-not $request.ok){throw 'Panel rejected link job'}
  $first=Get-Panel
  $jobId=[string]$first.mercadoLivreLinkJob.id
  if($jobId.Length -lt 10){throw 'Link job ID was not created'}
  Write-Output 'LINK_JOB=CREATED; WAITING_FOR_EXTENSION_AND_OFFICIAL_PORTAL'
  $deadline=[DateTime]::UtcNow.AddSeconds(110)
  $previous=''
  $start=[DateTime]::UtcNow
  while([DateTime]::UtcNow -lt $deadline){
    Start-Sleep -Seconds 2
    $status=Get-Panel
    if([string]$status.mercadoLivreLinkJob.id -ne $jobId){throw 'Job was replaced'}
    $jobStatus=[string]$status.mercadoLivreLinkJob.status
    if($jobStatus -ne $previous){Write-Output ('LINK_STATUS='+$jobStatus);$previous=$jobStatus}
    if($jobStatus -in @('done','error')){$terminal=$true;break}
    $elapsed=[int](([DateTime]::UtcNow-$start).TotalSeconds)
    if($elapsed % 20 -lt 2){Write-Output ('WAIT_SECONDS='+$elapsed)}
  }
  if(-not $terminal){throw 'Extension did not finish in 110 seconds'}
  if($previous -ne 'done'){
    $errorText=[string]((Get-Panel).mercadoLivreLinkJob.mensagem)
    $type=if($errorText -match '(?i)Gerador de Links|bot.o gerador'){'GENERATOR_NOT_FOUND'}
      elseif($errorText -match '(?i)campo'){'FIELD_NOT_FOUND'}
      elseif($errorText -match '(?i)etiqueta'){'AFFILIATE_LABEL_REQUIRED'}
      elseif($errorText -match '(?i)link oficial|n.o exibiu'){'OFFICIAL_LINK_MISSING'}
      elseif($errorText -match '(?i)aba|login|entrar'){'PORTAL_SESSION_OR_TAB'}
      else{'OTHER'}
    Write-Output ('LINK_GENERATION=FAILED ERROR_CATEGORY='+$type)
  }else{
    $saved=Get-Content -LiteralPath $offerFile -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
    if([string]$saved.produtoId -ne $catalogID -or $saved.etapa50TesteControlado -ne $true){throw 'Unexpected saved offer identity'}
    $parsed=$null
    if(-not [Uri]::TryCreate([string]$saved.urlAfiliado,[UriKind]::Absolute,[ref]$parsed)){throw 'Affiliate URL invalid'}
    $hostName=$parsed.Host.ToLowerInvariant()
    $official=($hostName -eq 'meli.la' -or $hostName.EndsWith('.meli.la') -or
      (($hostName -eq 'mercadolivre.com.br' -or $hostName.EndsWith('.mercadolivre.com.br')) -and $parsed.AbsolutePath -match '^/sec(?:/|$)'))
    if($parsed.Scheme -ne 'https' -or -not $official){throw 'Unexpected referral link host or protocol'}
    $officialValidated=$true
    Write-Output 'LINK_GENERATION=SUCCESS; OFFICIAL_HTTPS_DOMAIN=VERIFIED; LINK_NOT_PRINTED=true'
  }
}finally{
  $token=$null;$headers=$null
  if($jobId -and -not $terminal){
    try{
      $current=Get-Panel
      if([string]$current.mercadoLivreLinkJob.id -eq $jobId -and
          [string]$current.mercadoLivreLinkJob.status -in @('pending','running')){
        $body=@{id=$jobId;error='Teste tecnico encerrado sem publicar'}|ConvertTo-Json
        $null=Invoke-RestMethod -Method POST -Uri ($panel+'/api/mercadolivre/link-result') -ContentType 'application/json' -Body $body -TimeoutSec 5
        Write-Output 'UNFINISHED_JOB=MARKED_ERROR_AND_HIDDEN_FROM_POLLING'
        Start-Sleep -Seconds 2
      }
    }catch{Write-Output 'UNFINISHED_JOB_CANCELLATION=REQUIRES_REVIEW'}
  }
  if($createdOffer -and (Test-Path $offerFile)){
    $canRemove=$false
    try{
      $saved=Get-Content -LiteralPath $offerFile -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
      $canRemove=$saved.etapa50TesteControlado -eq $true -and [string]$saved.produtoId -eq $catalogID
    }catch{}
    if($canRemove){Remove-Item -LiteralPath $offerFile -Force -ErrorAction Stop;Write-Output 'TEMP_TEST_OFFER=REMOVED'}
    else{Write-Output 'TEMP_TEST_OFFER_CHANGED=RETAINED_FOR_REVIEW'}
  }
  if(Test-Path $lock){Remove-Item -LiteralPath $lock -Force}
  if((Test-Path $whatsMsg) -or (Test-Path $whatsOffer)){Write-Output 'ALERT_WHATSAPP_PREPARATION_APPEARED'}
  $after=Get-Panel
  Write-Output ('POSTCHECK_MONITORS_OFF='+(-not $after.mercadoLivreMonitorAtivo -and -not $after.monitorAlternadoAtivo)+
    ' AUTO_SEND_OFF='+(-not $after.whatsappAutoEnvioAtivo)+
    ' WHATSAPP_PENDING='+[bool]$after.whatsappEnvioPendente+
    ' OFFICIAL_LINK_VERIFIED='+$officialValidated)
}
