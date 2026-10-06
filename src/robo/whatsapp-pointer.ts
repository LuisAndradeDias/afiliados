import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Locator, Page } from "playwright";

const execFileAsync = promisify(execFile);

export interface GeometriaJanela {
  screenX: number;
  screenY: number;
  outerWidth: number;
  outerHeight: number;
  innerWidth: number;
  innerHeight: number;
}

export interface CaixaElemento {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function calcularCentroNaTela(
  caixa: CaixaElemento,
  janela: GeometriaJanela
): { x: number; y: number } {
  const bordaHorizontal = Math.max(
    0,
    (janela.outerWidth - janela.innerWidth) / 2
  );
  const chromeVertical = Math.max(
    0,
    janela.outerHeight - janela.innerHeight - bordaHorizontal
  );

  return {
    x: Math.round(
      janela.screenX + bordaHorizontal + caixa.x + caixa.width / 2
    ),
    y: Math.round(
      janela.screenY + chromeVertical + caixa.y + caixa.height / 2
    )
  };
}

async function powershellMouse(script: string): Promise<void> {
  await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      script
    ],
    {
      windowsHide: true,
      timeout: 8_000
    }
  );
}

export async function trazerWhatsappParaTelaPrincipal(): Promise<void> {
  const script = String.raw`
Add-Type -AssemblyName System.Windows.Forms

Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;

public static class WhatsappWindowNative {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [DllImport("user32.dll")]
  public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

  [DllImport("user32.dll")]
  public static extern bool MoveWindow(
    IntPtr hWnd,
    int X,
    int Y,
    int nWidth,
    int nHeight,
    bool bRepaint
  );

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool SetWindowPos(
    IntPtr hWnd,
    IntPtr hWndInsertAfter,
    int X,
    int Y,
    int cx,
    int cy,
    uint uFlags
  );
}
'@

$script:whatsappHandle = [IntPtr]::Zero
$script:whatsappProcessId = 0

[WhatsappWindowNative]::EnumWindows({
  param($hWnd, $lParam)

  if (-not [WhatsappWindowNative]::IsWindowVisible($hWnd)) {
    return $true
  }

  $titulo = New-Object System.Text.StringBuilder 512
  [WhatsappWindowNative]::GetWindowText(
    $hWnd,
    $titulo,
    $titulo.Capacity
  ) | Out-Null

  if ($titulo.ToString() -notmatch "WhatsApp") {
    return $true
  }

  [uint32]$processoId = 0
  [WhatsappWindowNative]::GetWindowThreadProcessId(
    $hWnd,
    [ref]$processoId
  ) | Out-Null

  try {
    $processo = Get-Process -Id $processoId -ErrorAction Stop
  } catch {
    return $true
  }

  if ($processo.ProcessName -notmatch "^chrome$") {
    return $true
  }

  $script:whatsappHandle = $hWnd
  $script:whatsappProcessId = $processoId
  return $false
}, [IntPtr]::Zero) | Out-Null

if ($script:whatsappHandle -eq [IntPtr]::Zero) {
  throw "Janela visível do WhatsApp no Chrome não encontrada."
}

$area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea

[WhatsappWindowNative]::ShowWindowAsync(
  $script:whatsappHandle,
  9
) | Out-Null

Start-Sleep -Milliseconds 120

[WhatsappWindowNative]::MoveWindow(
  $script:whatsappHandle,
  $area.X,
  $area.Y,
  $area.Width,
  $area.Height,
  $true
) | Out-Null

[WhatsappWindowNative]::ShowWindowAsync(
  $script:whatsappHandle,
  3
) | Out-Null

$SWP_NOMOVE = 0x0002
$SWP_NOSIZE = 0x0001
$SWP_SHOWWINDOW = 0x0040
$flags = $SWP_NOMOVE -bor $SWP_NOSIZE -bor $SWP_SHOWWINDOW

[WhatsappWindowNative]::SetWindowPos(
  $script:whatsappHandle,
  [IntPtr](-1),
  0, 0, 0, 0,
  $flags
) | Out-Null

[WhatsappWindowNative]::SetWindowPos(
  $script:whatsappHandle,
  [IntPtr](-2),
  0, 0, 0, 0,
  $flags
) | Out-Null

$wsh = New-Object -ComObject WScript.Shell
$wsh.AppActivate([int]$script:whatsappProcessId) | Out-Null

[WhatsappWindowNative]::SetForegroundWindow(
  $script:whatsappHandle
) | Out-Null

Start-Sleep -Milliseconds 180
Write-Output "OK"
`;

  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      windowsHide: true,
      timeout: 10_000
    }
  );

  if (!String(stdout).includes("OK")) {
    throw new Error(
      "O Windows não confirmou que o WhatsApp foi trazido para a tela principal."
    );
  }
}

async function moverCursorFisico(x: number, y: number): Promise<void> {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error("Coordenadas inválidas para o cursor físico.");
  }

  const destinoX = Math.round(x);
  const destinoY = Math.round(y);

  const script = `
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MouseNative {
  [StructLayout(LayoutKind.Sequential)]
  public struct POINT { public int X; public int Y; }

  [DllImport("user32.dll")]
  public static extern bool GetCursorPos(out POINT point);

  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int x, int y);
}
'@

$inicio = New-Object MouseNative+POINT
[MouseNative]::GetCursorPos([ref]$inicio) | Out-Null
$destinoX = ${destinoX}
$destinoY = ${destinoY}
$passos = 12

for ($i = 1; $i -le $passos; $i++) {
  $x = [Math]::Round($inicio.X + (($destinoX - $inicio.X) * $i / $passos))
  $y = [Math]::Round($inicio.Y + (($destinoY - $inicio.Y) * $i / $passos))
  [MouseNative]::SetCursorPos($x, $y) | Out-Null
  Start-Sleep -Milliseconds 22
}
`;

  await powershellMouse(script);
}

async function clicarCursorFisico(): Promise<void> {
  const script = `
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MouseNative {
  [DllImport("user32.dll")]
  public static extern void mouse_event(
    uint flags,
    uint dx,
    uint dy,
    uint data,
    UIntPtr extraInfo
  );
}
'@

[MouseNative]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 80
[MouseNative]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
`;

  await powershellMouse(script);
}

export async function clicarComPonteiro(
  page: Page,
  botao: Locator
): Promise<void> {
  await botao.waitFor({ state: "visible", timeout: 5_000 });
  await botao.scrollIntoViewIfNeeded();

  const desabilitado = await botao.isDisabled().catch(() => false);
  if (desabilitado) {
    throw new Error("O botão de envio está desabilitado.");
  }

  await page.bringToFront();
  await trazerWhatsappParaTelaPrincipal();
  await page.waitForTimeout(180);

  const caixa = await botao.boundingBox();
  if (!caixa || caixa.width < 2 || caixa.height < 2) {
    throw new Error("Não foi possível determinar a posição do botão de envio.");
  }

  const janela = await page.evaluate(() => ({
    screenX: window.screenX,
    screenY: window.screenY,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight
  }));

  const ponto = calcularCentroNaTela(caixa, janela);
  await moverCursorFisico(ponto.x, ponto.y);
  await page.waitForTimeout(120);

  const cursorRealSobreBotao = await botao.evaluate((elemento) =>
    elemento.matches(":hover")
  );

  if (!cursorRealSobreBotao) {
    throw new Error(
      "O cursor físico não ficou sobre o botão de envio; clique cancelado por segurança."
    );
  }

  await clicarCursorFisico();
}
