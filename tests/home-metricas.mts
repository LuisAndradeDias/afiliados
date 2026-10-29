import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { responderRotaVisual } from "../src/painel/rotas-visuais.js";

test("home sem login abre dashboard de metricas, preservando rotas de ofertas", async () => {
  const raiz = process.cwd();
  const server = createServer(async (req, res) => {
    if (await responderRotaVisual({
      method: req.method, pathname: req.url ?? "/", res, raiz
    })) return;
    res.writeHead(404); res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Porta nao encontrada");
    const base = "http://127.0.0.1:" + addr.port;
    const home = await fetch(base + "/");
    const central = await fetch(base + "/central");
    const ofertas = await fetch(base + "/ofertas");
    assert.equal(home.status, 200);
    assert.equal(central.status, 200);
    assert.equal(ofertas.status, 200);
    const pagina = await home.text();
    assert.equal(pagina, await central.text(), "A home deve ser a Central real.");
    assert.match(pagina, /<h1>Painel de métricas<\/h1>/);
    assert.ok(pagina.indexOf('class="stats"') < pagina.indexOf('class="grid"'),
      "Metricas devem aparecer antes dos modulos de atalho.");
    for (const id of ["monitor", "flow", "next", "review",
      "metricCandidates", "metricBlocked", "metricPending"]) {
      assert.ok(pagina.includes('id="' + id + '"'), "Metrica ausente: " + id);
    }
    assert.doesNotMatch(pagina, /type="password"|<form[^>]*login/i);
    const offersHtml = await ofertas.text();
    assert.match(offersHtml, /Ciclo Amazon \+ Mercado Livre/);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => e ? reject(e) : resolve())
    );
  }
});
