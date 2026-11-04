import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { responderRotaVisual } from "../src/painel/rotas-visuais.js";
import { responderRotaShopee } from "../src/painel/shopee-http.js";
import { responderRotaRevisao } from "../src/painel/revisao-http.js";

const root = process.cwd();
const dados = await mkdtemp(join(tmpdir(), "cpv-e2e-recovery-"));
await mkdir(join(dados, "data"));
await writeFile(join(dados, "data", "ultima-oferta-whatsapp.json"), JSON.stringify({
  titulo: "Produto fictício para teste visual", plataforma: "Amazon Brasil",
  produtoId: "B000000001", precoAtual: 99.90, descontoPercentual: 20
}));
const status = {
  monitorAlternadoAtivo: false, operacaoEstado: "paused", operacaoPlataforma: null,
  grupoConfigurado: true, grupo: "Grupo de teste fictício",
  whatsappAutoEnvioAtivo: true, whatsappAutoEnvioDelayMs: 1500,
  whatsappRevisaoPronta: false, whatsappEnvioPendente: false,
  ofertaPreparada: false, sessaoWhatsapp: true, executando: [],
  monitorAlternadoProximaPlataforma: "mercado-livre",
  mercadoLivreCuponsTotal: 2, mercadoLivreCuponsAtivos: 0,
  descontoMinimo: 20, cooldownHoras: 24, previewCooldownMinutos: 120,
  afiliadoConfigurado: true, mercadoLivreApiConfigurada: true,
  mercadoLivreFluxoEtapa: "idle", mercadoLivreFluxoMensagem: "",
  logs: ["[10:00] [painel] Estado de teste local."]
};
let actionCalls = 0;
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    if (req.method === "GET" && pathname === "/api/status") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(status)); return;
    }
    if (req.method === "POST" && pathname === "/api/action") {
      actionCalls += 1; res.writeHead(403); res.end(); return;
    }
    if (await responderRotaVisual({ method: req.method, pathname, res, raiz: root })) return;
    if (await responderRotaShopee({ req, res, pathname, raiz: dados })) return;
    if (await responderRotaRevisao({ method: req.method, pathname, res, raiz: dados })) return;
    res.writeHead(404); res.end();
  } catch (error) {
    res.writeHead(500); res.end(String(error));
  }
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const base = "http://127.0.0.1:" + address.port;
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    for (const path of ["/", "/central", "/ofertas", "/shopee", "/revisao"]) {
      const response = await page.goto(base + path, { waitUntil: "domcontentloaded" });
      assert.equal(response?.status(), 200, "Página não abriu: " + path);
      await page.waitForTimeout(900);
      if (path === "/" || path === "/central") {
        assert.equal(await page.locator("#metricAutoSend").innerText(), "Ativo");
        assert.equal(await page.locator("#monitor").innerText(), "Pausado");
        assert.equal(await page.locator("#metricCouponsObserved").innerText(), "2");
        assert.equal(await page.locator("#metricConfirmed").innerText(), "—");
        if (width < 500) {
          await page.locator("#menuBtn").click();
          assert.equal(await page.locator("#sidebar").evaluate(node => node.classList.contains("open")), true);
          await page.locator("#scrim").click({ position: { x: 10, y: 10 }, force: true });
        }
      }
      if (path === "/ofertas") {
        assert.equal(await page.locator("#cpvOpsPanel").count(), 1);
        assert.equal(await page.locator("#cpvOpsWhatsapp").innerText(), "Autoenvio ativo");
        assert.equal(await page.locator("#autoEnvioButton").count(), 1,
          "Botão original de autoenvio não pode desaparecer");
        assert.equal(await page.locator("#cpvUnifiedNav a[href='/shopee']").count(), 1);
      }
      if (path === "/shopee") {
        assert.equal(await page.locator("#shopeeForm").count(), 1);
        assert.equal(await page.locator("#shopeeAccountStat").innerText(), "Aguardando");
      }
      if (path === "/revisao") {
        assert.equal(await page.locator("#revAuto").innerText(), "Ativo");
        assert.equal(await page.locator("#revObserved").innerText(), "1");
        assert.equal(await page.getByText("Produto fictício para teste visual").count(), 1);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        "Rolagem horizontal em " + path + " largura " + width);
    }
    assert.equal(errors.length, 0, errors.join(" | "));
    await page.close();
  }
  assert.equal(actionCalls, 0, "A inspeção visual não pode executar ação alguma.");
  console.log("recuperacao-visual: OK (cinco rotas, desktop/móvel, módulos reais, sem POST)");
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await rm(dados, { recursive: true, force: true });
}
