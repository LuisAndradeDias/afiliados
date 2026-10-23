$ErrorActionPreference='Stop'
$lab=$PSScriptRoot
$live=Join-Path $lab 'bin\whatygo.exe'
$fixed=Join-Path $lab 'bin\whatygo-buttons-fixed.exe'
$backup=Join-Path $lab 'bin\whatygo-before-click-fix.exe'
$startScript=Join-Path $lab 'iniciar-nativo.ps1'
$runtime=Join-Path $lab 'runtime'
foreach($f in @($live,$fixed,$startScript)){if(-not(Test-Path $f)){throw "Required laboratory file missing: $f"}}
if((Get-Item $fixed).Length -lt 50000000){throw 'Fixed executable is unexpectedly small.'}
$fixedHash=(Get-FileHash $fixed -Algorithm SHA256).Hash
$liveHash=(Get-FileHash $live -Algorithm SHA256).Hash
if($fixedHash -eq $liveHash){
 Write-Output 'FIXED_BINARY_ALREADY_ACTIVE'
 exit 0
}
if((Test-Path $backup)){throw 'An existing backup must be reviewed; no overwrite allowed.'}
$listener=Get-NetTCPConnection -State Listen -LocalPort 4000 -ErrorAction Stop|
 Where-Object{$_.LocalAddress -eq '127.0.0.1'}|Select-Object -First 1
if(-not $listener){throw 'Original WhatyGo listener not verified.'}
$process=Get-CimInstance Win32_Process -Filter ('ProcessId='+$listener.OwningProcess)
if(-not $process -or $process.Name -ne 'whatygo.exe' -or $process.ExecutablePath -ne $live){
 throw 'The service on port 4000 is not the original lab executable.'
}
# This is a laboratory-only deployment. No other services are restarted.
if(-not (Get-NetTCPConnection -State Listen -LocalPort 3045 -ErrorAction SilentlyContinue)){
 throw 'The management Central is not running; deployment aborted.'
}
if(-not (Get-NetTCPConnection -State Listen -LocalPort 4011 -ErrorAction SilentlyContinue)){
 throw 'The click monitor is not running; deployment aborted.'
}
Copy-Item -LiteralPath $live -Destination $backup -ErrorAction Stop
if((Get-FileHash $backup -Algorithm SHA256).Hash -ne $liveHash){throw 'Binary backup integrity mismatch.'}
Write-Output 'OLD_LAB_BINARY_BACKED_UP'
Stop-Process -Id $process.ProcessId -ErrorAction Stop
$stopped=$false
for($n=0;$n -lt 60;$n++){
 Start-Sleep -Milliseconds 250
 if(-not(Get-NetTCPConnection -State Listen -LocalPort 4000 -ErrorAction SilentlyContinue)){
  $stopped=$true
  break
 }
}
if(-not $stopped){throw 'Port 4000 remained occupied. Backup preserved.'}
$deployed=$false
try {
 Copy-Item -LiteralPath $fixed -Destination $live -Force
 if((Get-FileHash $live -Algorithm SHA256).Hash -ne $fixedHash){throw 'Fixed binary copy did not verify.'}
 & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $startScript
 if($LASTEXITCODE -ne 0){throw 'New WhatyGo failed health check.'}
 $health=Invoke-RestMethod 'http://127.0.0.1:4000/health' -TimeoutSec 6
 if($health.status -ne 'ok'){throw 'New WhatyGo health invalid.'}
 $manager=Invoke-WebRequest 'http://127.0.0.1:4000/manager' -UseBasicParsing -TimeoutSec 8
 if($manager.StatusCode -ne 200){throw 'Manager not available.'}
 $deployed=$true
 Write-Output ('NEW_BINARY_SHA256='+$fixedHash.Substring(0,14)+'...')
 Write-Output 'WHATYGO_BUTTON_IDENTITY_FIX_ACTIVE'
 Write-Output 'MANAGER_4000_HTTP_200'
 Write-Output 'POSTGRESQL_AND_CENTRAL_LEFT_RUNNING'
 Write-Output 'NO_WHATSAPP_MESSAGES_SENT'
}finally{
 if(-not $deployed){
  $port=Get-NetTCPConnection -State Listen -LocalPort 4000 -ErrorAction SilentlyContinue|Select-Object -First 1
  if($port){
   $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$port.OwningProcess)
   if($p -and $p.ExecutablePath -eq $live){Stop-Process -Id $p.ProcessId -ErrorAction SilentlyContinue}
  }
  Start-Sleep -Seconds 1
  Copy-Item -LiteralPath $backup -Destination $live -Force
  Write-Output 'PREVIOUS_BINARY_RESTORED'
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $startScript
  Write-Output 'ROLLBACK_TO_PREVIOUS_LAB_VERSION_ATTEMPTED'
 }
}
