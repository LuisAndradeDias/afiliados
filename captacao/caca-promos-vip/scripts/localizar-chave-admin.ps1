param([switch]$MostrarChave)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$keyFile = Join-Path $root 'dados\chave-admin.txt'
if (!(Test-Path -LiteralPath $keyFile)) {
  Write-Host 'A chave ainda nao existe. Inicie a Central primeiro usando Abrir Central de Contatos.cmd.' -ForegroundColor Yellow
  exit 1
}
Write-Host 'Central definitiva: http://127.0.0.1:3040/painel'
Write-Host ('Arquivo local da chave: ' + $keyFile)
if ($MostrarChave) {
  Start-Process notepad.exe -ArgumentList ('"' + $keyFile + '"')
} else {
  Write-Host 'Para visualizar a chave apenas neste computador, use o atalho Abrir Chave Administrativa.cmd.'
}
