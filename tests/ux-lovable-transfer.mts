import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { responderRotaVisual } from "../src/painel/rotas-visuais.js";

const paginas = ["/", "/central", "/ofertas", "/revisao", "/shopee"];

test("rotas operacionais usam a mesma navegacao e tokens herdados do Lovable", async () => {
  const server = createServer(async (req, res) => {
    if (await responderRotaVisual({
      method: req.method, pathname: req.url ?? "/", res, raiz: process.cwd()
    })) return;
    res.writeHead(404); res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Sem porta de teste");
    const base = "http://127.0.0.1:" + addr.port;
    for (const rota of paginas) {
      const r = await fetch(base + rota);
      assert.equal(r.status, 200, rota);
      const html = await r.text();
      assert.match(html, /\/central\/assets\/unified-nav\.js/, rota + " precisa de navegacao unica");
      assert.match(html, /\/central\/assets\/unified-nav\.css/, rota + " precisa de estilos compartilhados");
      assert.doesNotMatch(html, /<form[^>]*action=["']\/auth["']|<h1[^>]*>Entrar<\/h1>/i);
    }
    for (const nome of ["unified-nav.js", "unified-nav.css"]) {
      const res = await fetch(base + "/central/assets/" + nome);
      assert.equal(res.status, 200, nome + " deve constar na whitelist");
    }
    const tokens = await readFile(resolve("src/painel/public/central.tokens.css"), "utf8");
    for (const color of ["#172333", "#148a69", "#f6f8fb", "#285246", "#61c5a4"]) {
      assert.ok(tokens.includes(color), "Cor da identidade: " + color);
    }
    const home = await (await fetch(base + "/")).text();
    assert.match(home, /<h1>Painel de métricas<\/h1>/);
    assert.match(home, /Envios confirmados/);
    assert.match(home, /Cupons ativos/);
    assert.match(home, /Comissões verificadas/);
    assert.doesNotMatch(home, /<form[^>]+login/i);
    const revisao = await fetch(base + "/revisao");
    assert.match(revisao.headers.get("content-security-policy") || "", /script-src 'self'/);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => e ? reject(e) : resolve())
    );
  }
});
