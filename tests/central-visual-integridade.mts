import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { responderRotaVisual } from "../src/painel/rotas-visuais.js";
import { responderRotaShopee } from "../src/painel/shopee-http.js";
import { responderRotaRevisao } from "../src/painel/revisao-http.js";

const estado = {
  monitorAlternadoAtivo: false, operacaoEstado: "paused",
  monitorAlternadoProximaPlataforma: "amazon", ofertaPreparada: false,
  whatsappAutoEnvioAtivo: true, whatsappAutoEnvioDelayMs: 1500,
  whatsappEnvioPendente: false, whatsappRevisaoPronta: false,
  mercadoLivreCuponsTotal: 7, mercadoLivreCuponsAtivos: 0,
  descontoMinimo: 20, cooldownHoras: 24, previewCooldownMinutos: 120,
  grupoConfigurado: true, sessaoWhatsapp: true, executando: [], logs: []
};

function channel(rgb: string) {
  return rgb.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number) ?? [];
}
function luminancia(rgb: string) {
  const [r, g, b] = channel(rgb).map(v => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(fg: string, bg: string) {
  const l1 = luminancia(fg), l2 = luminancia(bg);
  return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
}

test("Central aplica tokens visuais, tema escuro, fonte legível e responsividade", async () => {
  const html = await readFile("src/painel/public/central.html", "utf8");
  const css = await readFile("src/painel/public/central.css", "utf8");
  assert.match(html, /central\.css\?v=/);
  assert.match(css, /@import url\("\.\/central\.tokens\.css\?v=/);
  const srv = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
      if (req.method === "GET" && pathname === "/api/status") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(estado)); return;
      }
      if (await responderRotaVisual({ method: req.method, pathname, res, raiz: process.cwd() })) return;
      if (await responderRotaShopee({ req, res, pathname, raiz: process.cwd() })) return;
      if (await responderRotaRevisao({ method: req.method, pathname, res, raiz: process.cwd() })) return;
      res.writeHead(404); res.end();
    } catch (err) {
      res.writeHead(500); res.end(String(err));
    }
  });
  await new Promise<void>(resolve => srv.listen(0, "127.0.0.1", resolve));
  const address = srv.address();
  assert.ok(address && typeof address !== "string");
  const base = "http://127.0.0.1:" + address.port;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    const tokenRes = await fetch(base + "/central/assets/central.tokens.css");
    assert.equal(tokenRes.status, 200, "O tema precisa carregar tokens sem erro 404");
    assert.match(await tokenRes.text(), /--af-nav-background/);
    browser = await chromium.launch({ channel: "chrome", headless: true });
    for (const width of [1595, 1280, 768, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors: string[] = [];
      const failedStyles: string[] = [];
      page.on("pageerror", err => errors.push(err.message));
      page.on("response", resp => {
        if (/\/central\/assets\/.*\.css/.test(resp.url()) && resp.status() >= 400) {
          failedStyles.push(resp.url() + " HTTP " + resp.status());
        }
      });
      for (const pathname of ["/", "/central", "/shopee"]) {
        const response = await page.goto(base + pathname, { waitUntil: "networkidle" });
        assert.equal(response?.status(), 200, pathname);
        const styles = await page.evaluate(() => {
          const sidebar = document.querySelector(".sidebar");
          const nav = document.querySelector("#cpvUnifiedNav a");
          const main = document.querySelector(".main");
          const body = getComputedStyle(document.body);
          const sidebarStyle = getComputedStyle(sidebar!);
          const navStyle = getComputedStyle(nav!);
          return {
            fontFamily: body.fontFamily, bg: body.backgroundColor,
            sidebarBackground: sidebarStyle.backgroundColor,
            navForeground: navStyle.color,
            navFont: navStyle.fontFamily,
            box: sidebar!.getBoundingClientRect().toJSON(),
            mainWidth: main?.getBoundingClientRect().width ?? 0,
            overflow: document.documentElement.scrollWidth - innerWidth
          };
        });
        assert.match(styles.fontFamily, /Segoe UI|Inter|sans-serif/i, "Fonte de UI ausente");
        assert.equal(styles.sidebarBackground, "rgb(23, 35, 51)", "Barra lateral perdeu o tema escuro");
        assert.ok(contraste(styles.navForeground, styles.sidebarBackground) >= 4.5,
          "Contraste insuficiente no menu");
        assert.ok(styles.overflow <= 1, "Rolagem horizontal em " + pathname + ", largura " + width);
        assert.ok(styles.mainWidth > 270 || pathname === "/shopee",
          "Conteúdo principal não pode desaparecer");
        if (pathname === "/" || pathname === "/central") {
          assert.equal(await page.locator("#monitor").innerText(), "Pausado");
          assert.equal(await page.locator("#metricAutoSend").innerText(), "Ativo");
          if (width < 861) {
            await page.locator("#menuBtn").click();
            assert.ok(await page.locator("#sidebar").evaluate(node => node.classList.contains("open")),
              "O menu móvel não abriu");
            await page.keyboard.press("Escape");
            assert.ok(!await page.locator("#sidebar").evaluate(node => node.classList.contains("open")),
              "O menu móvel não fechou");
          }
        }
      }
      assert.deepEqual(failedStyles, []);
      assert.deepEqual(errors, []);
      await page.close();
    }
    assert.equal((await fetch(base + "/central/assets/.env")).status, 404);
  } finally {
    await browser?.close();
    srv.closeAllConnections();
    await new Promise<void>(resolve => srv.close(() => resolve()));
  }
});
