[CmdletBinding()]
param(
  [string]$CodeDir = (Join-Path $PSScriptRoot '..\..'),
  [string]$OperationalDir = 'C:\afiliados-v2-homologacao',
  [string]$LegacyDir = 'C:\projeto01',
  [string]$BackupDir = 'C:\BackupsAfiliados',
  [switch]$Json,
  [switch]$SkipComparison
)
$ErrorActionPreference = 'Stop'

# Read-only inspection. Do not display credentials, cookies, contacts or
# contents of profiles, state files, .env or backup folders.
$codeRoot = (Resolve-Path -LiteralPath $CodeDir -ErrorAction Stop).Path
$mySid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$allowedSids = @($mySid, 'S-1-5-18', 'S-1-5-32-544')

function Test-RestrictedAcl([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $false }
  try {
    $acl = Get-Acl -LiteralPath $path -ErrorAction Stop
    $grants = @($acl.Access | Where-Object {
      $_.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow
    })
    if ($grants.Count -eq 0) { return $false }
    foreach ($entry in $grants) {
      try {
        $sid = $entry.IdentityReference.Translate(
          [System.Security.Principal.SecurityIdentifier]).Value
        if ($sid -notin $allowedSids) { return $false }
      } catch { return $false }
    }
    return $true
  } catch { return $false }
}

function Get-PathState([string]$path) {
  $exists = Test-Path -LiteralPath $path
  $hidden = $false
  if ($exists) {
    try {
      $attributes = (Get-Item -LiteralPath $path -Force).Attributes
      $hidden = [bool]($attributes -band [System.IO.FileAttributes]::Hidden)
    } catch { }
  }
  return [ordered]@{
    exists = [bool]$exists
    hidden = [bool]$hidden
    restrictedAcl = [bool](Test-RestrictedAcl $path)
  }
}

function Test-AutomationDisabled([string]$envFile) {
  if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) { return $false }
  try {
    # All values stay in memory. Only the aggregate boolean is reported.
    $lines = @(Get-Content -LiteralPath $envFile -Encoding UTF8)
    foreach ($key in @(
      'ALTERNATING_MONITOR_ENABLED',
      'MERCADOLIVRE_MONITOR_ENABLED',
      'WHATSAPP_AUTO_SEND_ENABLED'
    )) {
      $assignments = @($lines | Where-Object {
        $_ -match ('^\s*' + [regex]::Escape($key) + '\s*=')
      })
      if ($assignments.Count -ne 1) { return $false }
      if ($assignments[0] -notmatch ('^\s*' + [regex]::Escape($key) + '\s*=\s*false\s*$')) {
        return $false
      }
    }
    return $true
  } catch { return $false }
}

function Get-GitText([string[]]$arguments) {
  try {
    $value = & git.exe -C $codeRoot @arguments 2>$null
    if ($LASTEXITCODE -ne 0) { return '' }
    return ([string]($value | Select-Object -First 1)).Trim()
  } catch { return '' }
}

$installed = Get-PathState $OperationalDir
$legacy = Get-PathState $LegacyDir
$backup = Get-PathState $BackupDir
$config = Get-PathState (Join-Path $OperationalDir '.env')
$profile = Get-PathState (Join-Path $OperationalDir 'data\whatsapp-profile')

$backupFolders = 0
if ($backup.exists) {
  try {
    $backupFolders = @(Get-ChildItem -LiteralPath $BackupDir -Directory -Force).Count
  } catch { }
}

$ports = @()
$listeners = @()
$portsChecked = $false
try {
  $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop)
  $portsChecked = $true
} catch { }
foreach ($port in @(3030, 3040, 3045)) {
  $current = @($listeners | Where-Object { $_.LocalPort -eq $port })
  $loopbackOnly = $portsChecked -and
    (@($current | Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') }).Count -eq 0)
  $ports += [ordered]@{
    port = $port
    checked = $portsChecked
    listening = ($current.Count -gt 0)
    loopbackOnly = [bool]$loopbackOnly
  }
}

$trackedRiskCount = 0
$gitTracked = @()
try {
  $gitTracked = @(& git.exe -C $codeRoot ls-files 2>$null)
  if ($LASTEXITCODE -ne 0) { $gitTracked = @() }
} catch { }
foreach ($name in $gitTracked) {
  $normalized = ([string]$name).Replace('\', '/')
  if ($normalized -match '(?i)(^|/)(\.env(\.[^/]+)?|data/|dados/|whatsapp-profile/|[^/]+\.(pfx|p12|pem|key|sqlite|db))') {
    if ($normalized -notmatch '(?i)(^|/)\.env\.example$') {
      $trackedRiskCount++
    }
  }
}

$drift = [ordered]@{
  checked = 0
  identical = 0
  lineEndingDifferences = 0
  different = 0
  missing = 0
  samplePaths = @()
}
if (-not $SkipComparison -and $installed.exists) {
  $paths = @(& git.exe -C $codeRoot ls-files -- 'src' 'captacao/caca-promos-vip/src' 'captacao/caca-promos-vip/public' 'browser-extension' 'scripts/launcher' 'Abrir Painel.bat' 'package.json' 2>$null)
  $samples = @()
  foreach ($relative in $paths) {
    $relative = [string]$relative
    if ($relative -notmatch '\.(ts|mts|js|mjs|css|html|ps1|cmd|bat|json)$') { continue }
    $localPath = Join-Path $codeRoot ($relative.Replace('/', '\'))
    $activePath = Join-Path $OperationalDir ($relative.Replace('/', '\'))
    if (-not (Test-Path -LiteralPath $localPath -PathType Leaf)) { continue }
    $drift.checked++
    if (-not (Test-Path -LiteralPath $activePath -PathType Leaf)) {
      $drift.missing++
      if ($samples.Count -lt 12) { $samples += $relative }
      continue
    }
    try {
      $sourceHash = (Get-FileHash -LiteralPath $localPath -Algorithm SHA256).Hash
      $activeHash = (Get-FileHash -LiteralPath $activePath -Algorithm SHA256).Hash
      if ($sourceHash -eq $activeHash) {
        $drift.identical++
      } else {
        # Installed copies can use CRLF while a clean clone uses LF.
        # Compare normalized text before declaring a functional code drift.
        $sourceText = [System.IO.File]::ReadAllText($localPath).TrimStart([char]0xFEFF)
        $activeText = [System.IO.File]::ReadAllText($activePath).TrimStart([char]0xFEFF)
        $sourceText = $sourceText.Replace(([string][char]13 + [string][char]10), [string][char]10).Replace([string][char]13, [string][char]10)
        $activeText = $activeText.Replace(([string][char]13 + [string][char]10), [string][char]10).Replace([string][char]13, [string][char]10)
        if ($sourceText -ceq $activeText) {
          $drift.identical++
          $drift.lineEndingDifferences++
        } else {
          $drift.different++
          if ($samples.Count -lt 12) { $samples += $relative }
        }
      }
    } catch {
      $drift.different++
      if ($samples.Count -lt 12) { $samples += $relative }
    }
  }
  $drift.samplePaths = @($samples)
}

$allAclsRestricted = $installed.restrictedAcl -and $legacy.restrictedAcl -and
  $backup.restrictedAcl -and $config.restrictedAcl -and $profile.restrictedAcl
$allLocalPorts = $portsChecked -and
  (@($ports | Where-Object { -not $_.loopbackOnly }).Count -eq 0)

$result = [ordered]@{
  audit = 'etapa49-v1'
  readOnly = $true
  doesNotApproveActivation = $true
  source = [ordered]@{
    branch = Get-GitText @('branch', '--show-current')
    commit = Get-GitText @('rev-parse', 'HEAD')
    trackedSensitivePathAlerts = $trackedRiskCount
  }
  paths = [ordered]@{
    installed = $installed
    legacy = $legacy
    backup = $backup
    configuration = $config
    whatsappProfile = $profile
    backupDirectories = $backupFolders
  }
  safeConfiguration = [ordered]@{
    automationFlagsAllDisabled = [bool](Test-AutomationDisabled (Join-Path $OperationalDir '.env'))
    localAclRestricted = [bool]$allAclsRestricted
    portsLoopbackOnly = [bool]$allLocalPorts
  }
  ports = @($ports)
  sourceComparison = $drift
}
if ($Json) {
  $result | ConvertTo-Json -Depth 8 -Compress
} else {
  Write-Output 'Afiliados 2.0 - Etapa 49, auditoria somente leitura'
  Write-Output ('Branch: ' + $result.source.branch)
  Write-Output ('Arquivos versionados com caminhos sensiveis: ' + $trackedRiskCount)
  Write-Output ('ACL local restrita: ' + $allAclsRestricted)
  Write-Output ('Monitores e autoenvio desligados: ' + $result.safeConfiguration.automationFlagsAllDisabled)
  Write-Output ('Portas exclusivamente locais: ' + $allLocalPorts)
  Write-Output ('Comparados: ' + $drift.checked + '; equivalentes: ' + $drift.identical +
    ' (fim de linha: ' + $drift.lineEndingDifferences + '); diferentes: ' + $drift.different + '; ausentes: ' + $drift.missing)
  Write-Output 'Nenhum arquivo, token, contato, sessao, fila ou processo foi modificado.'
}
