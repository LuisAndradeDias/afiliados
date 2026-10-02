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

async function estaLogado(page: Page): Promise<boolean> {
  if (/\/login|\/registration/i.test(page.url())) return false;

  const linksLogin = await page
    .locator('a[href*="/jms/mlb/lgz/login"], a[href*="/registration"]')
    .count()
    .catch(() => 1);

  return linksLogin === 0;
}

console.log("Abrindo Mercado Livre com perfil persistente...");
console.log(`Perfil: ${profileDir}`);

const context = await chromium.launchPersistentContext(profileDir, {
  channel: canal,
  headless: false,
  viewport: null,
  args: ["--start-maximized"]
});

const page = context.pages()[0] ?? (await context.newPage());
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

console.log("");
console.log("Entre na sua conta do Mercado Livre nesta janela.");
console.log("Conclua qualquer verificacao normal solicitada pelo site.");
console.log("Nao feche a janela: o programa fechara sozinho quando detectar o login.");

let confirmado = false;
for (let tentativa = 0; tentativa < 360; tentativa += 1) {
  if (context.pages().length === 0) break;

  const atual = context.pages()[0] ?? page;
  if (await estaLogado(atual)) {
    confirmado = true;
    console.log("LOGIN_CONFIRMADO: sessao web autenticada e salva.");
    await atual.waitForTimeout(2_000).catch(() => undefined);
    break;
  }

  await new Promise((resolve) => setTimeout(resolve, 1_000));
}

await context.close().catch(() => undefined);

if (!confirmado) {
  throw new Error(
    "Login do Mercado Livre nao foi confirmado. Abra novamente e conclua a autenticacao."
  );
}
