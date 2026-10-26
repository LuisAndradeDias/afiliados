import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request as httpRequest } from "node:http";
import { iniciarServidor } from "../src/server.mjs";
import { consultarGestaoLocal } from "../src/consultas/gestao.mjs";

function gestaoFicticia() {
  const listCalls = [];
  const gestaoContatos = {
    listar: opcoes => { listCalls.push(opcoes); return { contatos: [{ nome: "Teste", telefone: "***" }] }; },
    detalhe: id => ({ id, status: "autorizado" }),
    resumo: () => ({ autorizados: 1, bloqueados: 0 })
  };
  const convitesUnicos = { listarFilas: () => [
    { modo: "web", pendentes: 2 },
    { modo: "manual", pendentes: 1 },
    { modo: "web", pendentes: 0 }
  ] };
  const denuncias = {
    listar: () => [
      { motivo: "denuncia-convite", id: 1 },
      { motivo: "saida-solicitada", id: 2 },
      { motivo: "denuncia-convite", id: 3 }
    ],
    resumo: () => ({ denuncias: 2 })
  };
  const controleWhatsapp = { estado: () => ({ fase: "pausado" }) };
  const sincronizacaoNetlify = { estado: () => ({ ativo: false }) };
  return { listCalls, gestaoContatos, convitesUnicos, denuncias, controleWhatsapp, sincronizacaoNetlify };
}

test("Gestão: GET de contatos passa filtros e paginação sem mudar DTO", () => {
  const deps = gestaoFicticia();
  const out = consultarGestaoLocal({
    ...deps, pathname: "/api/local/gestao/contatos",
    busca: new URLSearchParams("filtro=autorizados&busca=teste&pagina=3")
  });
  assert.deepEqual(deps.listCalls, [{
    filtro: "autorizados", busca: "teste", pagina: 3, limite: 15
  }]);
  assert.deepEqual(out, { status: 200, body: {
    ok: true, contatos: [{ nome: "Teste", telefone: "***" }]
  } });
  const defaults = consultarGestaoLocal({
    ...deps, pathname: "/api/local/gestao/contatos", busca: new URLSearchParams()
  });
  assert.equal(defaults.status, 200);
  assert.deepEqual(deps.listCalls[1], { filtro: "todos", busca: "", pagina: 1, limite: 15 });
});

test("Gestão: detalhe, resumo e denúncias preservam estrutura e dados de exemplo", () => {
  const deps = gestaoFicticia();
  const base = { ...deps, busca: new URLSearchParams("id=contato-1") };
  assert.deepEqual(consultarGestaoLocal({
    ...base, pathname: "/api/local/gestao/contato"
  }), { status: 200, body: { ok: true, contato: { id: "contato-1", status: "autorizado" } } });
  const resumo = consultarGestaoLocal({ ...base, pathname: "/api/local/gestao/resumo" });
  assert.deepEqual(resumo, { status: 200, body: {
    ok: true,
    contatos: { autorizados: 1, bloqueados: 0 },
    filas: { total: 3, web: 2, pendentes: 3 },
    whatsapp: { fase: "pausado" },
    denuncias: [{ motivo: "denuncia-convite", id: 1 }, { motivo: "denuncia-convite", id: 3 }],
    sincronizacao: { ativo: false }
  } });
  assert.deepEqual(consultarGestaoLocal({
    ...base, pathname: "/api/local/gestao/denuncias"
  }), { status: 200, body: {
    ok: true,
    ocorrencias: [
      { motivo: "denuncia-convite", id: 1 },
      { motivo: "saida-solicitada", id: 2 },
      { motivo: "denuncia-convite", id: 3 }
    ],
    resumo: { denuncias: 2 },
    sincronizacao: { ativo: false }
  } });
  assert.equal(consultarGestaoLocal({
    ...base, pathname: "/api/local/gestao/nao-existe"
  }), null, "rota desconhecida continua a cargo do servidor");
  assert.equal(consultarGestaoLocal({
    ...base, pathname: "/api/local/gestao/contato/bloquear"
  }), null, "nunca executar bloqueios na rota de consultas");
});

test("Gestão: integração HTTP mantém autorização por Host e distinção GET/POST/HEAD", async t => {
  const dir = mkdtempSync(join(tmpdir(), "cpv-gestao-consulta-"));
  const app = await iniciarServidor({
    port: 0, host: "127.0.0.1", dataDir: dir, whatsappWorkerTeste: true,
    metaAmbiente: {}, publicBaseUrl: ""
  });
  t.after(async () => {
    app.servidor.closeAllConnections();
    await new Promise(resolve => app.servidor.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  });
  const get = await fetch(app.base + "/api/local/gestao/contatos");
  assert.equal(get.status, 200);
  assert.equal((await get.json()).ok, true);
  const head = await fetch(app.base + "/api/local/gestao/contatos", { method: "HEAD" });
  assert.equal(head.status, 200);

  const invalidHost = await new Promise((resolve, reject) => {
    const request = httpRequest(app.base + "/api/local/gestao/contatos", {
      headers: { host: "outro-domínio.invalid" }, method: "GET"
    }, response => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
      response.on("error", reject);
    });
    request.on("error", reject);
    request.end();
  });
  assert.equal(invalidHost, 403);

  const post = await fetch(app.base + "/api/local/gestao/contatos", {
    method: "POST",
    headers: {
      "content-type": "application/json", origin: app.base, "x-cpv-local": "1"
    },
    body: "{}"
  });
  assert.equal(post.status, 405);
  const external = await fetch(app.base + "/api/local/gestao/contatos", {
    headers: { "sec-fetch-site": "cross-site" }
  });
  assert.equal(external.status, 403);
});
