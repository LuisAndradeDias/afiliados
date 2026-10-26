[CmdletBinding()]
param(
  [string]$ProjectDir = (Join-Path $PSScriptRoot '..\..'),
  [switch]$Json,
  [switch]$Strict
)
$ErrorActionPreference = 'Stop'

# Diagnostico somente leitura: nunca consultar valores de .env, cookies,
# perfis, planilhas, contatos, tokens, senhas ou outros dados pessoais.
$resolved = (Resolve-Path -LiteralPath $ProjectDir).Path
$root = [System.IO.Path]::GetFullPath($resolved)
$projectLooksValid = (Test-Path -LiteralPath (Join-Path $root 'package.json') -PathType Leaf) -and
  (Test-Path -LiteralPath (Join-Path $root 'package-lock.json') -PathType Leaf)

function Versao-Comando([string]$nome, [string[]]$argumentos) {
  if (-not (Get-Command $nome -ErrorAction SilentlyContinue)) { return '' }
  try {
    $saida = & $nome @argumentos 2>$null
    if ($LASTEXITCODE -ne 0) { return '' }
    return ([string]($saida | Select-Object -First 1)).Trim()
  } catch { return '' }
}
$nodeVersao = Versao-Comando 'node.exe' @('--version')
$npmVersao = Versao-Comando 'npm.cmd' @('--version')
$gitVersao = Versao-Comando 'git.exe' @('--version')
$nodeAdequado = $false
if ($nodeVersao -match '^v(\d+)\.') {
  $nodeAdequado = [int]$Matches[1] -ge 24
}

$ports = @()
$listeners = @()
$portsChecked = $false
try {
  # Consultar a tabela toda evita falso erro quando uma porta nao possui listener.
  $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop)
  $portsChecked = $true
} catch {
  # Se nao for possivel inspecionar, nunca declarar pronto para ativacao.
}
foreach ($port in @(3030, 3040, 3045)) {
  $ocupada = @($listeners | Where-Object { $_.LocalPort -eq $port }).Count -gt 0
  $ports += [ordered]@{ port = $port; listening = $ocupada; checked = $portsChecked }
}

$freeGB = 0.0
try {
  $drive = Get-PSDrive -Name 'C' -ErrorAction Stop
  $freeGB = [math]::Round([double]$drive.Free / 1GB, 1)
} catch { }

$chromeInstalado = $false
$chromePaths = @($env:ProgramFiles, [Environment]::GetEnvironmentVariable('ProgramFiles(x86)'), $env:LOCALAPPDATA)
foreach ($chromeDir in $chromePaths) {
  if (-not $chromeDir) { continue }
  if (Test-Path -LiteralPath (Join-Path $chromeDir 'Google\Chrome\Application\chrome.exe') -PathType Leaf) {
    $chromeInstalado = $true
    break
  }
}

$ready = $projectLooksValid -and $nodeAdequado -and ($npmVersao -ne '') -and
  ($gitVersao -ne '') -and ($freeGB -ge 2)
$portsFree = (@($ports | Where-Object { -not $_.checked -or $_.listening })).Count -eq 0
$result = [ordered]@{
  readOnly = $true
  projectLooksValid = [bool]$projectLooksValid
  tools = [ordered]@{ node = $nodeVersao; npm = $npmVersao; git = $gitVersao }
  diskFreeGB = $freeGB
  chromeInstalled = $chromeInstalado
  ports = @($ports)
  readyForStaging = [bool]$ready
  readyForActivation = [bool]($ready -and $portsFree)
}

if ($Json) {
  $result | ConvertTo-Json -Depth 5 -Compress
} else {
  Write-Output 'Afiliados 2.0 - verificacao somente leitura'
  Write-Output ('Node: ' + $nodeVersao + ' / npm: ' + $npmVersao + ' / git: ' + $gitVersao)
  Write-Output ('Disco C: ' + $freeGB + ' GB livres')
  Write-Output ('Chrome instalado: ' + $chromeInstalado)
  Write-Output ('Preparacao de homologacao possivel: ' + $ready)
  foreach ($p in $ports) {
    Write-Output ('Porta ' + $p.port + ': ' + $(if ($p.listening) { 'ocupada' } elseif ($p.checked) { 'livre' } else { 'nao confirmada' }))
  }
}
if ($Strict -and -not $ready) { exit 2 }
