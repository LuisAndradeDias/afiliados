$ErrorActionPreference="Stop"
Add-Type -AssemblyName System.Drawing
$projectRoot=(Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$source=Join-Path $projectRoot "data\instagram\brand\caca-promos-avatar.png"
$destination=Join-Path $PSScriptRoot "painel.ico"
if (!(Test-Path $source)) {
  throw "Logo original nao encontrada em: $source"
}
$sizes=@(16,32,48,64,128,256)
$img=[System.Drawing.Image]::FromFile($source)
$images=New-Object 'System.Collections.Generic.List[byte[]]'
try {
 foreach($size in $sizes){
  $bmp=New-Object System.Drawing.Bitmap($size,$size,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g=[System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.CompositingQuality=[System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.DrawImage($img,0,0,$size,$size)
  $stream=New-Object System.IO.MemoryStream
  $bmp.Save($stream,[System.Drawing.Imaging.ImageFormat]::Png)
  $images.Add($stream.ToArray())
  $stream.Dispose()
  $g.Dispose()
  $bmp.Dispose()
 }
} finally { $img.Dispose() }
$memory=New-Object System.IO.MemoryStream
$writer=New-Object System.IO.BinaryWriter($memory)
$writer.Write([uint16]0)
$writer.Write([uint16]1)
$writer.Write([uint16]$sizes.Count)
$offset=6+16*$sizes.Count
for($i=0;$i -lt $sizes.Count;$i++){
  $n=$sizes[$i]
  $writer.Write([byte]($n % 256))
  $writer.Write([byte]($n % 256))
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([uint16]1)
  $writer.Write([uint16]32)
  $writer.Write([uint32]$images[$i].Length)
  $writer.Write([uint32]$offset)
  $offset+=$images[$i].Length
}
foreach($image in $images){$writer.Write([byte[]]$image)}
[System.IO.File]::WriteAllBytes($destination,$memory.ToArray())
$writer.Dispose()
$memory.Dispose()
Write-Output ("ICON_CREATED="+$destination)
Write-Output ("ICON_BYTES="+(Get-Item $destination).Length)
Write-Output ("ICON_IMAGES="+$sizes.Count)
