import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  normalizarImagemAmazonAltaResolucao,
  renderizarArteOferta
} from "../src/imagens/oferta.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const thumb =
  "https://m.media-amazon.com/images/I/71OaSITlTkL._AC_UL320_.jpg";
assert(
  normalizarImagemAmazonAltaResolucao(thumb) ===
    "https://m.media-amazon.com/images/I/71OaSITlTkL.jpg",
  "URL Amazon não foi normalizada para a imagem sem sufixo de thumbnail."
);

assert(
  normalizarImagemAmazonAltaResolucao(
    "https://example.com/foto._AC_UL320_.jpg"
  ) === "https://example.com/foto._AC_UL320_.jpg",
  "URL externa não deveria ser alterada."
);

const dir = resolve("data", "testes");
const saida = resolve(dir, "arte-oferta.jpg");
await mkdir(dir, { recursive: true });

const svg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="white"/><circle cx="600" cy="450" r="300" fill="black"/></svg>'
)}`;

const caminho = await renderizarArteOferta(
  {
    plataforma: "Amazon Brasil",
    titulo: "Produto de teste para validar a arte de oferta",
    precoAtual: 99.9,
    precoAnterior: 149.9,
    descontoPercentual: 33,
    imagemUrl: svg
  },
  saida
);

assert(caminho === saida, "Renderizador não retornou o caminho de saída.");

const bytes = await readFile(saida);
assert(bytes.length > 10_000, "Arte gerada ficou pequena demais.");

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`file:///${saida.replaceAll("\\", "/")}`);
  const dimensoes = await page.locator("img").evaluate((img: HTMLImageElement) => ({
    width: img.naturalWidth,
    height: img.naturalHeight
  }));

  assert(
    dimensoes.width === 1080 && dimensoes.height === 1350,
    `Arte deveria ter 1080x1350, recebeu ${dimensoes.width}x${dimensoes.height}.`
  );
} finally {
  await browser.close();
}

await rm(dir, { recursive: true, force: true });
console.log("imagem-oferta: OK");
