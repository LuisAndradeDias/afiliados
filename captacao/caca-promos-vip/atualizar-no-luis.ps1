# Atualizacao local do piloto v0.2. Nao instala servico e nao altera o robo Afiliados.
$ErrorActionPreference = 'Stop'
$source = $PSScriptRoot
$dest = 'C:\projeto01\captacao\caca-promos-vip'
try {
    $arquivo = Join-Path $source 'src\contatos.mjs'
    if (!(Test-Path $arquivo)) { throw 'Extraia o ZIP completo antes da atualizacao.' }
    if (!(Test-Path (Join-Path $dest 'src\server.mjs'))) {
        throw ('Projeto antigo nao encontrado em ' + $dest + '. Use a instalacao completa primeiro.')
    }
    if ((Get-NetTCPConnection -LocalPort 3040 -State Listen -ErrorAction SilentlyContinue)) {
        throw 'O piloto esta ligado na porta 3040. Feche o aplicativo antigo antes de atualizar.'
    }
    $sourceFull = (Resolve-Path $source).Path
    $destFull = (Resolve-Path $dest).Path
    if ($sourceFull -eq $destFull) { throw 'Extraia a atualizacao numa pasta diferente da instalacao.' }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backup = Join-Path $dest ('backups\codigo-antes-v02-' + $stamp)
    New-Item -ItemType Directory -Force -Path $backup | Out-Null
    Copy-Item (Join-Path $dest 'src') (Join-Path $backup 'src') -Recurse -Force
    foreach ($item in @('package.json','README.md','iniciar-piloto.bat')) {
        if (Test-Path (Join-Path $dest $item)) {
            Copy-Item (Join-Path $dest $item) (Join-Path $backup $item) -Force
        }
    }
    foreach ($folder in @('src','tests','docs','modelos')) {
        $to = Join-Path $dest $folder
        New-Item -ItemType Directory -Force -Path $to | Out-Null
        Copy-Item -Path (Join-Path (Join-Path $source $folder) '*') -Destination $to -Recurse -Force
    }
    foreach ($item in @('package.json','README.md','iniciar-piloto.bat','Abrir Central de Contatos.cmd')) {
        Copy-Item (Join-Path $source $item) (Join-Path $dest $item) -Force
    }
    # Preserva todos os arquivos de dados, a chave de administrador e o historico.
    $folderScripts = Join-Path $dest 'scripts'
    New-Item -ItemType Directory -Force -Path $folderScripts | Out-Null
    Copy-Item (Join-Path $source 'scripts\abrir-central-v02.ps1') (Join-Path $folderScripts 'abrir-central-v02.ps1') -Force
    $shell = New-Object -ComObject WScript.Shell
    $desktop = [Environment]::GetFolderPath('Desktop')
    $link = Join-Path $desktop 'Caca Promos VIP - Central de Contatos.lnk'
    if (Test-Path $link) {
        $existing = $shell.CreateShortcut($link)
        if ($existing.TargetPath -ne (Join-Path $dest 'Abrir Central de Contatos.cmd')) {
            throw 'Existe um atalho com o mesmo nome apontando para outro programa.'
        }
    }
    $shortcut = $shell.CreateShortcut($link)
    $shortcut.TargetPath = Join-Path $dest 'Abrir Central de Contatos.cmd'
    $shortcut.WorkingDirectory = $dest
    $shortcut.Description = 'Central privada de contatos autorizados Caça Promos VIP'
    $shortcut.Save()
    Write-Host ''
    Write-Host 'Atualizacao v0.2 concluida sem alterar dados nem chaves.' -ForegroundColor Green
    Write-Host ('Backup do codigo anterior: ' + $backup)
    Write-Host ('Atalho criado: ' + $link)
    Write-Host 'Abra o atalho para iniciar o painel. Nenhuma mensagem sera enviada automaticamente.'
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
