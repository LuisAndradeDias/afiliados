$ErrorActionPreference='Stop'
$base=$PSScriptRoot
$file=Join-Path $base 'monitor-cliques.mjs'
$node=Get-Command node.exe -ErrorAction Stop
$runtime=Join-Path $base 'runtime'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$port=Get-NetTCPConnection -LocalPort 4011 -State Listen -ErrorAction SilentlyContinue
if($port){
  $proc=Get-CimInstance Win32_Process -Filter ('ProcessId='+$port[0].OwningProcess)
  if($proc.Name -ne 'node.exe' -or $proc.CommandLine -notlike '*monitor-cliques.mjs*'){
    throw 'Porta 4011 ja utilizada por outro programa.'
  }
  Write-Output 'Monitor de cliques ja ativo.'
  exit 0
}
$p=Start-Process -FilePath $node.Source -ArgumentList @($file) -WorkingDirectory $base -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'monitor.out.log') -RedirectStandardError (Join-Path $runtime 'monitor.err.log')
[IO.File]::WriteAllText((Join-Path $runtime 'monitor.pid'),[string]$p.Id)
for($i=0;$i -lt 10;$i++){
  Start-Sleep -Milliseconds 500
  try {$r=Invoke-RestMethod -Uri 'http://127.0.0.1:4011/status' -TimeoutSec 1
    if($r.active){Write-Output 'MONITOR_OK http://127.0.0.1:4011';exit 0}
  }catch{}
}
throw 'Monitor nao respondeu: consulte logs em runtime.'
