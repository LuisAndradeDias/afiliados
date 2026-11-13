/**
 * UX-01: contrato real de navegação e assets.
 * As capturas usam APENAS dados sintéticos e nenhum endpoint de produção.
 * Uma mudança na UI que quebre CSS, JS, navegação ou controles essenciais
 * precisa falhar no CI antes do deploy.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { responderRotaVisual } from "../src/painel/rotas-visuais.js";
import { responderRotaShopee } from "../src/painel/shopee-http.js";
import { responderRotaRevisao } from "../src/painel/revisao-http.js";
import { responderRotaCacador } from "../src/painel/cacador-http.js";

const rotas = ["/", "/central", "/ofertas", "/shopee", "/revisao", "/historico-precos", "/cacador"] as const;
const modules = ["/central", "/ofertas", "/cacador", "/revisao", "/historico-precos", "/shopee"] as const;
const widths = [1595, 1280, 768, 390] as const;
const screenshots = join(process.cwd(), "test-results", "ux");
const status = {
  operacaoEstado: "paused", monitorAlternadoAtivo: false,
  monitorAlternadoProximaPlataforma: "mercado-livre",
  operacaoPlataforma: null, whatsappAutoEnvioAtivo: true,
  whatsappAutoEnvioDelayMs: 1500, ofertaPreparada: false,
  whatsappEnvioPendente: false, whatsappRevisaoPronta: false,
  grupoConfigurado: true, grupo: "GRUPO FICTÍCIO DE TESTE",
  sessaoWhatsapp: true, executando: [], logs: [],
  afiliadoConfigurado: true, afiliadoTag: "teste-20",
  mercadoLivreApiConfigurada: true, mercadoLivreExtensionConectada: true,
  mercadoLivreCuponsTotal: 7, mercadoLivreCuponsAtivos: 0,
  descontoMinimo: 20, cooldownHoras: 24, previewCooldownMinutos: 120,
  mercadoLivreFluxoEtapa: "idle", mercadoLivreFluxoMensagem: ""
};
const fixtureDir = await mkdtemp(join(tmpdir(), "ux-contrato-"));
await mkdir(join(fixtureDir, "data"));
await writeFile(join(fixtureDir, "data", "ultima-oferta-whatsapp.json"), JSON.stringify({
  titulo: "Produto sintético de teste visual",
  produtoId: "MLB000001",
  plataforma: "Mercado Livre",
  precoAtual: 99.90, descontoPercentual: 20
}));
let writes = 0;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const pathname = url.pathname;
    if (req.method === "GET" && pathname === "/api/status") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(status)); return;
    }
    if (req.method !== "GET" && req.method !== "OPTIONS") {
      writes += 1;
      res.writeHead(405); res.end(); return;
    }
    if (await responderRotaVisual({
      method: req.method, pathname, res, raiz: process.cwd()
    })) return;
    if (await responderRotaShopee({ req, res, pathname, raiz: fixtureDir })) return;
    if (await responderRotaRevisao({
      method: req.method, pathname, res, raiz: fixtureDir
    })) return;
    if (await responderRotaCacador({req,res,pathname,raiz:fixtureDir})) return;
    res.writeHead(404); res.end("Não encontrado");
  } catch (error) {
    res.writeHead(500); res.end(String(error));
  }
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const addr = server.address();
assert.ok(addr && typeof addr !== "string");
const base = "http://127.0.0.1:" + addr.port;
await mkdir(screenshots, { recursive: true });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
      locale: "pt-BR"
    });
    await context.route("**/*", async route => {
      if (route.request().method() !== "GET") {
        writes += 1;
        await route.abort();
      } else {
        await route.continue();
      }
    });
    const page = await context.newPage();
    const errors: string[] = [];
    const failedResources: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => {
      const pathname = new URL(response.url()).pathname;
      const isAsset = pathname.startsWith("/central/assets/");
      if (isAsset && response.status() >= 400) {
        failedResources.push(pathname + " HTTP " + response.status());
      }
    });
    page.on("requestfailed", request => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.startsWith("/central/assets/")) {
        failedResources.push(pathname + " " + request.failure()?.errorText);
      }
    });
    for (const pathname of rotas) {
      const response = await page.goto(base + pathname + (pathname === "/historico-precos" ? "?demo=1" : ""), { waitUntil: "domcontentloaded" });
      assert.equal(response?.status(), 200, "Rota não disponível: " + pathname);
      await page.waitForTimeout(600);
      const measures = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        font: getComputedStyle(document.body).fontFamily,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        rootBg: getComputedStyle(document.documentElement).backgroundColor
      }));
      assert.ok(measures.overflow <= 2, pathname + " causa rolagem horizontal em " + width);
      assert.match(measures.font, /Segoe UI|Inter|sans-serif/i,
        pathname + " perdeu a tipografia do sistema");
      assert.ok(measures.bodyBg !== "rgba(0, 0, 0, 0)" ||
        measures.rootBg !== "rgba(0, 0, 0, 0)",
        pathname + " perdeu o fundo efetivo do layout");
      for (const link of modules) {
        assert.ok(await page.locator('a[href="' + link + '"]').count() >= 1,
          pathname + " perdeu a navegação para " + link);
      }
      if (pathname === "/" || pathname === "/central" || pathname === "/shopee") {
        const bg = await page.locator(".sidebar").evaluate(element =>
          getComputedStyle(element).backgroundColor
        );
        assert.equal(bg, "rgb(23, 35, 51)",
          "Sidebar perdeu identidade visual em " + pathname + " (" + width + ")");
      }
      if (pathname === "/" || pathname === "/central") {
        assert.equal(await page.locator("#monitor").innerText(), "Pausado");
        assert.equal(await page.locator("#metricAutoSend").innerText(), "Ativo");
        assert.equal(await page.locator("#metricCouponsObserved").innerText(), "7");
        if (width <= 768) {
          await page.locator("#menuBtn").click();
          assert.equal(await page.locator("#menuBtn").getAttribute("aria-expanded"), "true");
          await page.keyboard.press("Escape");
          assert.equal(await page.locator("#menuBtn").getAttribute("aria-expanded"), "false");
        }
      }
      if (pathname === "/ofertas") {
        assert.equal(await page.locator("#autoEnvioButton").count(), 1,
          "Controle operacional de autoenvio desapareceu");
        assert.equal(await page.locator("#cpvOpsWhatsapp").innerText(), "Autoenvio ativo");
        assert.ok(await page.locator("#cpvUnifiedNav a[href='/central']").count() > 0);
      }
      if (pathname === "/shopee") {
        assert.equal(await page.locator("#shopeeForm").count(), 1);
        assert.equal(await page.locator("#shopeeAccountStat").innerText(), "Aguardando");
      }
      if (pathname === "/revisao") {
        assert.equal(await page.locator("#revAuto").innerText(), "Ativo");
        assert.equal(await page.locator("#revObserved").innerText(), "1");
      }
      if ((width === 1595 || width === 390) && pathname !== "/") {
        const name = pathname.slice(1);
        await page.screenshot({
          path: join(screenshots, name + "-" + width + ".png"),
          fullPage: true, animations: "disabled"
        });
      }
    }
    assert.deepEqual(errors, [], "Erros JavaScript na largura " + width);
    assert.deepEqual(failedResources, [], "CSS/JS quebrados na largura " + width);
    await context.close();
  }
  assert.equal(writes, 0, "Auditoria de UX não pode acionar POST/DELETE");
  const unknownAsset = await fetch(base + "/central/assets/arquivo-inexistente.css");
  assert.equal(unknownAsset.status, 404, "Arquivo não permitido não pode vazar");
  console.log("UX_GATE_OK: 7 rotas, 4 larguras, 12 capturas sintéticas, sem escrita, sem recurso quebrado.");
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await rm(fixtureDir, { recursive: true, force: true });
}
