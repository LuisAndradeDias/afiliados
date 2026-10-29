import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium } from "playwright";
import { responderRotaVisual } from "../src/painel/rotas-visuais.js";

const raiz = process.cwd();
const server = createServer(async (req, res) => {
  const json = (body: unknown) => {
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    });
    res.end(JSON.stringify(body));
  };
  if (req.method === "GET" && req.url === "/api/status") {
    json({
      operacaoEstado: "paused",
      monitorAlternadoAtivo: false,
      monitorAlternadoProximaPlataforma: "mercado-livre",
      ofertaPreparada: false
    });
    return;
  }
  if (req.method === "GET" && req.url === "/api/revisao") {
    json({
      modo: "somente-leitura",
      resumo: {
        candidatos: 3, bloqueados: 2,
        necessitamRevisao: 1, aprovados: 0
      }
    });
    return;
  }
  if (await responderRotaVisual({
    method: req.method,
    pathname: req.url ?? "/",
    res, raiz
  })) return;
  res.writeHead(404); res.end();
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const addr = server.address();
if (!addr || typeof addr === "string") throw new Error("Porta de teste indisponível");
const url = "http://127.0.0.1:" + addr.port + "/";
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200);
    await page.waitForFunction(() =>
      document.getElementById("metricCandidates")?.textContent === "3"
    );
    assert.equal(await page.locator("h1").innerText(), "Painel de métricas");
    assert.equal(await page.locator("#metricBlocked").innerText(), "2");
    assert.equal(await page.locator("#metricPending").innerText(), "1");
    assert.equal(await page.locator("#monitor").innerText(), "Pausado");
    assert.equal(await page.locator("#flow").innerText(), "Pausado");
    assert.equal(await page.locator("input[type=password]").count(), 0);
    assert.equal(await page.evaluate(() =>
      document.documentElement.scrollWidth <= innerWidth + 1
    ), true, "A home não deve causar rolagem horizontal em " + width);
    assert.equal(errors.length, 0, errors.join(" | "));
    if (width < 500) {
      await page.locator("#menuBtn").click();
      assert.ok(await page.locator("#sidebar").evaluate((x) =>
        x.classList.contains("open")));
    }
    await page.close();
  }
  console.log("home-metricas-visual: OK (dados de API local, desktop, celular, sem login)");
} finally {
  await browser?.close();
  await new Promise<void>((resolve, reject) =>
    server.close((e) => e ? reject(e) : resolve())
  );
}
