import "dotenv/config";
import { resolve } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";

const profileDir = resolve("data", "mercadolivre-profile");
const canal = process.env.MERCADOLIVRE_BROWSER_CHANNEL ?? "chrome";
const portal = "https://www.mercadolivre.com.br/l/afiliados-home";

async function fecharAbasExtras(
  context: BrowserContext,
  principal: Page
): Promise<void> {
  for (const extra of context.pages()) {
    if (extra === principal) continue;
    await extra.close().catch(() => undefined);
  }
  await principal.bringToFront();
}

async function temLinkEntrar(page: Page): Promise<boolean> {
  return (
    (await page
      .locator('a[href*="/jms/mlb/lgz/login"]:visible')
      .count()
      .catch(() => 1)) > 0
  );
}

async function estaLogado(page: Page): Promise<boolean> {
  if (page.isClosed()) return false;
  if (/\/jms\/mlb\/lgz\/login/i.test(page.url())) return false;
  return !(await temLinkEntrar(page));
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
await page.goto(portal, {
  waitUntil: "domcontentloaded",
  timeout: 60_000
});
await page.waitForTimeout(1_500);
await fecharAbasExtras(context, page);

if (await estaLogado(page)) {
  console.log("LOGIN_CONFIRMADO: a sessao web do Mercado Livre ja esta autenticada.");
  await context.close();
  process.exit(0);
}

const entrar = page.locator('a[href*="/jms/mlb/lgz/login"]:visible').first();
const hrefEntrar = await entrar.getAttribute("href").catch(() => null);
if (hrefEntrar) {
  console.log("Abrindo a tela oficial de login do Mercado Livre...");
  await page.goto(hrefEntrar, {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  });
}

console.log("");
console.log("Conclua o login e qualquer verificacao normal nessa janela.");
console.log("Nao feche a janela: ela fechara automaticamente apos confirmar a sessao.");

let confirmado = false;
for (let tentativa = 0; tentativa < 600; tentativa += 1) {
  if (context.pages().length === 0) break;

  page = context.pages()[0] ?? page;
  if (!page.isClosed() && !/\/jms\/mlb\/lgz\/login/i.test(page.url())) {
    if (!page.url().includes("/l/afiliados-home")) {
      await page.goto(portal, {
        waitUntil: "domcontentloaded",
        timeout: 60_000
      }).catch(() => undefined);
      await page.waitForTimeout(1_000).catch(() => undefined);
    }

    if (await estaLogado(page)) {
      confirmado = true;
      console.log("LOGIN_CONFIRMADO: sessao web autenticada e salva.");
      await page.waitForTimeout(2_500).catch(() => undefined);
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
