import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium } from "playwright";
import { responderRotaVisual } from "../src/painel/rotas-visuais.js";

const snapshot = {
  modo: "somente-leitura",
  consultadoEm: "2026-10-29T12:00:00.000Z",
  resumo: { candidatos: 2, bloqueados: 1, necessitamRevisao: 1, aprovados: 0 },
  avisos: [],
  fichas: [
    {
      id: "teste-1",
      origem: "preparacao-whatsapp",
      plataforma: "Mercado Livre",
      produtoId: "MLB00000001",
      titulo: '<img src=x onerror="window.__ataque=1"> PRODUTO TESTE',
      arquivoAtualizadoEm: "2026-10-29T11:00:00.000Z",
      precoObservado: 99.90,
      decisao: { estado: "bloqueada", regraVersao: 1, podePublicar: false },
      evidencias: [{
        criterio: "canal", estado: "pendente",
        codigo: "CANAL_NAO_HOMOLOGADO",
        descricao: "Grupo não homologado; envio bloqueado."
      }]
    },
    {
      id: "teste-2",
      origem: "registro-mercado-livre",
      plataforma: "Amazon",
      produtoId: "B00000001",
      titulo: "Outro produto FICTICIO",
      arquivoAtualizadoEm: "2026-10-29T11:00:00.000Z",
      decisao: { estado: "necessita-revisao", regraVersao: 1, podePublicar: false,
        motivos: [{ codigo: "PRECO_DESATUALIZADO", descricao: "Falta nova conferência de preço." }] },
      evidencias: [{
        criterio: "preco", estado: "expirada",
        codigo: "PRECO_CONTEXTUAL_NAO_ATUAL",
        descricao: "Preço antigo, não utilizar sem nova verificação."
      }]
    }
  ]
};

const raiz = process.cwd();
const server = createServer(async (req, res) => {
  if (req.url === "/api/revisao" && req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(snapshot));
    return;
  }
  if (await responderRotaVisual({
    method: req.method, pathname: req.url ?? "/", res, raiz
  })) return;
  res.writeHead(404); res.end();
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Porta de teste não encontrada");
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const response = await page.goto("http://127.0.0.1:" + address.port + "/revisao", {
    waitUntil: "networkidle"
  });
  assert.equal(response?.status(), 200);
  assert.ok((response?.headers()["content-security-policy"] || "").includes("default-src 'none'"));
  await page.waitForFunction(() => document.getElementById("metricAll")?.textContent === "2");
  assert.equal(await page.locator("#metricBlocked").innerText(), "1");
  assert.equal(await page.locator("#metricPending").innerText(), "1");
  assert.equal(await page.locator("#metricApproved").innerText(), "0");
  assert.equal(await page.locator("#cards article.offer").count(), 2);
  assert.equal(await page.locator("#cards img").count(), 0);
  assert.equal(await page.evaluate(() => (window as unknown as {__ataque?: unknown}).__ataque), undefined);
  assert.match(await page.locator("#cards article.offer").first().innerText(), /<img src=x/);
  await page.getByRole("button", { name: "Bloqueados" }).click();
  assert.equal(await page.locator("#cards article.offer").count(), 1);
  await page.getByRole("button", { name: "Para revisão" }).click();
  assert.equal(await page.locator("#cards article.offer").count(), 1);
  await page.locator("#cards details summary").click();
  assert.match(await page.locator("#cards details .evidence").first().innerText(), /Preço antigo/);
  assert.match(await page.locator("#cards details .reasons").innerText(), /Falta nova conferência de preço/);
  assert.equal(errors.length, 0, errors.join(" | "));
  const post = await page.request.post("http://127.0.0.1:" + address.port + "/revisao");
  assert.equal(post.status(), 404, "A página visual deve aceitar apenas GET");
  console.log("etapa58-revisao-visual: OK (filtros, estados, seguranca HTML, zero envios)");
} finally {
  await browser?.close();
  await new Promise<void>((resolve, reject) =>
    server.close((err) => err ? reject(err) : resolve())
  );
}
