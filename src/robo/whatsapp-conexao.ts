import type { Page } from "playwright";

/** Sinais visuais sem capturar QR, cookies, chats nem dados da conta. */
export type EstadoVisualWhatsapp = "conectado" | "qr" | "aguardando" | "fechada";

export async function detectarEstadoVisualWhatsapp(
  page: Page
): Promise<EstadoVisualWhatsapp> {
  if (page.isClosed()) return "fechada";

  try {
    // O painel de conversas somente existe apos a autenticacao.
    const lista = page.locator(
      '#pane-side, #side, [data-testid="chat-list"], [data-testid="chat-list-container"]'
    ).first();
    if (await lista.isVisible()) return "conectado";

    // Sinal estrutural do QR, sem ler dados/codigo nem executar login.
    const qr = page.locator(
      '[data-testid="qrcode"] canvas, canvas[aria-label="Scan me!"], canvas[data-ref]'
    ).first();
    if (await qr.isVisible()) return "qr";
  } catch {
    if (page.isClosed()) return "fechada";
  }
  return "aguardando";
}
