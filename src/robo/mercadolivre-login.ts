import "dotenv/config";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";

const profileDir = resolve("data", "mercadolivre-profile");
const canal = process.env.MERCADOLIVRE_BROWSER_CHANNEL ?? "chrome";
const painelAfiliados = "https://www.mercadolivre.com.br/afiliados";

function emFluxoLogin(page: Page): boolean {
  const url = page.url();
  return /login|identification|challenge|verification|registration/i.test(url);
}

async function abrirPainel(page: Page): Promise<boolean> {
  await page.goto(painelAfiliados, {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  }).catch(() => undefined);
  await page.waitForTimeout(4_000).catch(() => undefined);

  return !page.isClosed() && !emFluxoLogin(page);
}

console.log("Abrindo Mercado Livre com perfil persistente...");
console.log(`Perfil: ${profileDir}`);

const context = await chromium.launchPersistentContext(profileDir, {
  channel: canal,
  headless: false,
  viewport: null,
  args: ["--start-maximized"]
});

let page = context.pages()[0] ?? (await context.newPage());

if (await abrirPainel(page)) {
  console.log("LOGIN_CONFIRMADO: painel de afiliados acessivel.");
  await page.waitForTimeout(3_000).catch(() => undefined);
  await context.close();
  process.exit(0);
}

console.log("");
console.log("LOGIN_NECESSARIO: conclua o login nesta janela.");
console.log("Nao feche a janela. O programa validara o acesso ao painel e fechara sozinho.");

let confirmado = false;
for (let tentativa = 0; tentativa < 600; tentativa += 1) {
  if (context.pages().length === 0) break;
  page = context.pages()[0] ?? page;

  if (!page.isClosed() && !emFluxoLogin(page)) {
    if (await abrirPainel(page)) {
      confirmado = true;
      console.log("LOGIN_CONFIRMADO: painel de afiliados acessivel e sessao salva.");
      await page.waitForTimeout(5_000).catch(() => undefined);
      break;
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 1_000));
}

await context.close().catch(() => undefined);

if (!confirmado) {
  throw new Error(
    "Login do Mercado Livre nao foi confirmado dentro do tempo de espera."
  );
}
