$ErrorActionPreference='Stop'
$base=$PSScriptRoot
$src=Join-Path $base '_upstream'
$send=Join-Path $src 'pkg\sendMessage\service\send_service.go'
$sticker=Join-Path $src 'pkg\sendMessage\service\sticker_webp.go'
foreach($f in @($send,$sticker)){if(-not(Test-Path $f)){throw "Fonte ausente: $f"}}
$enc=New-Object System.Text.UTF8Encoding($false)
# The original WebP encoder uses CGO. Only sticker conversion is disabled in the lab.
$text=[IO.File]::ReadAllText($send)
$old='"github.com/chai2010/webp"'
$new='"golang.org/x/image/webp"'
if($text.Contains($old)){
  $text=$text.Replace($old,$new)
  [IO.File]::WriteAllText($send,$text,$enc)
}
if(-not $text.Contains($new)){throw 'Decodificador WebP puro nao aplicado.'}
$text=[IO.File]::ReadAllText($sticker)
$oldImport='"github.com/chai2010/webp"'
if($text.Contains($oldImport)){
  $text=$text.Replace($oldImport,'')
}
$marker='conversao de stickers para WebP indisponivel neste laboratorio sem CGO'
if(-not $text.Contains($marker)){
  $startNeedle=([char]9)+'var buf bytes.Buffer'
  $endNeedle=([char]9)+'return buf.Bytes(), nil'
  $start=$text.IndexOf($startNeedle)
  if($start -lt 0){throw 'Inicio do encoder WebP nao encontrado.'}
  $end=$text.IndexOf($endNeedle,$start)
  if($end -lt 0){throw 'Fim do encoder WebP nao encontrado.'}
  $replace=([char]9)+'_ = img'+[Environment]::NewLine+([char]9)+'return nil, apierror.Invalid("'+$marker+'")'
  $text=$text.Substring(0,$start)+$replace+$text.Substring($end+$endNeedle.Length)
}
[IO.File]::WriteAllText($sticker,$text,$enc)
if(-not $text.Contains($marker)){throw 'Bloqueio explicito de sticker nao aplicado.'}
if($text -match 'if\s+err\s*:=\s*webp\.Encode\('){throw 'Encoder WebP com CGO ainda presente.'}
Write-Output 'CGO_OFF_PATCH_OK: somente conversao de stickers PNG/JPEG foi desativada.'
