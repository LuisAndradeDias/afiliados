import { chromium, type Locator } from "playwright";
import type { FonteDeOfertas, Oferta } from "../types.js";
import {
  extrairPrecosAnuncioAmazon,
  type PrecosAnuncioAmazon
} from "./preco-anuncio.js";

const AMAZON_BR = "https://www.amazon.com.br";

async function texto(locator: Locator): Promise<string | undefined> {
  if ((await locator.count()) === 0) return undefined;
  return (await locator.first().textContent())?.trim() || undefined;
}

/**
 * Lê os valores de um card da Amazon sem confundir preço da unidade
 * com preço por kg/100ml. Exportado para testes do DOM.
 */
export async function extrairPrecosCardAmazon(
  card: Locator
): Promise<PrecosAnuncioAmazon> {
  const precos = await card.locator(".a-price").evaluateAll((elementos) =>
    elementos.map((elemento) => {
      const referencia = elemento.classList.contains("a-text-price");
      const textoPreco =
        elemento.querySelector(".a-offscreen")?.textContent?.trim() ?? "";
      const contexto = referencia
        ? elemento.parentElement?.textContent?.replace(/\s+/g, " ").trim() ?? ""
        : elemento.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const riscado =
        elemento.getAttribute("data-a-strike") === "true" ||
        elemento.classList.contains("a-text-strike") ||
        Boolean(elemento.closest(".a-text-strike"));
      const unidade = Boolean(
        elemento.closest(
          '[class*="unit-price"],[class*="price-per-unit"],[data-testid*="unit-price"]'
        )
      );
      return { texto: textoPreco, contexto, riscado, unidade, referencia };
    })
  );

  return extrairPrecosAnuncioAmazon(
    precos.filter((preco) => !preco.referencia),
    precos.filter((preco) => preco.referencia)
  );
}

export class AmazonBrowserFonte implements FonteDeOfertas {
  nome = "amazon-browser-test";

  constructor(
    private readonly consulta: string,
    private readonly limite = 10
  ) {}

  async buscar(): Promise<Oferta[]> {
    const browser = await chromium.launch({
      channel: process.env.AMAZON_BROWSER_CHANNEL ?? "chrome",
      headless: true
    });
    const page = await browser.newPage({ locale: "pt-BR" });

    try {
      const url = new URL("/s", AMAZON_BR);
      url.searchParams.set("k", this.consulta);
      await page.goto(url.toString(), {
        waitUntil: "domcontentloaded",
        timeout: 30_000
      });

      await page.waitForTimeout(1_500);

      const tituloPagina = await page.title();
      const corpo = (await page.locator("body").textContent()) ?? "";
      const pagina = tituloPagina + corpo;

      if (/robot check|digite os caracteres|captcha/i.test(pagina)) {
        throw new Error(
          "Amazon apresentou verificacao anti-bot. O coletor nao tenta contornar essa protecao."
        );
      }

      if (/algo deu errado|sorry! something went wrong/i.test(pagina)) {
        throw new Error("Amazon retornou uma pagina de erro temporario.");
      }

      const cards = page.locator(
        '[data-component-type="s-search-result"], .s-result-item[data-asin]'
      );
      await cards.first().waitFor({ state: "visible", timeout: 15_000 });

      const total = Math.min(await cards.count(), this.limite);
      const ofertas: Oferta[] = [];

      for (let i = 0; i < total; i += 1) {
        const card = cards.nth(i);
        const asin = (await card.getAttribute("data-asin"))?.trim();
        if (!asin) continue;

        const titulo = await texto(card.locator("h2 span"));
        const { precoAtual, precoAnterior, descontoPercentual } =
          await extrairPrecosCardAmazon(card);
        if (!titulo || !precoAtual) continue;

        const imagem =
          (await card.locator("img.s-image").count()) > 0
            ? await card.locator("img.s-image").first().getAttribute("src")
            : undefined;
        const conteudo = (await card.textContent()) ?? "";
        const cupomMatch = conteudo.match(/cupom[^\n]{0,60}/i);

        ofertas.push({
          plataforma: "Amazon Brasil",
          produtoId: asin,
          titulo,
          precoAtual,
          precoAnterior,
          descontoPercentual,
          cupom: cupomMatch?.[0]?.replace(/\s+/g, " ").trim(),
          imagem: imagem ?? undefined,
          urlProduto: `${AMAZON_BR}/dp/${asin}`,
          encontradoEm: new Date()
        });
      }

      return ofertas;
    } finally {
      await browser.close();
    }
  }
}
