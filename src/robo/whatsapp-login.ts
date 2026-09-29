import "dotenv/config";
import { resolve } from "node:path";
import { chromium } from "playwright";

const profileDir = resolve("data", "whatsapp-profile");
const modoTeste = process.env.WHATSAPP_LOGIN_TEST === "true";
const canal = process.env.WHATSAPP_BROWSER_CHANNEL ?? "chrome";

console.log("Abrindo WhatsApp Web com perfil persistente...");
console.log(`Perfil: ${profileDir}`);

const context = await chromium.launchPersistentContext(profileDir, {
  channel: canal,
  headless: modoTeste,
  viewport: modoTeste ? { width: 1280, height: 900 } : null,
  args: modoTeste ? [] : ["--start-maximized"]
});

const pages = context.pages();
const page = pages[0] ?? (await context.newPage());

await page.goto("https://web.whatsapp.com/", {
  waitUntil: "domcontentloaded",
  timeout: 60_000
});
console.log(`Página aberta: ${await page.title()}`);

if (modoTeste) {
  console.log("Teste concluído: WhatsApp Web carregou corretamente.");
  await context.close();
  process.exit(0);
}

console.log("");
console.log("Se aparecer o QR Code, escaneie com o WhatsApp no celular.");
console.log("Depois aguarde suas conversas aparecerem.");
console.log("Quando terminar, feche a janela do Chrome.");
console.log("A sessão ficará salva para os próximos comandos.");

await new Promise<void>((resolveClose) => {
  context.on("close", () => resolveClose());
});

console.log("Sessão do WhatsApp salva em data/whatsapp-profile.");
