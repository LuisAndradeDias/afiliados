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
  assert.match(src, /requestUrl\.pathname === "\/central"/);
  assert.match(src, /requestUrl\.pathname === "\/ofertas"/);
  assert.match(src, /requestUrl\.pathname === "\/"/);
  assert.match(src, /requestUrl\.pathname === "\/api\/status"/);
  assert.match(src, /requestUrl\.pathname === "\/api\/action"/);
  assert.doesNotMatch(src, /createProxyMiddleware|httpProxy\.createProxyServer/);
});

test("Figma design tokens are exposed on local route and referenced by cockpit", async () => {
  const [tokens, css, server] = await Promise.all([
    file("src/painel/public/central.tokens.css"),
    file("src/painel/public/central.css"),
    file("src/painel/server.ts")
  ]);
  for (const key of ["--af-surface-canvas", "--af-brand-primary", "--af-nav-background", "--af-text-default", "--af-touch-min"]) {
    assert.ok(tokens.includes(key), key);
  }
  assert.match(css, /@import url\("\.\/central\.tokens\.css"\)/);
  assert.match(server, /"\/central\/assets\/central\.tokens\.css": "central\.tokens\.css"/);
  assert.match(css, /prefers-reduced-motion/);
});
