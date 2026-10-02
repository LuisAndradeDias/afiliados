import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

interface OfertaMercadoLivre {
  urlProduto?: string;
  produtoId?: string;
}

interface PublicacaoCatalogo {
  item_id: string;
  condition?: string;
  price: number;
}

interface ItemBulk {
  status_code?: number;
  body?: {
    id?: string;
    permalink?: string;
    title?: string;
    status?: string;
  };
}

const token = process.env.MERCADOLIVRE_ACCESS_TOKEN?.trim();
if (!token) throw new Error("Mercado Livre API nao conectada.");

const oferta = await readFile(
  resolve("data", "ultima-oferta-mercadolivre.json"),
  "utf8"
)
  .then((texto) => JSON.parse(texto) as OfertaMercadoLivre)
  .catch(() => ({}));

if (!oferta.produtoId) {
  throw new Error("Nenhuma oferta do Mercado Livre foi encontrada para testar.");
}

const headers = {
  accept: "application/json",
  authorization: `Bearer ${token}`
};

const concorrencia = await fetch(
  `https://api.mercadolibre.com/products/${encodeURIComponent(oferta.produtoId)}/items`,
  { headers }
);
if (!concorrencia.ok) {
  throw new Error(`Competicao HTTP ${concorrencia.status}`);
}

const dadosConcorrencia = (await concorrencia.json()) as {
  results?: PublicacaoCatalogo[];
};
const publicacoes = (dadosConcorrencia.results ?? [])
  .filter((item) => item.condition === "new" && item.price > 0);

if (publicacoes.length === 0) {
  throw new Error("Produto sem publicacoes novas no momento.");
}

const ids = publicacoes.slice(0, 20).map((item) => item.item_id);
const detalhes = await fetch(
  "https://api.mercadolibre.com/items/bulk?ids=" +
    ids.join(","),
  { headers }
);
console.log(`Items bulk: HTTP ${detalhes.status}`);
if (!detalhes.ok) {
  console.log((await detalhes.text()).slice(0, 300));
  process.exit(1);
}

const textoDetalhes = await detalhes.text();
console.log("Items bulk resposta: " + textoDetalhes.slice(0, 1600));
const itens = JSON.parse(textoDetalhes) as ItemBulk[];
const primeiro = itens.find(
  (item) => item.status_code === 200 && item.body?.permalink
)?.body;

if (!primeiro?.permalink) {
  console.log(JSON.stringify(itens.map((x) => ({
    status: x.status_code,
    id: x.body?.id,
    temPermalink: Boolean(x.body?.permalink)
  }))));
  throw new Error("API nao retornou permalink para as publicacoes.");
}

console.log(`Item: ${primeiro.id ?? "-"}`);
console.log(`Permalink: ${primeiro.permalink}`);

const perfil = resolve("data", "mercadolivre-profile");
const canal = process.env.MERCADOLIVRE_BROWSER_CHANNEL ?? "chrome";
const context = await chromium.launchPersistentContext(perfil, {
  channel: canal,
  headless: true,
  viewport: { width: 1440, height: 1000 }
});

try {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(primeiro.permalink, {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  });
  await page.waitForTimeout(4_000);

  console.log(`URL final: ${page.url()}`);
  console.log(`Titulo pagina: ${await page.title()}`);

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
      marcadores.filter((item) => body.includes(item)).join(", ")
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
        .slice(0, 40)
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
