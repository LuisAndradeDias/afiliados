$ErrorActionPreference = 'Stop'
$base = $PSScriptRoot
$privateDir = Join-Path $base 'private'
$runtimeDir = Join-Path $base 'runtime'
New-Item -ItemType Directory -Force -Path $privateDir,$runtimeDir | Out-Null
$envPath = Join-Path $base '.env.native'
$passFile = Join-Path $privateDir 'postgres-pass.txt'
if ((Test-Path $envPath) -and (Test-Path $passFile)) {
  Write-Output 'Credenciais nativas existentes preservadas.'
  exit 0
}
if ((Test-Path $envPath) -or (Test-Path $passFile)) {
  throw 'Credenciais parciais existentes. Verificar manualmente antes de continuar.'
}
function NovoSegredo([int]$bytes) {
  $b = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return ([BitConverter]::ToString($b)).Replace('-','').ToLowerInvariant()
}
$pw=NovoSegredo 24
$key=NovoSegredo 32
[System.IO.File]::WriteAllText($passFile, ($pw+[Environment]::NewLine), (New-Object System.Text.UTF8Encoding($false)))
$values = @(
  'SERVER_PORT=4000',
  'CLIENT_NAME=CPV-LAB-ISOLADO',
  "POSTGRES_AUTH_DB=postgresql://cpv_lab:$($pw)@127.0.0.1:55432/whatygo_auth?sslmode=disable",
  "POSTGRES_USERS_DB=postgresql://cpv_lab:$($pw)@127.0.0.1:55432/whatygo_users?sslmode=disable",
  "GLOBAL_API_KEY=$key",
  'DATABASE_SAVE_MESSAGES=false',
  'CONNECT_ON_STARTUP=false',
  'MINIO_ENABLED=false',
  'AMQP_URL=',
  'WEBHOOK_URL=',
  'WEBHOOK_FILES=false',
  'WADEBUG=WARN',
  'LOGTYPE=console',
  'LOG_LEVEL=warn',
  'INSTANCE_LOCK=true',
  'OS_NAME=Windows',
  'SEND_MAX_CONCURRENT=1',
  'SEND_RATE_PER_MIN=1',
  'SEND_QUEUE_WAIT_SEC=4',
  'DB_MAX_OPEN_CONNS=4',
  'DB_MAX_IDLE_CONNS=1',
  'CORS_ORIGINS=http://127.0.0.1:4000,http://localhost:4000'
)
[System.IO.File]::WriteAllLines($envPath,$values,(New-Object System.Text.UTF8Encoding($false)))
Write-Output 'Credenciais independentes geradas em arquivos privados ignorados pelo Git.'
