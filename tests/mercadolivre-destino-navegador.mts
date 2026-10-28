import test from "node:test";
import assert from "node:assert/strict";
import type { BrowserContext } from "playwright";
import { auditarDestinoLinkMercadoLivreNavegador }
  from "../src/afiliados/mercadolivre-destino-navegador.js";

const short = "https://meli.la/TESTE_NAVEGADOR_TECNICO_123";
const produto = "MLB38053317";
const base = "https://www.mercadolivre.com.br";

function fixture(destino: string, config: { status?: number; canonical?: string } = {}) {
  return async (context: BrowserContext) => {
    await context.route("https://meli.la/**", route => route.fulfill({
      status: 200, contentType: "text/html",
      body: `<html><body><script>
        location.replace(${JSON.stringify(destino)});
      </script></body></html>`
    }));
    await context.route(base + "/**", route => route.fulfill({
      status: config.status ?? 200,
      contentType: "text/html",
      body: `<html><head>${config.canonical
        ? '<link rel="canonical" href="' + config.canonical + '">'
        : ""}</head><body>Produto publico de teste</body></html>`
    }));
  };
}

test("navegador isolado confirma somente catalogo final idêntico", {
  timeout: 25000
}, async () => {
  const result = await auditarDestinoLinkMercadoLivreNavegador(
    short + "?affiliate=valor-nao-divulgar", produto, {
      timeoutMs: 9000, esperaMs: 650,
      prepararFixtures: fixture(base + "/furadeira-teste/p/MLB38053317")
    }
  );
  assert.equal(result.estado, "confirmado", JSON.stringify(result));
  assert.equal(result.motivo, "NAVEGADOR_CATALOGO_CORRESPONDENTE");
  assert.equal(result.atribuicaoComprovada, false);
  assert.ok(result.saltos <= 6);
  assert.doesNotMatch(JSON.stringify(result), /affiliate=|meli\.la|https:\/\//);
});

test("navegador denuncia catalogo divergente e nunca comprova atribuicao", {
  timeout: 25000
}, async () => {
  const result = await auditarDestinoLinkMercadoLivreNavegador(short, produto, {
    timeoutMs: 9000, esperaMs: 650,
    prepararFixtures: fixture(base + "/outro-produto/p/MLB38053318")
  });
  assert.equal(result.estado, "divergente", JSON.stringify(result));
  assert.equal(result.motivo, "NAVEGADOR_CATALOGO_DIVERGENTE");
  assert.equal(result.atribuicaoComprovada, false);
});

test("canonical oficial com mesmo id pode confirmar quando a URL nao mostra catalogo", {
  timeout: 25000
}, async () => {
  const result = await auditarDestinoLinkMercadoLivreNavegador(short, produto, {
    timeoutMs: 9000, esperaMs: 650,
    prepararFixtures: fixture(base + "/produto-publico", {
      canonical: base + "/p/MLB38053317"
    })
  });
  assert.equal(result.estado, "confirmado", JSON.stringify(result));
  assert.equal(result.atribuicaoComprovada, false);
});

test("navegador recusa destino fora do Mercado Livre sem navegar nele", {
  timeout: 25000
}, async () => {
  let externoChamado = false;
  const result = await auditarDestinoLinkMercadoLivreNavegador(short, produto, {
    timeoutMs: 9000, esperaMs: 650,
    prepararFixtures: async context => {
      await fixture("https://externo.example/checkout")(context);
      await context.route("https://externo.example/**", async route => {
        externoChamado = true;
        await route.fulfill({status:200,body:"NUNCA_ACESSAR"});
      });
    }
  });
  assert.equal(result.estado, "inconclusivo", JSON.stringify(result));
  assert.equal(result.motivo, "NAVEGADOR_DESTINO_EXTERNO_BLOQUEADO");
  assert.equal(externoChamado, false);
});

test("caminho de compra, pagina 403 e pagina sem ID nao sao homologados", {
  timeout: 60000
}, async () => {
  const cases = [
    {
      destino: base + "/checkout/p/MLB38053317",
      status: 200,
      motivo: "NAVEGADOR_CAMINHO_COMPRA_BLOQUEADO"
    },
    {
      destino: base + "/p/MLB38053317",
      status: 403,
      motivo: "NAVEGADOR_RESPOSTA_NAO_CONFIRMADA"
    },
    {
      destino: base + "/pagina-de-ajuda",
      status: 200,
      motivo: "NAVEGADOR_SEM_ID_CATALOGO"
    }
  ];
  for (const c of cases) {
    const result = await auditarDestinoLinkMercadoLivreNavegador(short, produto, {
      timeoutMs: 9000, esperaMs: 650,
      prepararFixtures: fixture(c.destino, { status: c.status })
    });
    assert.equal(result.estado, "inconclusivo", JSON.stringify(result));
    assert.equal(result.motivo, c.motivo, JSON.stringify(result));
    assert.equal(result.atribuicaoComprovada, false);
  }
});

test("bloqueia shortlink nao oficial sem abrir navegador", async () => {
  const result = await auditarDestinoLinkMercadoLivreNavegador(
    "https://phishing.example/p/MLB38053317", produto
  );
  assert.equal(result.estado, "inconclusivo");
  assert.equal(result.motivo, "NAVEGADOR_LINK_INVALIDO");
});
