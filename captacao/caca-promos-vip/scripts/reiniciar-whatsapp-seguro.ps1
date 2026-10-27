param([switch]$NoBrowser)
$ErrorActionPreference='Stop'
try {
  $root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  $entry=Join-Path $root 'src\server.mjs'
  $data=Join-Path $root 'dados\previa-acer'
  $base='http://127.0.0.1:3045'
  if(!(Test-Path -LiteralPath $entry) -or !(Test-Path -LiteralPath $data)){
    throw 'Instalacao local incompleta. Nada foi alterado.'
  }
  $listener=@(Get-NetTCPConnection -LocalPort 3045 -State Listen -ErrorAction SilentlyContinue)
  if($listener.Count -gt 1){throw 'Mais de um processo escuta na porta 3045. Reinicio nao executado.'}
  $antigo=$null
  $pre=@{contatos=$null;filas=$null;ocorrencias=$null}
  if($listener.Count -eq 1){
    $pidServidor=$listener[0].OwningProcess
    $antigo=Get-CimInstance Win32_Process -Filter ('ProcessId='+$pidServidor)
    if(!$antigo -or $antigo.Name -ne 'node.exe' -or
       $antigo.CommandLine -notlike '*caca-promos-vip*server.mjs*'){
      throw 'Porta 3045 ocupada por um processo que nao e o servidor esperado.'
    }
    $worker=(Invoke-RestMethod ($base+'/api/local/campanhas/convite/whatsapp/estado') -TimeoutSec 8).estado
    $conexao=(Invoke-RestMethod ($base+'/api/local/campanhas/convite/whatsapp/conexao/estado') -TimeoutSec 8).estado
    if($worker.processoAtivo -or $worker.ocupado -or $conexao.ocupado){
      throw ('Uma conversa do WhatsApp continua aberta ('+$worker.fase+'). '+
        'Confira no WhatsApp se a mensagem realmente apareceu. Feche a janela do Chrome controlado '+
        'para liberar a sessao sem disparar outra mensagem. Depois execute este atalho novamente. '+
        'NENHUM processo ou mensagem foi alterado agora.')
    }
    $c=Invoke-RestMethod ($base+'/api/local/gestao/contatos') -TimeoutSec 8
    $f=Invoke-RestMethod ($base+'/api/local/campanhas/convite/filas') -TimeoutSec 8
    $o=Invoke-RestMethod ($base+'/api/local/gestao/denuncias') -TimeoutSec 8
    $pre=@{contatos=$c.resumo.total;filas=@($f.filas).Count;ocorrencias=@($o.ocorrencias).Count}
    if($o.sincronizacao.executando){throw 'Sincronizacao de denuncias em andamento. Nada foi reiniciado.'}
  }
  $backup=Join-Path $data 'backups-privados'
  New-Item -ItemType Directory -Path $backup -Force|Out-Null
  $stamp=Get-Date -Format 'yyyyMMdd-HHmmss-fff'
  foreach($name in @('contatos-autorizados.json','denuncias-bloqueios.json',
      'filas-convites-meta.json','modelo-convite-unico.json','denuncias-netlify-config.json')){
    $original=Join-Path $data $name
    if(!(Test-Path -LiteralPath $original)){throw ('Backup nao pode ser criado: '+$name)}
    $destination=Join-Path $backup ($stamp+'-correcao-whatsapp-'+$name)
    Copy-Item -LiteralPath $original -Destination $destination -ErrorAction Stop
    if((Get-FileHash $original -Algorithm SHA256).Hash -ne
       (Get-FileHash $destination -Algorithm SHA256).Hash){
      throw ('Backup divergiu: '+$name)
    }
  }
  Write-Output 'Backup privado verificado: todos os arquivos com SHA256 igual.'
  if($antigo){
    Stop-Process -Id $antigo.ProcessId -ErrorAction Stop
    $livre=$false
    for($i=0;$i -lt 50;$i++){
      if(!(Get-NetTCPConnection -LocalPort 3045 -State Listen -ErrorAction SilentlyContinue)){
        $livre=$true;break
      }
      Start-Sleep -Milliseconds 220
    }
    if(!$livre){throw 'Porta 3045 nao foi liberada. Reinicio interrompido.'}
  }
  $env:PORT='3045';$env:HOST='127.0.0.1';$env:DATA_DIR=$data
  $env:WA_META_ENABLE_SENDING='false'
  $stdout=Join-Path $data ($stamp+'-envio-seguro.log')
  $stderr=Join-Path $data ($stamp+'-envio-seguro-erros.log')
  $node=(Get-Command node -ErrorAction Stop).Source
  $servidor=Start-Process -FilePath $node -ArgumentList ('"'+$entry+'"') -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  $ok=$false
  for($i=0;$i -lt 60;$i++){
    Start-Sleep -Milliseconds 300
    if($servidor.HasExited){break}
    try {
      $req=Invoke-WebRequest ($base+'/enviar') -UseBasicParsing -TimeoutSec 3
      if($req.StatusCode -eq 200 -and $req.Content.Contains('id="quickCopyText"')){
        $ok=$true;break
      }
    }catch{}
  }
  if(!$ok){throw 'Novo painel nao iniciou corretamente. Confira o log local privado de erros.'}
  if($pre.contatos -ne $null){
    $c2=(Invoke-RestMethod ($base+'/api/local/gestao/contatos') -TimeoutSec 8).resumo
    $f2=(Invoke-RestMethod ($base+'/api/local/campanhas/convite/filas') -TimeoutSec 8).filas
    $o2=(Invoke-RestMethod ($base+'/api/local/gestao/denuncias') -TimeoutSec 8).ocorrencias
    if($c2.total -ne $pre.contatos -or @($f2).Count -ne $pre.filas -or @($o2).Count -ne $pre.ocorrencias){
      throw 'Conferir dados: os contadores do cadastro ou historico mudaram apos reiniciar.'
    }
  }
  Write-Output 'CORRECAO ATIVA: painel atualizado, nenhum WhatsApp enviado, cadastro e historico preservados.'
  Write-Output ($base+'/enviar')
  if(!$NoBrowser){Start-Process ($base+'/enviar')}
  exit 0
}catch{
  Write-Error $_.Exception.Message
  exit 1
}
