import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

interface OfertaMercadoLivre {
  urlProduto?: string;
  produtoId?: string;
}

const oferta = await readFile(
  resolve("data", "ultima-oferta-mercadolivre.json"),
  "utf8"
)
  .then((texto) => JSON.parse(texto) as OfertaMercadoLivre)
  .catch(() => ({}));

if (!oferta.urlProduto) {
  throw new Error("Nenhuma oferta do Mercado Livre foi encontrada para testar.");
}

const perfil = resolve("data", "mercadolivre-profile");
const canal = process.env.MERCADOLIVRE_BROWSER_CHANNEL ?? "chrome";

const context = await chromium.launchPersistentContext(perfil, {
  channel: canal,
  headless: true,
  viewport: { width: 1440, height: 1000 }
});

try {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(oferta.urlProduto, {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  });
  await page.waitForTimeout(3_000);

  console.log(`Produto: ${oferta.produtoId ?? "-"}`);
  console.log(`URL final: ${page.url()}`);
  console.log(`Titulo: ${await page.title()}`);

  const body = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  const marcadores = [
    "afiliado",
    "gerar link",
    "copiar link",
    "compartilhar",
    "etiqueta",
    "entrar",
    "iniciar sessão",
    "verificação"
  ];

  console.log(
    "Marcadores: " +
      marcadores
        .filter((item) => body.includes(item))
        .join(", ")
  );

  const candidatos = await page
    .locator("button, a, [role=button]")
    .evaluateAll((elementos) =>
      elementos
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          texto: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
          aria: el.getAttribute("aria-label") ?? "",
          href: el instanceof HTMLAnchorElement ? el.href : ""
        }))
        .filter((item) =>
          /afiliad|gerar|copiar|compartilh|etiquet|link/i.test(
            item.texto + " " + item.aria
          )
        )
        .slice(0, 30)
    );

  console.log("Candidatos:");
  console.log(JSON.stringify(candidatos, null, 2));

  await page.screenshot({
    path: resolve("data", "mercadolivre-afiliado-diagnostico.png"),
    fullPage: false
  });
  console.log("Screenshot salva em data/mercadolivre-afiliado-diagnostico.png");
} finally {
  await context.close();
}
