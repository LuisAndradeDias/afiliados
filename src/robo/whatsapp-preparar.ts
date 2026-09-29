import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright";

const mensagemPath = resolve("data", "ultima-mensagem-whatsapp.txt");
const modoTeste = process.env.WHATSAPP_PREPARE_TEST === "true";
const canal = process.env.WHATSAPP_BROWSER_CHANNEL ?? "chrome";

const argumentoGrupo = process.argv.slice(2).join(" ").trim();
const nomeGrupo = argumentoGrupo || process.env.WHATSAPP_GROUP_NAME?.trim();

if (!nomeGrupo) {
  throw new Error(
    'Informe o grupo: npm run whatsapp:preparar -- "Nome exato do grupo" ou configure WHATSAPP_GROUP_NAME.'
  );
}

const mensagem = await readFile(mensagemPath, "utf8").catch(() => {
  throw new Error(
    "Mensagem não encontrada. Rode npm run whatsapp:preview ou npm run automatico primeiro."
  );
});
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
      // tenta o próximo seletor
    }
  }
  throw new Error("Elemento esperado não foi encontrado no WhatsApp Web.");
}

async function localizarBusca(page: Page): Promise<Locator> {
  return primeiroVisivel(
    [
      page.getByRole("textbox", { name: /pesquisar|search/i }),
      page.locator('#side div[contenteditable="true"][role="textbox"]'),
      page.locator('div[contenteditable="true"][data-tab="3"]'),
      page.locator('div[contenteditable="true"][aria-label*="Pesquisar"]')
    ],
    30_000
  );
}


async function obterPaginaWhatsapp(context: BrowserContext): Promise<Page> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const paginas = context.pages();
  let page = paginas.find((p) => p.url().startsWith("https://web.whatsapp.com"));

  if (!page) {
    page = paginas.find((p) => p.url() === "about:blank") ?? (await context.newPage());
    await page.goto("https://web.whatsapp.com/", {
      waitUntil: "domcontentloaded",
      timeout: 60_000
    });
  }

  await page.bringToFront();

  for (const extra of context.pages()) {
    if (extra === page) continue;
    const url = extra.url();
    const descartavel =
      url === "about:blank" ||
      url.startsWith("chrome://newtab") ||
      url.startsWith("https://web.whatsapp.com");

    if (descartavel) await extra.close().catch(() => undefined);
  }

  return page;
}

async function localizarCompositor(page: Page): Promise<Locator> {
  return primeiroVisivel([
    page.locator('footer div[contenteditable="true"][role="textbox"]'),
    page.locator('div[contenteditable="true"][data-tab="10"]'),
    page.locator('footer div[contenteditable="true"]')
  ]);
}
const pastaPerfil = resolve(
  "data",
  modoTeste ? "whatsapp-profile-test" : "whatsapp-profile"
);

let context;
try {
  context = await chromium.launchPersistentContext(pastaPerfil, {
    channel: canal,
    headless: modoTeste,
    viewport: modoTeste ? { width: 1280, height: 900 } : null,
    args: modoTeste ? [] : ["--start-maximized"]
  });
} catch (error) {
  throw new Error(
    "Não foi possível abrir o perfil do WhatsApp. Feche outra janela do projeto que esteja usando o mesmo perfil e tente novamente.",
    { cause: error }
  );
}

const page = modoTeste
  ? context.pages()[0] ?? (await context.newPage())
  : await obterPaginaWhatsapp(context);

if (modoTeste) {
  await page.setContent(`
    <div contenteditable="true" role="textbox" data-tab="3" aria-label="Pesquisar"></div>
    <div id="lista"><span title="${nomeGrupo}">${nomeGrupo}</span></div>
    <footer><div contenteditable="true" role="textbox" data-tab="10"></div></footer>
  `);
} else {
  console.log("Aguardando o WhatsApp Web ficar pronto...");
  console.log("Se aparecer QR Code, faça o login pelo celular. O programa continuará sozinho.");
}
try {
  const busca = await localizarBusca(page);
  await busca.fill(nomeGrupo);

  const resultadoGrupo = await primeiroVisivel(
    [
      page.getByTitle(nomeGrupo, { exact: true }),
      page.locator("[title]").filter({ hasText: nomeGrupo })
    ],
    8_000
  );
  await resultadoGrupo.click();

  const compositor = await localizarCompositor(page);
  await compositor.fill(mensagem.trim());

  const textoPreparado = (await compositor.textContent())?.trim() ?? "";
  if (!textoPreparado) {
    throw new Error("A mensagem não foi inserida no campo de conversa.");
  }

  console.log(`Mensagem preparada no grupo: ${nomeGrupo}`);
  console.log("Nenhuma tecla de envio foi acionada.");

  if (modoTeste) {
    console.log("Teste concluído: busca, abertura do grupo e preenchimento funcionaram.");
    await context.close();
    process.exit(0);
  }

  console.log("Revise a mensagem no Chrome e clique em Enviar manualmente.");
  console.log("Feche a janela do Chrome quando terminar.");

  await new Promise<void>((resolveClose) => {
    context.on("close", () => resolveClose());
  });
} catch (error) {
  await context.close();
  throw error;
}
