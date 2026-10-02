import "dotenv/config";
import { resolve } from "node:path";
import { chromium } from "playwright";

const perfil = resolve("data", "mercadolivre-profile");
const canal = process.env.MERCADOLIVRE_BROWSER_CHANNEL ?? "chrome";
const context = await chromium.launchPersistentContext(perfil, {
  channel: canal,
  headless: true,
  viewport: { width: 1440, height: 1000 }
});

try {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto("https://www.mercadolivre.com.br/l/afiliados-home", {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  });
  await page.waitForTimeout(4_000);

  console.log(`URL final: ${page.url()}`);
  console.log(`Titulo: ${await page.title()}`);

  const body = (await page.locator("body").innerText().catch(() => ""));
  const termos = [
    "Gerador de Links",
    "Gerador de links",
    "Afiliados",
    "Criadores",
    "Configurações",
    "Entrar"
  ];
  console.log(
    "Marcadores: " +
      termos.filter((termo) => body.toLowerCase().includes(termo.toLowerCase())).join(", ")
  );

  const candidatos = await page
    .locator("a, button, [role=button]")
    .evaluateAll((elementos) =>
      elementos
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          texto: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
          aria: el.getAttribute("aria-label") ?? "",
          href: el instanceof HTMLAnchorElement ? el.href : ""
        }))
        .filter((item) =>
          /gerador|afiliad|criador|configura|link|recomend/i.test(
            item.texto + " " + item.aria + " " + item.href
          )
        )
        .slice(0, 80)
    );

  console.log("Candidatos:");
  console.log(JSON.stringify(candidatos, null, 2));

  await page.screenshot({
    path: resolve("data", "mercadolivre-afiliado-diagnostico.png"),
    fullPage: false
  });
} finally {
  await context.close();
}
