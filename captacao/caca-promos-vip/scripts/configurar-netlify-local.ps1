param(
  [Parameter(Mandatory=$true)]
  [string]$SiteUrl
)
$ErrorActionPreference='Stop'
$uri=[Uri]$SiteUrl
if($uri.Scheme -ne 'https' -or !$uri.Host -or $uri.UserInfo -or
  $uri.AbsolutePath -ne '/' -or $uri.Query -or $uri.Fragment -or
  $uri.Host -in @('localhost','127.0.0.1','0.0.0.0')) {
  throw 'Informe somente a origem HTTPS pública, sem caminho nem parâmetros.'
}
$dados=Join-Path (Split-Path $PSScriptRoot -Parent) 'dados\previa-acer'
$segredoArquivo=Join-Path $dados 'denuncias-netlify-segredo-local.txt'
if(!(Test-Path -LiteralPath $segredoArquivo)){
  throw 'Segredo local do Netlify não encontrado. Configure o segredo no ACER antes de ativar.'
}
$segredo=(Get-Content -LiteralPath $segredoArquivo -Raw).Trim()
if($segredo -notmatch '^[a-f0-9]{64}$') {
  throw 'Segredo local inválido.'
}
$destino=Join-Path $dados 'denuncias-netlify-config.json'
$valor=[pscustomobject]@{publicBaseUrl=$uri.GetLeftPart('Authority');segredo=$segredo}
$json=$valor|ConvertTo-Json -Compress
[System.IO.File]::WriteAllText($destino,$json,[System.Text.UTF8Encoding]::new($false))
Write-Output ('NETLIFY_CONFIGURED='+$uri.GetLeftPart('Authority'))
Write-Output 'SEGREDO_OMITIDO_NA_SAIDA=true'
Write-Output 'REINICIE_O_SERVIDOR_3045_APOS_VERIFICAR_HTTPS_PUBLICO'
