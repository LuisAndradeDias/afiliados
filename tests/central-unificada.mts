import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const file = async (path: string) => readFile(path, "utf8");

test("portal central separates HTML, styles and scripts", async () => {
  const [html, css, js] = await Promise.all([
    file("src/painel/public/central.html"),
    file("src/painel/public/central.css"),
    file("src/painel/public/central.js")
  ]);
  assert.match(html, /lang="pt-BR"/);
  assert.match(html, /\/central\/assets\/central.css/);
  assert.match(html, /\/central\/assets\/central.js/);
  for (const name of ["monitor", "flow", "next", "review", "captureStatus"]) {
    assert.match(html, new RegExp('id="' + name + '"'));
  }
  assert.match(css, /@media\(max-width:600px\)/);
  assert.match(js, /fetch\('\/api\/status'/);
  assert.doesNotMatch(js, /\/api\/action|\/api\/local\/campanhas\/.*(?:enviar|limpar|bloquear)/);
});

test("portal maintains existing routes and forbids proxy of captação", async () => {
  const src = await file("src/painel/server.ts");
  const visual = await file("src/painel/rotas-visuais.ts");
  assert.match(src, /responderRotaVisual\\(/);
  assert.match(visual, /pathname\.pathname === "\/central"/);
  assert.match(visual, /pathname === "\/ofertas"/);
  assert.match(visual, /pathname === "\/"/);
  assert.match(src, /requestUrl\.pathname === "\/api\/status"/);
  assert.match(src, /requestUrl\.pathname === "\/api\/action"/);
  assert.doesNotMatch(src, /createProxyMiddleware|httpProxy\.createProxyServer/);
});

test("Figma design tokens are exposed on local route and referenced by cockpit", async () => {
  const [tokens, css, server] = await Promise.all([
    file("src/painel/public/central.tokens.css"),
    file("src/painel/public/central.css"),
    file("src/painel/rotas-visuais.ts")
  ]);
  for (const key of ["--af-surface-canvas", "--af-brand-primary", "--af-nav-background", "--af-text-default", "--af-touch-min"]) {
    assert.ok(tokens.includes(key), key);
  }
  assert.match(css, /@import url\("\.\/central\.tokens\.css"\)/);
  assert.match(server, /"\/central\/assets\/central\.tokens\.css": "central\.tokens\.css"/);
  assert.match(css, /prefers-reduced-motion/);
});

test("redesign das ofertas preserva os controles e liga o CSS sem editar os robôs", async () => {
  const [html, css, server] = await Promise.all([
    file("src/painel/public/index.html"),
    file("src/painel/public/ofertas-v2.css"),
    file("src/painel/rotas-visuais.ts")
  ]);
  assert.match(html, /href="\/central\/assets\/ofertas-v2\.css"/);
  assert.match(html, /href="\/central\/assets\/central\.tokens\.css"/);
  assert.match(html, /class="ofertas-workspace-nav"/);
  for (const id of [
    "cycleToggleButton", "tempoMedioButton", "tempoCurtoButton",
    "launchCard", "flowCard", "reviewCard", "instagramCard",
    "mlConnect", "openWhatsappConnectionButton"
  ]) {
    assert.ok(html.includes('id="' + id + '"'), "Controle original ausente: " + id);
  }
  assert.match(html, /data-action="monitor-set"/);
  assert.match(server, /"\/central\/assets\/ofertas-v2\.css": "ofertas-v2\.css"/);
  assert.match(css, /--af-brand-primary/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});
