[CmdletBinding()]
param(
  [string]$SourceDir = (Join-Path $PSScriptRoot '..\..'),
  [string]$DestinationDir = 'C:\afiliados-v2-homologacao',
  [switch]$Execute,
  [switch]$InstallDependencies
)
$ErrorActionPreference = 'Stop'

# Nunca copia arquivos arbitrarios nem importa credenciais.
# O repositorio Git e a unica fonte, o destino deve estar vazio e no C:.
$source = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $SourceDir).Path).TrimEnd('\')
$destination = [System.IO.Path]::GetFullPath($DestinationDir).TrimEnd('\')
$compare = [System.StringComparison]::OrdinalIgnoreCase

if ($InstallDependencies -and -not $Execute) {
  throw 'Para instalar dependencias informe explicitamente -Execute -InstallDependencies.'
}
if (-not $destination.StartsWith('C:\', $compare)) {
  throw 'O destino deve ser uma pasta na unidade C: (nao unidade de rede).'
}
if ($destination.Equals($source, $compare) -or
    $destination.StartsWith(($source + '\'), $compare)) {
  throw 'O destino nao pode sobrescrever nem ficar dentro do repositorio de origem.'
}
foreach ($protected in @('C:\projeto01', 'C:\PromocoesAfiliados')) {
  if ($destination.Equals($protected, $compare) -or
      $destination.StartsWith(($protected + '\'), $compare)) {
    throw 'Destino de instalacao operacional protegido.'
  }
}
if ($destination -notmatch '(?i)(homologacao|staging)') {
  throw 'O destino deve identificar claramente uma pasta de homologacao/staging.'
}
if (Test-Path -LiteralPath $destination) {
  throw 'Destino ja existe. Nao sobrescreva uma instalacao ou homologacao.'
}
$parent = Split-Path -Parent $destination
if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
  throw 'A pasta pai do destino precisa existir; nada foi criado.'
}

$gitRoot = & git.exe -C $source rev-parse --show-toplevel 2>$null
if ($LASTEXITCODE -ne 0 -or -not $gitRoot) {
  throw 'A origem deve ser a raiz de um checkout Git valido.'
}
$gitRoot = [System.IO.Path]::GetFullPath(([string]$gitRoot).Trim()).TrimEnd('\')
if (-not $gitRoot.Equals($source, $compare)) {
  throw 'A origem deve ser exatamente a raiz do repositorio.'
}
foreach ($required in @('package.json', 'package-lock.json', 'Abrir Painel.bat')) {
  if (-not (Test-Path -LiteralPath (Join-Path $source $required) -PathType Leaf)) {
    throw ('Arquivo obrigatorio nao encontrado: ' + $required)
  }
}

# Rejeitar qualquer dado pessoal acidentalmente commitado.
$tracked = @(& git.exe -C $source ls-files)
if ($LASTEXITCODE -ne 0 -or $tracked.Count -eq 0) {
  throw 'Nao foi possivel enumerar arquivos do Git.'
}
$sensitive = @($tracked | Where-Object {
  $_ -match '(^|/)(data|dados|node_modules|whatsapp-profile|mercadolivre-profile)(/|$)' -or
  $_ -match '(^|/)\.env$' -or
  $_ -match '(^|/)chave-admin\.txt$'
})
if ($sensitive.Count -gt 0) {
  throw 'A origem contem arquivo de dados/segredo versionado: staging cancelado.'
}
$revision = (& git.exe -C $source rev-parse --short HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Revisao Git indisponivel.' }

if (-not $Execute) {
  Write-Output ('DRY_RUN: revisao ' + $revision + ' apta para copia isolada; nenhum arquivo criado.')
  Write-Output 'Para preparar somente codigo versionado, execute novamente com -Execute.'
  return
}

$archive = Join-Path $env:TEMP ('afiliados-staging-' + [guid]::NewGuid().ToString('N') + '.zip')
try {
  & git.exe -C $source archive --format=zip "--output=$archive" HEAD
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar arquivo de codigo versionado.' }
  Expand-Archive -LiteralPath $archive -DestinationPath $destination -ErrorAction Stop

  foreach ($forbidden in @('.env', 'data', 'dados', '.git', 'node_modules',
      'captacao\caca-promos-vip\dados')) {
    if (Test-Path -LiteralPath (Join-Path $destination $forbidden)) {
      throw 'Arquivo ou pasta privada no pacote: prepare a origem novamente.'
    }
  }
  if (-not (Test-Path -LiteralPath (Join-Path $destination 'package-lock.json'))) {
    throw 'Package-lock ausente da copia de homologacao.'
  }

  Write-Output ('STAGING_CREATED: revisao ' + $revision + ', sem sessao ou dados pessoais.')
  if ($InstallDependencies) {
    if (-not (Get-Command 'npm.cmd' -ErrorAction SilentlyContinue)) {
      throw 'npm.cmd nao encontrado. Nenhuma dependencia instalada.'
    }
    $previousSkip = $env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD
    try {
      $env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'
      Push-Location $destination
      try {
        & npm.cmd ci --ignore-scripts --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Falha em npm ci da copia isolada.' }
      } finally { Pop-Location }
    } finally {
      $env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = $previousSkip
    }
    Write-Output 'STAGING_DEPENDENCIES_READY: nenhum navegador, servidor ou robo iniciado.'
  }
} finally {
  if (Test-Path -LiteralPath $archive) {
    Remove-Item -LiteralPath $archive -Force
  }
}
