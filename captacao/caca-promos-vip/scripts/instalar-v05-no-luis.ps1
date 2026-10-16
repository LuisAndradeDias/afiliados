param([switch]$Aplicar)
$ErrorActionPreference = 'Stop'
$repo = 'C:\projeto01'
$central = Join-Path $repo 'captacao\caca-promos-vip'
$backupBase = 'C:\projeto01-backups'
$backup = $null
$antigoCommit = $null

function Porta($numero) {
    return Get-NetTCPConnection -State Listen -LocalPort $numero -ErrorAction SilentlyContinue |
        Select-Object -First 1
}
function VerificarServicoCentral($conexao) {
    if (!$conexao) { return }
    $p = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $conexao.OwningProcess)
    if (!$p -or $p.Name -ne 'node.exe' -or
        $p.CommandLine -notlike '*caca-promos-vip*server.mjs*') {
        throw 'A porta 3040 pertence a outro processo. Nenhum serviço foi alterado.'
    }
}
try {
    if (!(Test-Path (Join-Path $central 'src\server.mjs'))) {
        throw 'A Central não foi encontrada na pasta definitiva do Luis.'
    }
    if (!(Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git não foi encontrado.' }
    $branch = (& git -C $repo branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') {
        throw 'Abra a branch main no computador Luis antes da instalação.'
    }
    $alteracoes = @(& git -C $repo status --porcelain --untracked-files=no)
    if ($alteracoes.Count -gt 0) {
        throw 'Existem alterações rastreadas não salvas no Git. Preserve-as antes de atualizar.'
    }
    $portaCentral = Porta 3040
    VerificarServicoCentral $portaCentral
    $portaRobo = Porta 3030
    if (!$Aplicar) {
        Write-Host 'Pré-verificação da atualização v0.5 concluída.' -ForegroundColor Green
        Write-Host 'Para instalar, execute este script com -Aplicar.'
        exit 0
    }

    # Faz cópia local privada antes do Git ou da troca de processo.
    New-Item -ItemType Directory -Force -Path $backupBase | Out-Null
    $backup = Join-Path $backupBase ('captacao-pre-v05-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Force -Path $backup | Out-Null
    Copy-Item -LiteralPath $central -Destination (Join-Path $backup 'caca-promos-vip') -Recurse -Force
    if (!(Test-Path (Join-Path $backup 'caca-promos-vip\src\server.mjs'))) {
        throw 'Cópia de segurança incompleta; instalação cancelada.'
    }
    if ((Test-Path (Join-Path $central 'dados\chave-admin.txt')) -and
        !(Test-Path (Join-Path $backup 'caca-promos-vip\dados\chave-admin.txt'))) {
        throw 'A chave administrativa não consta no backup; instalação cancelada.'
    }
    $antigoCommit = (& git -C $repo rev-parse HEAD).Trim()
    Write-Host 'Backup privado criado antes da atualização.'

    & git -C $repo fetch origin main
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao obter atualização do GitHub.' }
    & git -C $repo merge --ff-only origin/main
    if ($LASTEXITCODE -ne 0) { throw 'Merge não era fast-forward. Resolva manualmente; sem reset automático.' }
    $versao = (Get-Content (Join-Path $central 'package.json') -Raw | ConvertFrom-Json).version
    if ($versao -ne '0.5.0') { throw ('Versão esperada 0.5.0; encontrada ' + $versao) }
    $node = (Get-Command node -ErrorAction Stop).Source
    Push-Location $central
    try {
        & $node --test
        if ($LASTEXITCODE -ne 0) { throw 'Testes falharam. O serviço antigo foi preservado.' }
    } finally { Pop-Location }

    # Apenas o processo da Central é reiniciado. Porta 3030 não é modificada.
    if ($portaCentral) { Stop-Process -Id $portaCentral.OwningProcess -ErrorAction Stop }
    New-Item -ItemType Directory -Force -Path (Join-Path $central 'dados') | Out-Null
    $log = Join-Path $central 'dados\central-servidor.log'
    $erro = Join-Path $central 'dados\central-erros.log'
    $entry = Join-Path $central 'src\server.mjs'
    # Garante que o serviço reiniciado use a porta local e os dados preservados
    # mesmo quando a sessão do terminal herdou variáveis de outros projetos.
    $env:PORT = '3040'
    $env:HOST = '127.0.0.1'
    $env:DATA_DIR = Join-Path $central 'dados'
    $novo = Start-Process -FilePath $node -ArgumentList ('"' + $entry + '"') -WorkingDirectory $central -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $erro -PassThru
    $ok = $false
    for ($tentativa = 0; $tentativa -lt 30; $tentativa++) {
        Start-Sleep -Milliseconds 350
        if ($novo.HasExited) { break }
        try {
            $r = Invoke-WebRequest 'http://127.0.0.1:3040/painel' -UseBasicParsing -TimeoutSec 2
            if ($r.StatusCode -eq 200 -and $r.Content.Contains('Versão 0.5') -and
                $r.Content.Contains('id="importPreview"')) { $ok = $true; break }
        } catch {}
    }
    if (!$ok) { throw 'A nova Central não foi validada na porta 3040. Consulte os logs locais.' }
    $depois = Porta 3030
    if ($portaRobo -and (!$depois -or $depois.OwningProcess -ne $portaRobo.OwningProcess)) {
        throw 'O estado da porta 3030 mudou; verifique o robô principal.'
    }
    Write-Host 'Central v0.5 ativa em http://127.0.0.1:3040/painel' -ForegroundColor Green
    Write-Host ('Backup do código e dados: ' + $backup)
    Write-Host 'Nenhuma mensagem foi enviada durante a implantação.'
} catch {
    Write-Error $_.Exception.Message
    if ($backup) { Write-Host ('Backup para restauração: ' + $backup) }
    if ($antigoCommit) { Write-Host ('Commit anterior para referência: ' + $antigoCommit) }
    exit 1
}
