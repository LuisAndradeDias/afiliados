import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium } from "playwright";

export interface OfertaArte {
  plataforma?: string;
  titulo: string;
  precoAtual?: number;
  precoAnterior?: number;
  descontoPercentual?: number;
  descontoEfetivoPercentual?: number;
  imagemUrl?: string;
}

export function normalizarImagemAmazonAltaResolucao(
  url?: string
): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    if (!/amazon\.(com\.br|com)$|media-amazon\.com$/i.test(parsed.hostname)) {
      return url;
    }

    parsed.pathname = parsed.pathname.replace(
      /\._[^/]+_\.(jpe?g|png|webp)$/i,
      ".$1"
    );
    return parsed.toString();
  } catch {
    return url;
  }
}

function escaparHtml(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatarPreco(valor?: number): string {
  if (!valor || !Number.isFinite(valor)) return "";
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

export async function renderizarArteOferta(
  oferta: OfertaArte,
  caminhoSaida: string
): Promise<string | undefined> {
  if (!oferta.imagemUrl) return undefined;

  await mkdir(dirname(caminhoSaida), { recursive: true });

  const browser = await chromium.launch({
    channel: process.env.AMAZON_BROWSER_CHANNEL ?? "chrome",
    headless: true
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1080, height: 1350 },
      deviceScaleFactor: 1
    });

    const desconto =
      oferta.descontoEfetivoPercentual ??
      oferta.descontoPercentual ??
      0;
    const tituloPlataforma = /mercado livre/i.test(oferta.plataforma ?? "")
      ? "OFERTA MERCADO LIVRE"
      : "OFERTA AMAZON";
    const imagem = escaparHtml(oferta.imagemUrl);
    const titulo = escaparHtml(oferta.titulo);
    const precoAtual = escaparHtml(formatarPreco(oferta.precoAtual));
    const precoAnterior = escaparHtml(formatarPreco(oferta.precoAnterior));

    await page.setContent(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
* { box-sizing: border-box; }
html, body { margin: 0; width: 1080px; height: 1350px; overflow: hidden; font-family: Arial, Helvetica, sans-serif; background: #f6f7f9; }
.card { width: 1080px; height: 1350px; padding: 64px; display: flex; flex-direction: column; gap: 28px; }
.badge { align-self: flex-start; font-size: 38px; line-height: 1; font-weight: 800; letter-spacing: 1.5px; background: #111827; color: white; border-radius: 18px; padding: 18px 24px; }
.image-box { flex: 1; min-height: 0; background: white; border-radius: 34px; padding: 54px; display: flex; align-items: center; justify-content: center; box-shadow: 0 14px 40px rgba(0,0,0,.08); }
.image-box img { width: 100%; height: 100%; object-fit: contain; object-position: center; }
.title { font-size: 44px; line-height: 1.12; font-weight: 750; color: #111827; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.price-row { display: flex; align-items: end; justify-content: space-between; gap: 24px; }
.prices { display: flex; flex-direction: column; gap: 6px; }
.old { font-size: 28px; color: #6b7280; text-decoration: line-through; min-height: 34px; }
.current { font-size: 64px; line-height: 1; font-weight: 900; color: #111827; }
.discount { flex: 0 0 auto; font-size: 42px; font-weight: 900; background: #facc15; color: #111827; border-radius: 22px; padding: 18px 24px; }
</style>
</head>
<body>
  <main class="card">
    <div class="badge">${tituloPlataforma}</div>
    <div class="image-box"><img id="produto" src="${imagem}" alt=""></div>
    <div class="title">${titulo}</div>
    <div class="price-row">
      <div class="prices">
        <div class="old">${precoAnterior}</div>
        <div class="current">${precoAtual}</div>
      </div>
      <div class="discount">${desconto > 0 ? `${Math.round(desconto)}% OFF` : "OFERTA"}</div>
    </div>
  </main>
</body>
</html>`, { waitUntil: "load" });

    await page.locator("#produto").evaluate(async (img: HTMLImageElement) => {
      if (img.complete && img.naturalWidth > 0) return;
      await new Promise<void>((resolve, reject) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => reject(new Error("imagem falhou")), { once: true });
        setTimeout(() => reject(new Error("timeout de imagem")), 15_000);
      });
    });

    await page.screenshot({
      path: caminhoSaida,
      type: "jpeg",
      quality: 94,
      fullPage: false
    });

    return caminhoSaida;
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : String(error);
    console.warn(`Não foi possível renderizar a arte da oferta: ${mensagem}`);
    return undefined;
  } finally {
    await browser.close();
  }
}
