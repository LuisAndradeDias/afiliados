import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MercadoLivreReautorizacaoNecessaria,
  obterTokenMercadoLivreValido
} from "../src/afiliados/mercadolivre-token.js";
import { MercadoLivreApiFonte } from "../src/fontes/mercadolivre/api.js";

const root = await mkdtemp(join(tmpdir(), "afiliados-test-ml-oauth-"));
const envPath = join(root, ".env");
const originalFetch = globalThis.fetch;
const cwd = process.cwd();
const nomes = [
  "MERCADOLIVRE_ACCESS_TOKEN",
  "MERCADOLIVRE_REFRESH_TOKEN",
  "MERCADOLIVRE_CLIENT_ID",
  "MERCADOLIVRE_CLIENT_SECRET",
  "MERCADOLIVRE_TOKEN_EXPIRES_AT"
];
const originals = Object.fromEntries(
  nomes.map((nome) => [nome, process.env[nome]])
);
const now = Date.now();

function fixture(token: string, refresh: string, expira: number): string {
  return [
    "CUSTOM_SETTING_PRESERVE=keep-this-value",
    "MERCADOLIVRE_ACCESS_TOKEN=" + token,
    "MERCADOLIVRE_REFRESH_TOKEN=" + refresh,
    "MERCADOLIVRE_CLIENT_ID=app-test-id",
    "MERCADOLIVRE_CLIENT_SECRET=app-test-secret",
    "MERCADOLIVRE_TOKEN_EXPIRES_AT=" + expira,
    "ALTERNATING_MONITOR_ENABLED=false",
    ""
  ].join("\n");
}

function tokenResponse(token: string, refresh: string): Response {
  return new Response(JSON.stringify({
    access_token: token,
    refresh_token: refresh,
    expires_in: 21600,
    user_id: 1234
  }), { status: 200, headers: { "content-type": "application/json" } });
}

try {
  await writeFile(envPath, fixture("access-old", "refresh-old", now - 3600), "utf8");

  let refreshCalls = 0;
  const refreshFake = async (_url: string | URL | Request, init?: RequestInit) => {
    refreshCalls += 1;
    assert.equal(init?.method, "POST");
    const body = init?.body as URLSearchParams;
    assert.equal(body.get("grant_type"), "refresh_token");
    assert.equal(body.get("client_id"), "app-test-id");
    assert.equal(body.get("client_secret"), "app-test-secret");
    assert.equal(body.get("refresh_token"), "refresh-old");
    return tokenResponse("access-new", "refresh-new");
  };
  const opts = {
    envPath,
    fetchImpl: refreshFake as typeof fetch,
    agora: () => now
  };
  const [a, b, c] = await Promise.all([
    obterTokenMercadoLivreValido(opts),
    obterTokenMercadoLivreValido(opts),
    obterTokenMercadoLivreValido(opts)
  ]);
  assert.deepEqual([a, b, c], ["access-new", "access-new", "access-new"]);
  assert.equal(refreshCalls, 1, "Renovação concorrente deve ocorrer uma vez");
  const updated = await readFile(envPath, "utf8");
  assert.ok(updated.includes("MERCADOLIVRE_ACCESS_TOKEN=access-new"));
  assert.ok(updated.includes("MERCADOLIVRE_REFRESH_TOKEN=refresh-new"));
  assert.ok(updated.includes("MERCADOLIVRE_USER_ID=1234"));
  assert.ok(updated.includes("CUSTOM_SETTING_PRESERVE=keep-this-value"));
  assert.ok(updated.includes("ALTERNATING_MONITOR_ENABLED=false"));
  assert.ok(!(await readFile(envPath, "utf8")).includes("refresh-old"));

  const reused = await obterTokenMercadoLivreValido({
    envPath, fetchImpl: refreshFake as typeof fetch, agora: () => now
  });
  assert.equal(reused, "access-new");
  assert.equal(refreshCalls, 1, "Token ainda válido não pode ser renovado novamente");

  const alreadyRotated = await obterTokenMercadoLivreValido({
    envPath,
    forcar: true,
    tokenRejeitado: "access-old",
    fetchImpl: refreshFake as typeof fetch,
    agora: () => now
  });
  assert.equal(alreadyRotated, "access-new");
  assert.equal(refreshCalls, 1, "Não reutilizar refresh token após outra renovação");

  const invalidFixture = fixture("access-invalid", "refresh-invalid", now - 1000);
  await writeFile(envPath, invalidFixture, "utf8");
  await assert.rejects(
    obterTokenMercadoLivreValido({
      envPath,
      fetchImpl: (async () => new Response(
        JSON.stringify({ error: "invalid_grant" }),
        { status: 400 }
      )) as typeof fetch,
      agora: () => now
    }),
    (error) => error instanceof MercadoLivreReautorizacaoNecessaria &&
      error.message.includes("Conectar Mercado Livre")
  );
  assert.equal(await readFile(envPath, "utf8"), invalidFixture,
    "Refresh negado não pode alterar tokens armazenados");

  // Simulação da API: token inicialmente não vencido, porém rejeitado com 401.
  await writeFile(envPath, fixture("access-401", "refresh-401", now + 100_000), "utf8");
  process.chdir(root);
  process.env.MERCADOLIVRE_ACCESS_TOKEN = "access-401";
  process.env.MERCADOLIVRE_REFRESH_TOKEN = "refresh-401";
  let chamadas401 = 0;
  let renovacoes401 = 0;
  let buscasOk = 0;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/oauth/token")) {
      renovacoes401 += 1;
      assert.equal((init?.body as URLSearchParams).get("refresh_token"), "refresh-401");
      return tokenResponse("access-401-new", "refresh-401-new");
    }
    if (url.includes("/products/search")) {
      const auth = new Headers(init?.headers).get("authorization");
      if (auth === "Bearer access-401") {
        chamadas401 += 1;
        return new Response(
          JSON.stringify({ code: "unauthorized", message: "invalid access token" }),
          { status: 401 }
        );
      }
      assert.equal(auth, "Bearer access-401-new");
      buscasOk += 1;
      return new Response(JSON.stringify({ results: [], paging: { total: 0 } }), {
        status: 200
      });
    }
    throw new Error("URL não esperada na simulação: " + url);
  }) as typeof fetch;

  const ofertas = await new MercadoLivreApiFonte("monitor", 5).buscar();
  assert.deepEqual(ofertas, []);
  assert.equal(chamadas401, 1, "Uma resposta 401 deve forçar refresh uma vez");
  assert.equal(renovacoes401, 1, "Refresh deve ser único");
  assert.equal(buscasOk, 1, "Consulta deve ser repetida com token válido");
  const updated401 = await readFile(envPath, "utf8");
  assert.ok(updated401.includes("MERCADOLIVRE_REFRESH_TOKEN=refresh-401-new"));

  console.log("mercadolivre-auth: OK (expiração, rotação, concorrência, invalidação e 401 com retry único)");
} finally {
  process.chdir(cwd);
  globalThis.fetch = originalFetch;
  for (const [nome, valor] of Object.entries(originals)) {
    if (valor === undefined) delete process.env[nome];
    else process.env[nome] = valor;
  }
  await rm(root, { recursive: true, force: true });
}
