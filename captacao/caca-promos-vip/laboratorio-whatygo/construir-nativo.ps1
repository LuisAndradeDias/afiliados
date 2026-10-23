$ErrorActionPreference='Stop'
$base=$PSScriptRoot
$src=Join-Path $base '_upstream'
$go=Join-Path $base 'tools\go\bin\go.exe'
$main=Join-Path $src 'cmd\whatygo\main.go'
$out=Join-Path $base 'bin\whatygo.exe'
$expected='6e0abc8c18b162e413bfdb60e0e458f752c066b0'
if(-not (Test-Path $go)){throw 'Go portatil ausente.'}
if(-not (Test-Path $main)){throw 'Codigo-fonte WhatyGo ausente.'}
$head=(& git -C $src rev-parse HEAD).Trim()
if($head -ne $expected){throw 'Versao do WhatyGo divergente do commit fixado.'}
$source=[System.IO.File]::ReadAllText($main)
$original='Addr:              ":" + os.Getenv("SERVER_PORT"),'
$safe='Addr:              "127.0.0.1:" + os.Getenv("SERVER_PORT"),'
if($source.Contains($original)) {
  $source=$source.Replace($original,$safe)
  [System.IO.File]::WriteAllText($main,$source,(New-Object System.Text.UTF8Encoding($false)))
}
if(-not $source.Contains($safe)){throw 'Nao foi possivel garantir bind local: abortando.'}
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $base 'preparar-sem-cgo.ps1')
if($LASTEXITCODE -ne 0){throw 'Patch de WebP sem CGO falhou.'}
New-Item -ItemType Directory -Force -Path (Split-Path $out),(Join-Path $base 'cache\build'),(Join-Path $base 'cache\mod')|Out-Null
$env:GOCACHE=Join-Path $base 'cache\build'
$env:GOMODCACHE=Join-Path $base 'cache\mod'
$env:CGO_ENABLED='0'
$env:GOTOOLCHAIN='local'
$env:GOMAXPROCS='2'
Set-Location $src
& $go build -p 2 -trimpath -buildvcs=false -o $out ./cmd/whatygo
if($LASTEXITCODE -ne 0){throw 'Compilacao nativa falhou.'}
Write-Output 'Binario WhatyGo nativo criado, com porta limitada a 127.0.0.1.'
