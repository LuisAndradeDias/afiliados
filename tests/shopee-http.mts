import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { responderRotaShopee } from "../src/painel/shopee-http.js";

async function servidorTeste(fn: (base: string) => Promise<void>) {
  const raiz = await mkdtemp(join(tmpdir(), "shopee-http-"));
  const server = createServer((req, res) => {
    const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    void responderRotaShopee({ req, res, pathname, raiz }).then(atendeu => {
      if (!atendeu) { res.writeHead(404); res.end(); }
    }).catch(error => { res.writeHead(500); res.end(String(error.name)); });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr !== "string");
  const base = "http://127.0.0.1:" + addr.port;
  try { await fn(base); } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(raiz, { recursive: true, force: true });
  }
}
const manual = {
  titulo: "Jogo de panelas",
  url: "https://s.shopee.com.br/123abc",
  preco: "189,90",
  confirmado: true
};
const post = (base: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + "/api/shopee/rascunhos", {
    method: "POST",
    headers: {
      origin: base, "sec-fetch-site": "same-origin",
      "content-type": "application/json", ...headers
    },
    body: JSON.stringify(body)
  });

test("status da conta é honesto; cadastro, listagem e exclusão são manuais", async () => {
  await servidorTeste(async base => {
    const st = await fetch(base + "/api/shopee/status");
    assert.equal(st.status, 200);
    const status = await st.json();
    assert.equal(status.apiAtiva, false);
    assert.equal(status.conta, "aguardando");
    assert.equal(status.mesmoGrupoFuturo, true);
    assert.equal(status.envioAutomatico, false);
    assert.equal((await (await fetch(base + "/api/shopee/rascunhos")).json()).rascunhos.length, 0);

    const response = await post(base, manual);
    assert.equal(response.status, 201);
    const { rascunho } = await response.json();
    assert.equal(rascunho.status, "rascunho");
    assert.equal(rascunho.preco, 189.9);
    assert.equal((await (await fetch(base + "/api/shopee/rascunhos")).json()).rascunhos.length, 1);

    const deleteRes = await fetch(base + "/api/shopee/rascunhos/" + rascunho.id, {
      method: "DELETE", headers: { origin: base, "sec-fetch-site": "same-origin" }
    });
    assert.equal(deleteRes.status, 200);
    assert.equal((await (await fetch(base + "/api/shopee/rascunhos")).json()).rascunhos.length, 0);
  });
});

test("nunca grava ações cross-site ou com origem ausente", async () => {
  await servidorTeste(async base => {
    assert.equal((await post(base, manual, { origin: "https://evil.example", "sec-fetch-site": "cross-site" })).status, 403);
    assert.equal((await post(base, manual, { origin: "https://evil.example" })).status, 403);
    const semOrigem = await fetch(base + "/api/shopee/rascunhos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(manual)
    });
    assert.equal(semOrigem.status, 403);
    const { rascunhos } = await (await fetch(base + "/api/shopee/rascunhos")).json();
    assert.equal(rascunhos.length, 0);
  });
});

test("rejeita URLs falsas, JSON inválido e corpo excessivo sem gravar", async () => {
  await servidorTeste(async base => {
    assert.equal((await post(base, { ...manual, url: "https://shopee.com.br.evil.test/item" })).status, 400);
    const invalid = await fetch(base + "/api/shopee/rascunhos", {
      method: "POST", headers: { "content-type": "application/json", origin: base },
      body: "{not json"
    });
    assert.equal(invalid.status, 400);
    const giant = await post(base, { ...manual, titulo: "x".repeat(16000) });
    assert.equal(giant.status, 413);
    assert.equal((await (await fetch(base + "/api/shopee/rascunhos")).json()).rascunhos.length, 0);
  });
});

test("não expõe arquivos de disco nem encaminha ações do WhatsApp", async () => {
  await servidorTeste(async base => {
    assert.equal((await fetch(base + "/api/shopee/../../.env")).status, 404);
    assert.equal((await fetch(base + "/api/shopee/enviar")).status, 404);
    const resp = await fetch(base + "/api/shopee/status");
    const text = await resp.text();
    assert.doesNotMatch(text, /refresh_token|APP_SECRET|whatsapp-profile|groupId|telefone/i);
  });
});
