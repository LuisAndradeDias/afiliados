$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$source = Join-Path $PSScriptRoot "PainelAfiliadosLauncher.cs"
$output = Join-Path $root "Iniciar-Painel-Afiliados.exe"
$icon = Join-Path $PSScriptRoot "painel.ico"
$compiler = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"

if (!(Test-Path $compiler)) {
    throw "O compilador C# do .NET Framework 4 nao foi encontrado."
}

$args = @(
    "/nologo",
    "/target:winexe",
    "/platform:anycpu",
    "/optimize+",
    "/out:$output",
    "/reference:System.Windows.Forms.dll",
    "/reference:System.Drawing.dll"
)
if (Test-Path $icon) {
    $args += "/win32icon:$icon"
}
$args += $source
& $compiler @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Output ("EXE=" + $output)
Write-Output ("BYTES=" + (Get-Item $output).Length)
