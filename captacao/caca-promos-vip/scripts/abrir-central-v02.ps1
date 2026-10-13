param([switch]$Relatorio, [switch]$NoBrowser, [switch]$Landing)
$ErrorActionPreference = 'Stop'
try {
    $base = 'http://127.0.0.1:3040'
    $root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
    $server = Join-Path $root 'src\server.mjs'
    if (!(Test-Path $server)) { throw 'Servidor da captacao nao encontrado.' }
    $node = (Get-Command node -ErrorAction Stop).Source
    $healthOk = $false
    try {
        $r = Invoke-WebRequest ($base + '/painel') -UseBasicParsing -TimeoutSec 3
        $healthOk = $r.StatusCode -eq 200 -and $r.Content.Contains('id="groupCard"')
    } catch { $healthOk = $false }
    if (!$healthOk) {
        if (Get-NetTCPConnection -State Listen -LocalPort 3040 -ErrorAction SilentlyContinue) {
            throw 'A porta 3040 esta ocupada. Feche o aplicativo antigo e tente novamente.'
        }
        New-Item -ItemType Directory -Force -Path (Join-Path $root 'dados') | Out-Null
        $out = Join-Path $root 'dados\central-servidor.log'
        $err = Join-Path $root 'dados\central-erros.log'
        $arguments = '"' + $server + '"'
        $proc = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
        for ($i = 0; $i -lt 40; $i++) {
            Start-Sleep -Milliseconds 350
            try {
                $r = Invoke-WebRequest ($base + '/painel') -UseBasicParsing -TimeoutSec 2
                $healthOk = $r.StatusCode -eq 200 -and $r.Content.Contains('id="groupCard"')
                if ($healthOk) { break }
            } catch {}
            if ($proc.HasExited) { throw ('Servidor encerrou. Consulte ' + $err) }
        }
        if (!$healthOk) { throw 'A central nao respondeu. Verifique os logs do projeto.' }
    }

    if (!$NoBrowser) {
        if ($Relatorio) {
            $chaveFile = Join-Path $root 'dados\chave-admin.txt'
            if (!(Test-Path $chaveFile)) { throw 'Chave local do relatorio nao encontrada.' }
            $chave = [IO.File]::ReadAllText($chaveFile).Trim()
            if ($chave -notmatch '^[0-9a-f]{48}$') { throw 'Chave do relatorio invalida.' }
            Start-Process ($base + '/relatorio?chave=' + [Uri]::EscapeDataString($chave))
            Write-Output 'Relatorio privado aberto no navegador.'
        } elseif ($Landing) {
            Start-Process ($base + '/c/instagram')
            Write-Output 'Pagina voluntaria de convite aberta no navegador.'
        } else {
            Start-Process ($base + '/painel')
            Write-Output 'Central de Captacao aberta no navegador.'
        }
    } else {
        Write-Output 'Central de Captacao ativa na porta 3040.'
    }
    exit 0
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
