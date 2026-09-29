import { chromium, type Locator } from "playwright";
import type { FonteDeOfertas, Oferta } from "../types.js";
import { calcularDesconto, parsePrecoBR } from "./preco.js";

const AMAZON_BR = "https://www.amazon.com.br";

async function texto(locator: Locator): Promise<string | undefined> {
  if ((await locator.count()) === 0) return undefined;
  return (await locator.first().textContent())?.trim() || undefined;
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
        const precoAtualTexto = await texto(
          card.locator(".a-price:not(.a-text-price) .a-offscreen")
        );
        const precoAnteriorTexto = await texto(
          card.locator(".a-price.a-text-price .a-offscreen")
        );

        const precoAtual = parsePrecoBR(precoAtualTexto);
        const precoAnteriorLido = parsePrecoBR(precoAnteriorTexto);
        if (!titulo || !precoAtual) continue;

        const precoAnterior =
          precoAnteriorLido && precoAnteriorLido > precoAtual
            ? precoAnteriorLido
            : undefined;

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
          descontoPercentual: calcularDesconto(precoAtual, precoAnterior),
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
