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
