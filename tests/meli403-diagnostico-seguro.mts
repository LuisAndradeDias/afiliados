import assert from "node:assert/strict";
import test from "node:test";
import { MercadoLivreApiFonte } from "../src/fontes/mercadolivre/api.js";
import {
  MercadoLivreAcessoNegado, MercadoLivreLimiteApi,
  diagnosticarNegacaoMeli403
} from "../src/fontes/mercadolivre/erros.js";

test("somente metadados permitidos sao extraidos do corpo do 403", () => {
  const resultado = diagnosticarNegacaoMeli403(JSON.stringify({
    code: "FORBIDDEN",
    error: "access_denied",
    message: "token privado que nao deve ser logado",
    access_token: "segredo-ficticio"
  }), "97a947cf-86b2-46a8-a70b-bf19d74881df");
  assert.deepEqual(resultado, {
    codigo: "FORBIDDEN", erro: "access_denied",
    requestId: "97a947cf-86b2-46a8-a70b-bf19d74881df"
  });
  assert.ok(!JSON.stringify(resultado).includes("segredo-ficticio"));
  assert.ok(!JSON.stringify(resultado).includes("token privado"));
});

test("403 conserva codigo de politica, sem vazamento de texto arbitrario", () => {
  const resultado = diagnosticarNegacaoMeli403(JSON.stringify({
    code: "PA_UNAUTHORIZED_RESULT_FROM_POLICIES",
    blocked_by: "PolicyAgent",
    error: "token real colado aqui",
    metadata: { cookie: "NAO-EXIBIR" }
  }), "id\nheader-malicioso");
  assert.deepEqual(resultado, {
    codigo: "PA_UNAUTHORIZED_RESULT_FROM_POLICIES", politica: "PolicyAgent"
  });
  assert.deepEqual(diagnosticarNegacaoMeli403("nao-json", null), {});
});

test("API interrompe no primeiro HTTP 403 sem renovar token ou repetir", async () => {
  const original = globalThis.fetch;
  let chamadas = 0;
  try {
    globalThis.fetch = (async (_url, config) => {
      chamadas++;
      assert.equal(new Headers(config?.headers).get("authorization"), "Bearer TOKEN_SIMULADO");
      return new Response(JSON.stringify({
        code: "FORBIDDEN", error: "access_denied",
        message: "nao enviar mensagem ao console", access_token: "SENHA_FICTICIA"
      }), {
        status: 403,
        headers: { "x-request-id": "a4b6d890-6031-4531-8100-e657392f92d1" }
      });
    }) as typeof fetch;
    const api = new MercadoLivreApiFonte("teste", 1, "TOKEN_SIMULADO");
    const requisitar = api as unknown as { requisicao(url: URL): Promise<Response> };
    await assert.rejects(
      () => requisitar.requisicao(new URL("https://api.mercadolibre.com/items/MLB123456789")),
      (err: unknown) => {
        assert.ok(err instanceof MercadoLivreAcessoNegado);
        assert.equal(err.code, "MERCADOLIVRE_PERMISSION_REQUIRED");
        assert.equal(err.recurso, "/items/MLB123456789");
        assert.deepEqual(err.diagnostico, {
          codigo: "FORBIDDEN",
          erro: "access_denied",
          requestId: "a4b6d890-6031-4531-8100-e657392f92d1"
        });
        assert.ok(!err.message.includes("SENHA_FICTICIA"));
        assert.ok(!err.message.includes("nao enviar mensagem ao console"));
        return true;
      }
    );
    assert.equal(chamadas, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("HTTP 429 preserva Retry-After e nao repete chamadas", async () => {
  const original = globalThis.fetch;
  let chamadas = 0;
  try {
    globalThis.fetch = (async () => {
      chamadas++;
      return new Response("limite", {status: 429, headers: {"retry-after": "3"}});
    }) as typeof fetch;
    const api = new MercadoLivreApiFonte("teste", 1, "TOKEN_SIMULADO");
    const requisitar = api as unknown as { requisicao(url: URL): Promise<Response> };
    await assert.rejects(
      () => requisitar.requisicao(new URL("https://api.mercadolibre.com/items/MLB123456789")),
      (err: unknown) => err instanceof MercadoLivreLimiteApi && err.retryAfterMs === 3000
    );
    assert.equal(chamadas, 1);
  } finally {
    globalThis.fetch = original;
  }
});
