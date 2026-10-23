$base=$PSScriptRoot
Write-Output '=== LAB WHATYGO SEM DOCKER ==='
Write-Output ('SOURCE='+(Test-Path (Join-Path $base '_upstream\go.mod')))
Write-Output ('GO='+(Test-Path (Join-Path $base 'tools\go\bin\go.exe')))
Write-Output ('POSTGRES_BIN='+(Test-Path (Join-Path $base 'tools\pgsql\bin\initdb.exe')))
Write-Output ('BIN_WHATYGO='+(Test-Path (Join-Path $base 'bin\whatygo.exe')))
Write-Output ('PRIVATE_CONFIG='+(Test-Path (Join-Path $base '.env.native')))
foreach($port in @(3045,4000,55432)){
  $conn=Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  Write-Output ('PORT_'+$port+'='+([bool]$conn))
  if($conn){$conn|Select-Object LocalAddress,LocalPort|Format-Table -HideTableHeaders}
}
try {
  $health=Invoke-RestMethod -Uri 'http://127.0.0.1:4000/health' -TimeoutSec 3
  Write-Output ('HEALTH='+$health.status)
}catch { Write-Output 'HEALTH=INACCESSIBLE' }
Write-Output 'Nenhuma mensagem foi enviada pelo verificador.'
