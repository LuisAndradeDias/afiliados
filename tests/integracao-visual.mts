import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import { responderRotaVisual } from "../src/painel/rotas-visuais.js";
import { responderRotaShopee } from "../src/painel/shopee-http.js";

const pasta = await mkdtemp(join(tmpdir(), "afiliados-ui-integracao-"));
const raiz = resolve(process.cwd());
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    if (await responderRotaShopee({ req, res, pathname, raiz: pasta })) return;
    if (await responderRotaVisual({ method: req.method, pathname, res, raiz })) return;
    res.writeHead(404); res.end("nao encontrado");
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
});

try {
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  for (const [path, expected] of [
    ["/central", "Painel de métricas"],
    ["/ofertas", "Central de Ofertas"],
    ["/shopee", "Shopee"],
  ] as const) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), new RegExp(expected, "i"), path);
  }
  for (const path of ["/central/assets/central.css", "/central/assets/shopee.js"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.ok((await response.text()).length > 100);
  }
  const unsupported = await fetch(base + "/central/assets/../../.env");
  assert.notEqual(unsupported.status, 200);
  const revision = await fetch(base + "/revisao");
  assert.equal(revision.status, 404, "Revisao antiga nao deve ser reativada");
  const status = await fetch(base + "/api/shopee/status");
  assert.equal(status.status, 200);
  const json = await status.json() as { apiAtiva: boolean; envioAutomatico: boolean };
  assert.equal(json.apiAtiva, false);
  assert.equal(json.envioAutomatico, false);
  const drafts = await fetch(base + "/api/shopee/rascunhos");
  assert.equal(drafts.status, 200);
  const data = await drafts.json() as { rascunhos: unknown[] };
  assert.deepEqual(data.rascunhos, []);
  const blocked = await fetch(base + "/api/shopee/rascunhos", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://outside.example" },
    body: JSON.stringify({ titulo: "Teste", url: "https://shopee.com.br/abc", confirmado: true }),
  });
  assert.equal(blocked.status, 403);
  console.log("integracao-visual: OK");
} finally {
  await new Promise<void>((done) => server.close(() => done()));
  await rm(pasta, { recursive: true, force: true });
}
