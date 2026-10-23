$ErrorActionPreference='Stop'
$b=$PSScriptRoot
$f=Join-Path $b 'runtime\monitor.pid'
if(-not(Test-Path $f)){Write-Output 'Monitor nao possui PID salvo.';exit 0}
$id=0
if([int]::TryParse([IO.File]::ReadAllText($f).Trim(),[ref]$id)){
  $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$id)
  if($p -and $p.Name -eq 'node.exe' -and $p.CommandLine -like '*monitor-cliques.mjs*'){
    Stop-Process -Id $id -ErrorAction Stop
    Write-Output 'Monitor de cliques interrompido.'
  }
}
Remove-Item $f -Force
