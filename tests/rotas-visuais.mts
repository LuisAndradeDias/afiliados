import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { responderRotaVisual } from "../src/painel/rotas-visuais.js";

test("rotas de UI preservam /, /ofertas e /central", async (t) => {
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      if (await responderRotaVisual({
        method: req.method, pathname, res, raiz: process.cwd()
      })) return;
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
    } catch (error) {
      res.writeHead(500);
      res.end(String(error));
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = (path: string) => `http://127.0.0.1:${address.port}${path}`;

  for (const path of ["/", "/ofertas"]) {
    const response = await fetch(url(path));
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/);
    assert.match(await response.text(), /id="cycleToggleButton"/);
  }

  const central = await fetch(url("/central"));
  assert.equal(central.status, 200);
  assert.equal(central.headers.get("cache-control"), "no-store");
  assert.equal(central.headers.get("x-frame-options"), "DENY");
  assert.match(await central.text(), /Central Unificada/);

  for (const [path, type] of [
    ["/central/assets/central.css", "text/css"],
    ["/central/assets/central.tokens.css", "text/css"],
    ["/central/assets/ofertas-v2.css", "text/css"],
    ["/central/assets/central.js", "text/javascript"]
  ]) {
    const response = await fetch(url(path));
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type") ?? "", new RegExp(type));
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.ok((await response.text()).length > 100, path);
  }

  for (const path of [
    "/central/assets/segredo.env",
    "/central/assets/.env",
    "/central/assets/index.html",
    "/central/assets/nao-permitido.js"
  ]) {
    const response = await fetch(url(path));
    assert.equal(response.status, 404, path);
    assert.deepEqual(await response.json(), {
      ok: false, mensagem: "Recurso não encontrado."
    });
  }

  const post = await fetch(url("/central"), { method: "POST" });
  assert.equal(post.status, 404, "Módulo não intercepta ações POST");
  const integration = await fetch(url("/api/mercadolivre/link-job"));
  assert.equal(integration.status, 404, "Módulo não intercepta APIs");
});
