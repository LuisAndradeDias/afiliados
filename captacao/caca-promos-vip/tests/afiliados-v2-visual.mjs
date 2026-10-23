import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { iniciarServidor } from '../src/server.mjs';

const captures = process.env.AFILIADOS_V2_SCREENSHOTS || '';
if (captures) mkdirSync(captures, { recursive: true });
const dataDir = mkdtempSync(join(tmpdir(), 'afiliados-v2-browser-'));
const app = await iniciarServidor({ port: 0, host: '127.0.0.1', dataDir, whatsappWorkerTeste: true });

const offersHtml = readFileSync(new URL('../../../src/painel/public/index.html', import.meta.url), 'utf8');
const css = new Map([
  ['/central/assets/central.tokens.css', readFileSync(new URL('../../../src/painel/public/central.tokens.css', import.meta.url), 'utf8')],
  ['/central/assets/ofertas-v2.css', readFileSync(new URL('../../../src/painel/public/ofertas-v2.css', import.meta.url), 'utf8')],
]);
const offersServer = createServer((req, res) => {
  const route = new URL(req.url || '/', 'http://127.0.0.1').pathname;
  if (route === '/' || route === '/ofertas') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(offersHtml); return;
  }
  if (css.has(route)) {
    res.writeHead(200, { 'content-type': 'text/css; charset=utf-8' });
    res.end(css.get(route)); return;
  }
  if (route === '/api/status') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ monitorAlternadoAtivo:false, operacaoEstado:'paused', logs:[], executando:[], mensagem:'', ofertaPreparada:false })); return;
  }
  res.writeHead(404);res.end();
});
await new Promise(resolve => offersServer.listen(0, '127.0.0.1', resolve));
const offerAddress = offersServer.address();
assert.ok(offerAddress && typeof offerAddress !== 'string');
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const issues = [];
  page.on('pageerror', err => issues.push(err.message));

  const routes = ['/inicio', '/enviar', '/contatos', '/campanhas', '/respostas-botoes', '/denuncias'];
  for (const [width, height] of [[1440,900],[390,844]]) {
    await page.setViewportSize({ width, height });
    for (const route of routes) {
      const response = await page.goto(app.base + route, { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200, route + ' ' + width);
      const state = await page.evaluate(() => ({
        background: getComputedStyle(document.body).backgroundColor,
        sidebar: getComputedStyle(document.querySelector('#cleanSidebar')).backgroundColor,
        width: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
        globalNav: document.querySelectorAll('#cleanSidebar .clean-global-link').length,
        localNav: document.querySelectorAll('#cleanSidebar .clean-nav-link').length,
      }));
      assert.equal(state.background, 'rgb(246, 248, 251)', route + ': background');
      assert.equal(state.sidebar, 'rgb(23, 35, 51)', route + ': sidebar');
      assert.equal(state.globalNav, 2, route + ': dois acessos da plataforma');
      assert.equal(state.localNav, 6, route + ': seis controles originais');
      assert.ok(state.scroll <= state.width + 2, route + ': rolagem horizontal: ' + JSON.stringify(state));
      if (captures && route === '/inicio' && width === 1440) {
        await page.screenshot({ path: join(captures, 'captacao-desktop.png'), fullPage: true });
      }
      if (captures && route === '/enviar' && width === 390) {
        await page.screenshot({ path: join(captures, 'envio-mobile.png'), fullPage: true });
      }
    }
  }

  await page.goto(app.base + '/inicio', { waitUntil: 'domcontentloaded' });
  const menu = page.locator('#cleanMenuButton');
  assert.equal(await menu.isVisible(), true);
  await menu.click();
  assert.equal(await menu.getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');

  await page.setViewportSize({ width:1440, height:900 });
  const offerPage = await page.goto('http://127.0.0.1:' + offerAddress.port + '/ofertas', { waitUntil: 'domcontentloaded' });
  assert.equal(offerPage.status(), 200);
  await page.locator('#cycleToggleButton').waitFor();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.hero')).backgroundColor === 'rgb(23, 35, 51)');
  const offerStyles = await page.evaluate(() => ({
    sidebarLinks: document.querySelectorAll('.ofertas-workspace-nav a').length,
    card: getComputedStyle(document.querySelector('#launchCard')).backgroundColor,
    scroll: document.documentElement.scrollWidth,
    width: document.documentElement.clientWidth,
  }));
  assert.ok(offerStyles.sidebarLinks >= 5);
  assert.equal(offerStyles.card, 'rgb(255, 255, 255)');
  assert.ok(offerStyles.scroll <= offerStyles.width + 2, JSON.stringify(offerStyles));
  if (captures) await page.screenshot({ path: join(captures, 'ofertas-desktop.png'), fullPage: true });
  assert.deepEqual(issues, [], 'Não deve ocorrer exceção em scripts de página');
} finally {
  await browser?.close();
  app.servidor.closeAllConnections();
  offersServer.closeAllConnections();
  await Promise.all([
    new Promise(resolve => app.servidor.close(resolve)),
    new Promise(resolve => offersServer.close(resolve))
  ]);
  rmSync(dataDir, { recursive: true, force: true });
}
