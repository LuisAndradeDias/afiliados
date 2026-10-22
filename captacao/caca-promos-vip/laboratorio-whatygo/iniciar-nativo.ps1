$ErrorActionPreference='Stop'
$base=$PSScriptRoot
$exe=Join-Path $base 'bin\whatygo.exe'
$src=Join-Path $base '_upstream'
$runtime=Join-Path $base 'runtime'
$envfile=Join-Path $base '.env.native'
if(-not (Test-Path $exe)){throw 'Binario ausente: primeiro execute construir-nativo.ps1.'}
if(-not (Test-Path $envfile)){throw 'Configuracao privada ausente: execute configurar-nativo.ps1.'}
& (Join-Path $base 'iniciar-postgres.ps1')
if(Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue){throw 'Porta 4000 ocupada: nao substituir servidor.'}
foreach($line in [System.IO.File]::ReadAllLines($envfile)){
  if(-not $line -or $line.Trim().StartsWith('#')){continue}
  $pos=$line.IndexOf('=')
  if($pos -le 0){continue}
  $name=$line.Substring(0,$pos)
  $value=$line.Substring($pos+1)
  [Environment]::SetEnvironmentVariable($name,$value,'Process')
}
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$p=Start-Process -FilePath $exe -WorkingDirectory $src -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtime 'whatygo.out.log') -RedirectStandardError (Join-Path $runtime 'whatygo.err.log')
[System.IO.File]::WriteAllText((Join-Path $runtime 'whatygo.pid'),[string]$p.Id)
Write-Output ('Processo WhatyGo iniciado, PID='+[string]$p.Id)
for($i=0;$i -lt 20;$i++){
  Start-Sleep -Seconds 1
  if($p.HasExited){throw ('WhatyGo encerrou antes de responder; consultar runtime\whatygo.err.log. Exit='+$p.ExitCode)}
  try {
    $r=Invoke-RestMethod -Uri 'http://127.0.0.1:4000/health' -TimeoutSec 2
    if($r.status -eq 'ok'){Write-Output 'HEALTH_OK http://127.0.0.1:4000/manager';exit 0}
  }catch{}
}
throw 'WhatyGo iniciado, mas health nao ficou pronto. Verificar logs privados.'
