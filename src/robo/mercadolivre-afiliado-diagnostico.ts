import "dotenv/config";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";

const perfil = resolve("data", "mercadolivre-profile");
const canal = process.env.MERCADOLIVRE_BROWSER_CHANNEL ?? "chrome";
const painelAfiliados = "https://www.mercadolivre.com.br/afiliados";

function emFluxoLogin(page: Page): boolean {
  const url = page.url();
  return (
    /login|identification|challenge|verification|registration/i.test(url)
  );
}

async function loginVisivel(page: Page): Promise<boolean> {
  return (
    (await page
      .locator('a[href*="/jms/mlb/lgz/login"]:visible')
      .count()
      .catch(() => 0)) > 0
  );
}

const context = await chromium.launchPersistentContext(perfil, {
  channel: canal,
  headless: false,
  viewport: null,
  args: ["--start-maximized"]
});

try {
  let page = context.pages()[0] ?? (await context.newPage());
  await page.goto(painelAfiliados, {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  });
  await page.waitForTimeout(3_000);

  if (emFluxoLogin(page) || (await loginVisivel(page))) {
    const entrar = page.locator('a[href*="/jms/mlb/lgz/login"]:visible').first();
    const href = await entrar.getAttribute("href").catch(() => null);

    if (href) {
      await page.goto(href, {
        waitUntil: "domcontentloaded",
        timeout: 60_000
      });
    }

    console.log("LOGIN_NECESSARIO: conclua o login nesta janela.");
    console.log("A janela continuara aberta e o teste seguira sozinho.");

    let saiuDoLogin = false;
    for (let i = 0; i < 600; i += 1) {
      if (context.pages().length === 0) break;
      page = context.pages()[0] ?? page;

      if (!page.isClosed() && !emFluxoLogin(page)) {
        await page.waitForTimeout(5_000).catch(() => undefined);
        saiuDoLogin = !emFluxoLogin(page);
        if (saiuDoLogin) break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }

    if (!saiuDoLogin) {
      throw new Error("Login nao foi concluido dentro do tempo de espera.");
    }
  }

  await page.goto(painelAfiliados, {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  });
  await page.waitForTimeout(6_000);

  console.log(`URL painel: ${page.url()}`);
  console.log(`Titulo: ${await page.title().catch(() => "")}`);

  const body = await page.locator("body").innerText().catch(() => "");
  const termos = [
    "Gerador de Links",
    "Gerador de links",
    "Afiliados",
    "Criadores",
    "Métricas",
    "Receitas",
    "Configurações",
    "Entre"
  ];
  console.log(
    "Marcadores: " +
      termos.filter((termo) =>
        body.toLowerCase().includes(termo.toLowerCase())
      ).join(", ")
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
          /gerador|afiliad|criador|m[eé]trica|receita|configura|link|recomend/i.test(
            item.texto + " " + item.aria + " " + item.href
          )
        )
        .slice(0, 100)
    );

  console.log("Candidatos:");
  console.log(JSON.stringify(candidatos, null, 2));

  await page.screenshot({
    path: resolve("data", "mercadolivre-afiliado-diagnostico.png"),
    fullPage: false
  });
} finally {
  await context.close().catch(() => undefined);
}
