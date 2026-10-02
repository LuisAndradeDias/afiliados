import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Locator, type Page } from "playwright";

interface OfertaMercadoLivre {
  titulo?: string;
  urlProduto?: string;
  urlAfiliado?: string;
}

const ofertaPath = resolve("data", "ultima-oferta-mercadolivre.json");
const perfil = resolve("data", "mercadolivre-profile");
const canal = process.env.MERCADOLIVRE_BROWSER_CHANNEL ?? "chrome";
const painelAfiliados = "https://www.mercadolivre.com.br/afiliados";

const oferta = await readFile(ofertaPath, "utf8")
  .then((texto) => JSON.parse(texto) as OfertaMercadoLivre)
  .catch(() => ({} as OfertaMercadoLivre));

if (!oferta.urlProduto) {
  throw new Error(
    "Nenhuma oferta do Mercado Livre encontrada. Busque uma oferta primeiro."
  );
}

function emFluxoLogin(page: Page): boolean {
  return /login|identification|challenge|verification|registration/i.test(
    page.url()
  );
}

async function primeiroVisivel(
  candidatos: Locator[],
  timeoutPorSeletor = 4_000
): Promise<Locator> {
  for (const candidato of candidatos) {
    const atual = candidato.first();
    try {
      await atual.waitFor({ state: "visible", timeout: timeoutPorSeletor });
      return atual;
    } catch {
      // tenta o proximo seletor
    }
  }

  throw new Error("Elemento esperado nao foi encontrado.");
}

async function abrirPainel(page: Page): Promise<boolean> {
  await page.goto(painelAfiliados, {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  }).catch(() => undefined);
  await page.waitForTimeout(4_000).catch(() => undefined);
  return !page.isClosed() && !emFluxoLogin(page);
}

async function garantirLogin(page: Page): Promise<void> {
  if (await abrirPainel(page)) return;

  console.log("LOGIN_NECESSARIO: conclua o login na janela do Mercado Livre.");
  console.log("O processo continuara sozinho apos validar o painel de afiliados.");

  for (let tentativa = 0; tentativa < 600; tentativa += 1) {
    if (page.isClosed()) {
      throw new Error("A janela do Mercado Livre foi fechada antes do login.");
    }

    if (!emFluxoLogin(page) && await abrirPainel(page)) {
      console.log("LOGIN_CONFIRMADO: painel de afiliados acessivel.");
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error("Login do Mercado Livre nao foi concluido a tempo.");
}

async function abrirGerador(page: Page): Promise<void> {
  const gerador = await primeiroVisivel(
    [
      page.getByRole("link", { name: /gerador de links|criar link/i }),
      page.getByRole("button", { name: /gerador de links|criar link/i }),
      page.getByText(/gerador de links/i, { exact: true }),
      page.getByText(/criar link/i, { exact: true })
    ],
    3_000
  );

  await gerador.click();
  await page.waitForTimeout(2_500);
  console.log(`Gerador aberto: ${page.url()}`);
}

async function preencherProduto(page: Page, urlProduto: string): Promise<void> {
  const campo = await primeiroVisivel(
    [
      page.getByPlaceholder(/insira.*url|cole.*url|url.*produto|link.*produto/i),
      page.locator("textarea").filter({ visible: true }),
      page.locator('input[type="url"]').filter({ visible: true }),
      page.locator('input[type="text"]').filter({ visible: true })
    ],
    3_000
  );

  await campo.fill(urlProduto);
  console.log("URL do produto preenchida no Gerador de Links.");
}

async function gerar(page: Page): Promise<void> {
  const botao = await primeiroVisivel(
    [
      page.getByRole("button", { name: /^gerar$/i }),
      page.getByRole("button", { name: /gerar link/i }),
      page.getByText(/^gerar$/i, { exact: true })
    ],
    4_000
  );

  await botao.click();
  console.log("Geracao solicitada ao Mercado Livre.");
}

async function lerClipboard(page: Page): Promise<string | undefined> {
  try {
    const copiar = await primeiroVisivel(
      [
        page.getByRole("button", { name: /copiar/i }),
        page.getByText(/^copiar$/i, { exact: true })
      ],
      1_500
    );
    await copiar.click();
    await page.waitForTimeout(500);

    const valor = await page.evaluate(() =>
      navigator.clipboard.readText().catch(() => "")
    );
    return /^https?:\/\//i.test(valor.trim()) ? valor.trim() : undefined;
  } catch {
    return undefined;
  }
}

async function linksDaPagina(page: Page): Promise<string[]> {
  return page.locator("a, input, textarea").evaluateAll((elementos) => {
    const urls: string[] = [];

    for (const el of elementos) {
      const candidatos = [
        el instanceof HTMLAnchorElement ? el.href : "",
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
          ? el.value
          : "",
        el.textContent ?? ""
      ];

      for (const valor of candidatos) {
        const texto = valor.trim();
        if (/^https?:\/\//i.test(texto)) urls.push(texto);
      }
    }

    return [...new Set(urls)];
  });
}

function escolherLinkAfiliado(
  links: string[],
  original: string
): string | undefined {
  const diferentes = links.filter((link) => link !== original);
  return (
    diferentes.find((link) => /^https:\/\/meli\.la\//i.test(link)) ??
    diferentes.find((link) => /mercadolivre\.com\/sec\//i.test(link)) ??
    diferentes.find((link) => /mercadolivre\.com\.br.*(?:affiliate|afiliad)/i.test(link))
  );
}

const context = await chromium.launchPersistentContext(perfil, {
  channel: canal,
  headless: false,
  viewport: null,
  args: ["--start-maximized"]
});

await context.grantPermissions(
  ["clipboard-read", "clipboard-write"],
  { origin: "https://www.mercadolivre.com.br" }
).catch(() => undefined);

try {
  const page = context.pages()[0] ?? (await context.newPage());
  await garantirLogin(page);
  await abrirGerador(page);
  await preencherProduto(page, oferta.urlProduto);

  const antes = new Set(await linksDaPagina(page));
  await gerar(page);

  let linkAfiliado: string | undefined;
  for (let tentativa = 0; tentativa < 30; tentativa += 1) {
    await page.waitForTimeout(1_000);
    const links = (await linksDaPagina(page)).filter((link) => !antes.has(link));
    linkAfiliado = escolherLinkAfiliado(links, oferta.urlProduto);
    if (linkAfiliado) break;
  }

  if (!linkAfiliado) {
    const copiado = await lerClipboard(page);
    if (copiado) {
      linkAfiliado = escolherLinkAfiliado([copiado], oferta.urlProduto);
    }
  }

  if (!linkAfiliado) {
    await page.screenshot({
      path: resolve("data", "mercadolivre-gerador-erro.png"),
      fullPage: false
    });
    throw new Error(
      "O Mercado Livre nao exibiu um link de afiliado reconhecivel. " +
      "A tela foi salva em data/mercadolivre-gerador-erro.png."
    );
  }

  oferta.urlAfiliado = linkAfiliado;
  await writeFile(ofertaPath, JSON.stringify(oferta, null, 2), "utf8");
  await writeFile(
    resolve("data", "ultimo-link-afiliado-mercadolivre.txt"),
    linkAfiliado + "\n",
    "utf8"
  );

  console.log(`LINK_AFILIADO_CONFIRMADO: ${linkAfiliado}`);
  await page.waitForTimeout(2_000);
} finally {
  await context.close().catch(() => undefined);
}
