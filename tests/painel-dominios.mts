import assert from "node:assert/strict";
import test from "node:test";
import { normalizarTagAmazon, validarTagAmazon } from "../src/painel/dominios/amazon-tag.js";
import {
  redirectMercadoLivreEhValido,
  credenciaisMercadoLivreConfiguradas,
  criarUrlAutorizacaoMercadoLivre,
  trocarCodigoMercadoLivre
} from "../src/painel/dominios/mercadolivre-oauth.js";
import { arquivoDoRobo } from "../src/painel/dominios/scripts-robo.js";

test("Amazon: normaliza tracking ID e mantém validação do painel", () => {
  assert.equal(normalizarTagAmazon("  exemplo-20  "), "exemplo-20");
  assert.equal(normalizarTagAmazon("https://www.amazon.com.br/dp/B01?tag=outlet-20&ref=x"), "outlet-20");
  assert.equal(normalizarTagAmazon("https://www.amazon.com.br/dp/B01"), "https://www.amazon.com.br/dp/B01");
  assert.equal(normalizarTagAmazon(""), "");
  assert.equal(validarTagAmazon("topoutlet05-20"), true);
  assert.equal(validarTagAmazon("_ok"), true);
  assert.equal(validarTagAmazon("ab"), false);
  assert.equal(validarTagAmazon("exemplo!"), false);
  assert.equal(validarTagAmazon("x".repeat(65)), false);
});

test("Mercado Livre: configurações só permitem redirect HTTPS no callback esperado", () => {
  assert.equal(redirectMercadoLivreEhValido("https://afiliados.example/oauth/mercadolivre/callback"), true);
  assert.equal(redirectMercadoLivreEhValido(" http://afiliados.example/oauth/mercadolivre/callback "), false);
  assert.equal(redirectMercadoLivreEhValido("https://afiliados.example/outro"), false);
  assert.equal(redirectMercadoLivreEhValido("nao-e-url"), false);
  assert.equal(credenciaisMercadoLivreConfiguradas("app-123", "secret-xyz"), true);
  assert.equal(credenciaisMercadoLivreConfiguradas("app-123", ""), false);
  assert.equal(credenciaisMercadoLivreConfiguradas(" ", "secret-xyz"), false);
});

test("Mercado Livre: autorização usa state e redirect originais sem fazer rede", () => {
  const redirectUri = "https://afiliados.example/oauth/mercadolivre/callback";
  const url = new URL(criarUrlAutorizacaoMercadoLivre({
    clientId: "app-exemplo", clientSecret: "segredo-ficticio",
    redirectUri, state: "estado-gerado-no-servidor"
  }));
  assert.equal(url.origin, "https://auth.mercadolivre.com.br");
  assert.equal(url.pathname, "/authorization");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    response_type: "code",
    client_id: "app-exemplo",
    redirect_uri: redirectUri,
    state: "estado-gerado-no-servidor"
  });
  assert.throws(() => criarUrlAutorizacaoMercadoLivre({
    clientId: "abc", clientSecret: "", redirectUri, state: "x"
  }), /Configure o App ID e a Secret Key/);
  assert.throws(() => criarUrlAutorizacaoMercadoLivre({
    clientId: "abc", clientSecret: "secret", redirectUri: "http://localhost/callback", state: "x"
  }), /Redirect URI HTTPS válido/);
});

test("Mercado Livre: troca código via fetch injetado e preserva protocolo OAuth", async () => {
  const calls: string[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    assert.equal(String(input), "https://api.mercadolibre.com/oauth/token");
    assert.equal(init?.method, "POST");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("content-type"), "application/x-www-form-urlencoded");
    assert.equal(headers.get("accept"), "application/json");
    const body = init?.body as URLSearchParams;
    assert.deepEqual(Object.fromEntries(body), {
      grant_type: "authorization_code",
      client_id: "id-mock",
      client_secret: "secret-mock",
      code: "code-mock",
      redirect_uri: "https://afiliados.example/oauth/mercadolivre/callback"
    });
    calls.push("called");
    return new Response(JSON.stringify({
      access_token: "token-mock", refresh_token: "refresh-mock", expires_in: 3600, user_id: 123
    }), { status: 200 });
  };
  const token = await trocarCodigoMercadoLivre({
    clientId: "id-mock", clientSecret: "secret-mock", code: "code-mock",
    redirectUri: "https://afiliados.example/oauth/mercadolivre/callback", fetchImpl: fakeFetch
  });
  assert.deepEqual(token, {
    access_token: "token-mock", refresh_token: "refresh-mock", expires_in: 3600, user_id: 123
  });
  assert.equal(calls.length, 1);
  await assert.rejects(trocarCodigoMercadoLivre({
    clientId: "", clientSecret: "mock", code: "a", redirectUri: "", fetchImpl: fakeFetch
  }), /Credenciais do aplicativo Mercado Livre não configuradas/);
  assert.equal(calls.length, 1, "sem credenciais não realiza requisição");
  await assert.rejects(trocarCodigoMercadoLivre({
    clientId: "id", clientSecret: "secret", code: "a", redirectUri: "x",
    fetchImpl: async () => new Response("invalid_grant", { status: 400 })
  }), /Mercado Livre OAuth HTTP 400: invalid_grant/);
});

test("WhatsApp/Amazon/Meli: apenas scripts conhecidos podem ser lançados", () => {
  const expected = {
    buscar: "src/robo/whatsapp-preview.ts",
    login: "src/robo/whatsapp-login.ts",
    preparar: "src/robo/whatsapp-preparar.ts",
    "mercadolivre-login": "src/robo/mercadolivre-login.ts",
    "mercadolivre-buscar": "src/robo/mercadolivre-preview.ts",
    "mercadolivre-whatsapp": "src/robo/mercadolivre-whatsapp.ts",
    automatico: "src/robo/automatico.ts"
  };
  for (const [nome, caminho] of Object.entries(expected)) {
    assert.equal(arquivoDoRobo(nome), caminho);
  }
  for (const invalid of ["../../.env", "rm -rf", "", "python", "__proto__", "toString"]) {
    assert.throws(() => arquivoDoRobo(invalid), /Ação desconhecida/);
  }
});
