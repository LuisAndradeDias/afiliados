import "dotenv/config";
import { resolve } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";

const profileDir = resolve("data", "mercadolivre-profile");
const canal = process.env.MERCADOLIVRE_BROWSER_CHANNEL ?? "chrome";

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

console.log("Abrindo Mercado Livre com perfil persistente...");
console.log(`Perfil: ${profileDir}`);
const context = await chromium.launchPersistentContext(profileDir, {
  channel: canal,
  headless: false,
  viewport: null,
  args: ["--start-maximized"]
});

const page = context.pages()[0] ?? (await context.newPage());
await page.goto("https://www.mercadolivre.com.br/l/afiliados-home", {
  waitUntil: "domcontentloaded",
  timeout: 60_000
});
await page.waitForTimeout(1_000);
await fecharAbasExtras(context, page);

console.log(`Página aberta: ${await page.title()}`);
console.log("");
console.log("Entre na sua conta do Mercado Livre e acesse Afiliados e Criadores.");
console.log("Se ainda não participa do programa, conclua o cadastro.");
console.log("Quando terminar, feche a janela do Chrome.");
console.log("A sessão ficará salva para os próximos passos.");

await new Promise<void>((resolveClose) => {
  context.on("close", () => resolveClose());
});

console.log("Sessão do Mercado Livre salva em data/mercadolivre-profile.");
