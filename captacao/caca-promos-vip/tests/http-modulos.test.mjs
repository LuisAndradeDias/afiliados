import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { request as httpRequest } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { corpoJson, corpoAssinado } from "../src/http/corpos.mjs";
import { carregarAtivos } from "../src/http/ativos.mjs";
import { validarOrigem, extrairSessao } from "../src/http/origem-sessao.mjs";
import { headersBase } from "../src/http/respostas.mjs";
import { iniciarServidor } from "../src/server.mjs";

function req(body, contentType = "application/json") {
  const stream = Readable.from([Buffer.from(body)]);
  stream.headers = { "content-type": contentType };
  return stream;
}

test("HTTP: origem e cookie mantêm o mesmo contrato, sem relaxar validação", () => {
  assert.equal(validarOrigem({ headers: { host: "127.0.0.1:3045" } }), true);
  assert.equal(validarOrigem({ headers: {
    host: "127.0.0.1:3045", origin: "http://127.0.0.1:3045"
  } }), true);
  assert.equal(validarOrigem({ headers: {
    host: "127.0.0.1:3045", origin: "https://dominio-externo.example"
  } }), false);
  assert.equal(validarOrigem({ headers: {
    host: "127.0.0.1:3045", origin: "null"
  } }), false);
  assert.equal(validarOrigem({ headers: {
    host: "127.0.0.1:3045", origin: "javascript:alert(1)"
  } }), false);

  const token = "a".repeat(64);
  assert.equal(extrairSessao({ headers: { cookie: "prefs=ok; cpv_admin=" + token } }), token);
  assert.equal(extrairSessao({ headers: { cookie: "cpv_admin=incorreto" } }), "");
  assert.equal(extrairSessao({ headers: {} }), "");
});

test("HTTP: corpos JSON e assinatura preservam limites de bytes", async () => {
  assert.deepEqual(await corpoJson(req('{"id":1}')), { id: 1 });
  await assert.rejects(corpoJson(req('[]')), /JSON inválido/);
  await assert.rejects(corpoJson(req('{"id":1}', "text/plain")), /content-type application\/json/);
  await assert.rejects(corpoJson(req('{"texto":"muito longo"}'), 8), /tamanho permitido/);
  const raw = await corpoAssinado(req('{"test":1}'));
  assert.equal(raw.toString("utf8"), '{"test":1}');
  await assert.rejects(corpoAssinado(req("x".repeat(40)), 12), /limite permitido/);
});

test("HTTP: ativos estão permitidos em lista fechada e headers são conservadores", () => {
  const sourceDir = dirname(fileURLToPath(new URL("../src/server.mjs", import.meta.url)));
  const { scripts, styles, planilhaModelo } = carregarAtivos(sourceDir);
  assert.ok(Buffer.isBuffer(planilhaModelo));
  assert.ok(planilhaModelo.length > 1000);
  for (const key of [
    "/assets/landing.js", "/assets/campanhas.js", "/assets/gestao.js",
    "/assets/layout-clean.js", "/assets/afiliados-v2.css",
    "/assets/afiliados-v2.tokens.css"
  ]) assert.equal(scripts.has(key) || styles.has(key), true, key);
  assert.equal(scripts.has("/assets/../../.env"), false);
  assert.equal(styles.has("/assets/.env"), false);
  assert.equal(headersBase["cache-control"], "no-store");
  assert.equal(headersBase["x-frame-options"], "DENY");
  assert.equal(headersBase["cross-origin-resource-policy"], "same-origin");
});

test("HTTP: telas privadas seguem exigindo Host de loopback e Origin válido", async t => {
  const dataDir = mkdtempSync(join(tmpdir(), "cpv-refactor-http-"));
  const app = await iniciarServidor({
    port: 0, host: "127.0.0.1", dataDir, whatsappWorkerTeste: true,
    metaAmbiente: {}, publicBaseUrl: "",
  });
  t.after(async () => {
    app.servidor.closeAllConnections();
    await new Promise(resolve => app.servidor.close(resolve));
    rmSync(dataDir, { recursive: true, force: true });
  });

  const page = await fetch(app.base + "/inicio");
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-security-policy") ?? "", /script-src 'self'/);
  assert.match(await page.text(), /data-layout="clean"/);

  // fetch() pode sobrescrever Host. http.request envia o cabeçalho literal.
  const privateStatus = await new Promise((resolve, reject) => {
    const raw = httpRequest(app.base + "/api/local/gestao/contatos", {
      method: "GET",
      headers: { Host: "localhost:3045" },
    }, response => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
      response.on("error", reject);
    });
    raw.on("error", reject);
    raw.end();
  });
  assert.equal(privateStatus, 403, "Host adulterado deve ser bloqueado");

  const postDenied = await fetch(app.base + "/api/local/gestao/numero/diagnostico", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://externo.invalid",
      "x-cpv-local": "1",
    },
    body: JSON.stringify({ telefone: "00000000000" }),
  });
  assert.equal(postDenied.status, 403);
  const publicPage = await fetch(app.base + "/sair");
  assert.equal(publicPage.status, 200);
  assert.doesNotMatch(await publicPage.text(), /data-layout="clean"/);
});
