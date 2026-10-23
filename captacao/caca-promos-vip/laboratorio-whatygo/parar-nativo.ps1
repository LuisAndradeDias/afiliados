$ErrorActionPreference='Stop'
$base=$PSScriptRoot
$runtime=Join-Path $base 'runtime'
$pidFile=Join-Path $runtime 'whatygo.pid'
if(Test-Path $pidFile){
  $labPid=0
  if([int]::TryParse(([IO.File]::ReadAllText($pidFile)).Trim(),[ref]$labPid)){
    $proc=Get-Process -Id $labPid -ErrorAction SilentlyContinue
    if($proc -and $proc.ProcessName -eq 'whatygo'){
      Stop-Process -Id $labPid -ErrorAction Stop
      Write-Output 'Processo WhatyGo do laboratorio parado.'
    }
  }
  Remove-Item $pidFile -Force
}
$ctl=Join-Path $base 'tools\pgsql\bin\pg_ctl.exe'
$dir=Join-Path $runtime 'pgdata'
if((Test-Path $ctl) -and (Test-Path (Join-Path $dir 'PG_VERSION'))){
  & $ctl -D $dir -m fast -w stop
  if($LASTEXITCODE -eq 0){Write-Output 'PostgreSQL portatil do laboratorio parado.'}
}
