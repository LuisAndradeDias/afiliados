import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(path, "utf8");

test("Shopee aparece na Central e ao lado de Amazon e Mercado Livre", async () => {
  const [central, ofertas] = await Promise.all([
    read("src/painel/public/central.html"),
    read("src/painel/public/index.html")
  ]);
  assert.match(central, /href="\/shopee"/);
  assert.match(central, /Shopee/);
  assert.match(ofertas, /href="\/shopee"/);
  assert.match(ofertas, /Shopee/);
  assert.match(ofertas, /Amazon/);
  assert.match(ofertas, /Mercado Livre/);
});

test("página Shopee reutiliza identidade visual e explica ausência de conta/API", async () => {
  const html = await read("src/painel/public/shopee.html");
  const css = await read("src/painel/public/shopee.css");
  const js = await read("src/painel/public/shopee.js");
  assert.match(html, /lang="pt-BR"/);
  assert.match(html, /\/central\/assets\/central\.css/);
  assert.match(html, /\/central\/assets\/shopee\.css/);
  assert.match(html, /\/central\/assets\/shopee\.js/);
  assert.match(html, /id="shopeeForm"/);
  assert.match(html, /id="shopeeUrl"/);
  assert.match(html, /id="shopeeTitulo"/);
  assert.match(html, /id="shopeeConfirmado"/);
  assert.match(html, /id="shopeeDrafts"/);
  assert.match(html, /mesmo grupo|mesmo WhatsApp/i);
  assert.match(html, /aguardando|aprovad|credenciais/i);
  assert.match(html, /disabled/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media/);
  assert.match(js, /\/api\/shopee\/status/);
  assert.match(js, /\/api\/shopee\/rascunhos/);
  assert.match(js, /textContent/);
  assert.doesNotMatch(js, /innerHTML\s*=/);
  assert.doesNotMatch(js, /\/api\/action|whatsapp|\.click\(\)\s*;\s*\/\/.*enviar/i);
});

test("rota visual separada e estática não toca no motor de ofertas", async () => {
  const [rotas, servidor] = await Promise.all([
    read("src/painel/rotas-visuais.ts"),
    read("src/painel/server.ts")
  ]);
  assert.match(rotas, /pathname === "\/shopee"/);
  assert.match(rotas, /"\/central\/assets\/shopee\.css": "shopee\.css"/);
  assert.match(rotas, /"\/central\/assets\/shopee\.js": "shopee\.js"/);
  assert.match(servidor, /responderRotaShopee/);
  assert.match(servidor, /responderRotaVisual/);
  assert.match(servidor, /\/api\/action/);
});
