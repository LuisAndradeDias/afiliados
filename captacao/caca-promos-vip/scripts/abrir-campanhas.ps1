param(
  [switch]$NoBrowser,
  [switch]$CadastroVoluntario
)
$ErrorActionPreference = 'Stop'
try {
  $root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  $entry = Join-Path $root 'src\server.mjs'
  if (!(Test-Path -LiteralPath $entry)) {
    throw 'Servidor do Caça Promos VIP não encontrado na pasta oficial.'
  }
  $node = (Get-Command node -ErrorAction Stop).Source
  $base = $null
  foreach ($porta in @(3045,3040)) {
    $url = 'http://127.0.0.1:' + $porta
    try {
      $resposta = Invoke-WebRequest ($url+'/campanhas') -UseBasicParsing -TimeoutSec 2
      if ($resposta.StatusCode -eq 200 -and $resposta.Content.Contains('id="singleText"')) {
        $base = $url
        break
      }
    } catch { }
  }

  if (!$base) {
    $dataTeste = Join-Path $root 'dados\previa-acer'
    $data = if (Test-Path -LiteralPath (Join-Path $dataTeste 'chave-admin.txt')) {
      $dataTeste
    } else {
      Join-Path $root 'dados'
    }
    $port = if ($data -eq $dataTeste) { 3045 } else { 3040 }
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
      throw ('A porta ' + $port + ' está ocupada por outro aplicativo. Nada foi encerrado.')
    }
    New-Item -ItemType Directory -Path $data -Force | Out-Null
    $env:PORT = [string]$port
    $env:HOST = '127.0.0.1'
    $env:DATA_DIR = $data
    if (!$env:WA_META_ENABLE_SENDING) { $env:WA_META_ENABLE_SENDING = 'false' }
    $saida = Join-Path $data 'campanhas-servidor.log'
    $erros = Join-Path $data 'campanhas-erros.log'
    $proc = Start-Process -FilePath $node -ArgumentList ('"'+$entry+'"') -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $saida -RedirectStandardError $erros -PassThru
    $base = 'http://127.0.0.1:' + $port
    $ok = $false
    for ($i=0; $i -lt 40; $i++) {
      Start-Sleep -Milliseconds 250
      if ($proc.HasExited) { break }
      try {
        $resposta = Invoke-WebRequest ($base+'/campanhas') -UseBasicParsing -TimeoutSec 2
        if ($resposta.StatusCode -eq 200 -and $resposta.Content.Contains('id="singleText"')) {
          $ok = $true
          break
        }
      } catch { }
    }
    if (!$ok) { throw ('O painel não iniciou. Consulte: '+$erros) }
  }

  $destino = if ($CadastroVoluntario) { '/c/instagram' } else { '/inicio' }
  if (!$NoBrowser) {
    Start-Process ($base+$destino)
  }
  Write-Output ('Caça Promos VIP disponível: '+$base+$destino)
  exit 0
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
