$ErrorActionPreference='Stop'
$base=$PSScriptRoot
$bin=Join-Path $base 'tools\pgsql\bin'
$init=Join-Path $bin 'initdb.exe'
$ctl=Join-Path $bin 'pg_ctl.exe'
$psql=Join-Path $bin 'psql.exe'
$createdb=Join-Path $bin 'createdb.exe'
$runtime=Join-Path $base 'runtime'
$datadir=Join-Path $runtime 'pgdata'
$passFile=Join-Path $base 'private\postgres-pass.txt'
foreach($file in @($init,$ctl,$psql,$createdb,$passFile)){if(-not (Test-Path $file)){throw "Prerequisito ausente: $file"}}
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$env:PATH="$bin;$env:PATH"
$env:PGPASSWORD=([System.IO.File]::ReadAllText($passFile)).Trim()
if(-not (Test-Path (Join-Path $datadir 'PG_VERSION'))) {
  if(Test-Path $datadir){throw 'PGDATA parcial existente: nao sobrescrever.'}
  & $init -D $datadir -U cpv_lab -A scram-sha-256 -E UTF8 --locale=C --pwfile=$passFile
  if($LASTEXITCODE -ne 0){throw 'initdb falhou; verificar logs.'}
}
& $ctl -D $datadir status | Out-Null
if($LASTEXITCODE -ne 0){
  if(Get-NetTCPConnection -State Listen -LocalPort 55432 -ErrorAction SilentlyContinue){
    throw 'Porta 55432 ja em uso por outro processo.'
  }
  & $ctl -D $datadir -o '-h 127.0.0.1 -p 55432' -l (Join-Path $runtime 'postgres.log') -w start
  if($LASTEXITCODE -ne 0){throw 'Nao foi possivel iniciar o PostgreSQL portatil.'}
}
foreach($name in @('whatygo_auth','whatygo_users')){
  $queryResult=@(& $psql -h 127.0.0.1 -p 55432 -U cpv_lab -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$name'")
  if($LASTEXITCODE -ne 0){throw 'Consulta de banco falhou.'}
  $result=([string]($queryResult -join '')).Trim()
  if($result -ne '1'){
    & $createdb -h 127.0.0.1 -p 55432 -U cpv_lab $name
    if($LASTEXITCODE -ne 0){throw "Criacao do banco $name falhou."}
  }
}
$env:PGPASSWORD=$null
Write-Output 'PostgreSQL do laboratorio ativo apenas em 127.0.0.1:55432; bancos independentes prontos.'
