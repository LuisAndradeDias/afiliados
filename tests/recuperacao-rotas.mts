import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { responderRotaVisual } from "../src/painel/rotas-visuais.js";
import { responderRotaShopee } from "../src/painel/shopee-http.js";
import { responderRotaRevisao } from "../src/painel/revisao-http.js";

test("rotas modernas funcionam sobre a main, sem servidor de arquivos arbitrário", async () => {
  const dados = await mkdtemp(join(tmpdir(), "cpv-recuperacao-"));
  const raizVisual = process.cwd();
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
      if (await responderRotaVisual({ method: req.method, pathname, res, raiz: raizVisual })) return;
      if (await responderRotaShopee({ req, res, pathname, raiz: dados })) return;
      if (await responderRotaRevisao({ method: req.method, pathname, res, raiz: dados })) return;
      res.writeHead(404); res.end("not found");
    } catch (err) { res.writeHead(500); res.end(String(err)); }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr !== "string");
  const base = "http://127.0.0.1:" + addr.port;
  try {
    const paths = ["/", "/central", "/ofertas", "/shopee", "/revisao"];
    for (const path of paths) {
      const res = await fetch(base + path);
      assert.equal(res.status, 200, "Página indisponível: " + path);
      assert.match(res.headers.get("content-type") || "", /text\/html/);
      assert.match(await res.text(), /Caça Promos VIP|Central de Ofertas/i);
    }
    for (const asset of [
      "central.css", "central.js", "unified-nav.css", "unified-nav.js",
      "ofertas-cockpit.css", "ofertas-cockpit.js", "shopee.css",
      "shopee.js", "revisao.js"
    ]) {
      const res = await fetch(base + "/central/assets/" + asset);
      assert.equal(res.status, 200, "Asset indisponível: " + asset);
      assert.match(res.headers.get("content-type") || "", /text\/css|text\/javascript/);
      assert.ok((await res.text()).length > 50);
    }
    assert.equal((await fetch(base + "/central/assets/.env")).status, 404);
    assert.equal((await fetch(base + "/central/assets/../../../.env")).status, 404);
    assert.equal((await fetch(base + "/central/assets/arquivo-inexistente.js")).status, 404);
    assert.equal((await fetch(base + "/central", { method: "POST" })).status, 404);
    assert.equal((await fetch(base + "/api/revisao", { method: "POST" })).status, 404);
    const revRes = await fetch(base + "/api/revisao");
    assert.equal(revRes.status, 200);
    const rev = await revRes.json();
    assert.equal(rev.modo, "somente-leitura");
    assert.equal(rev.resumo.ofertasObservadas, 0);
    const shopee = await (await fetch(base + "/api/shopee/status")).json();
    assert.equal(shopee.apiAtiva, false);
    assert.equal(shopee.integracaoPronta, false);
    assert.equal(shopee.envioAutomatico, false);
    const forbidden = await fetch(base + "/api/shopee/rascunhos", {
      method: "POST", headers: { "content-type": "application/json", origin: "https://outro.example" },
      body: JSON.stringify({ titulo: "Teste", url: "https://s.shopee.com.br/abc", confirmado: true })
    });
    assert.equal(forbidden.status, 403);
    const source = await readFile("src/painel/server.ts", "utf8");
    for (const hook of ["responderRotaVisual", "responderRotaShopee", "responderRotaRevisao", "whatsapp-auto-send-set"]) {
      assert.ok(source.includes(hook), "Hook ausente: " + hook);
    }
    assert.doesNotMatch(source, /consultarElegibilidadeCanalWhatsapp|intervalos-envio|src\/instagram/);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(dados, { recursive: true, force: true });
  }
});