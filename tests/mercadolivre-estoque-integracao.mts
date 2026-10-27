import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MercadoLivreApiFonte } from "../src/fontes/mercadolivre/api.js";
import { avaliarQualidadeOferta } from "../src/ofertas/qualidade.js";

function payload(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status, headers: { "content-type": "application/json" }
  });
}

async function catalogoSintetico(quantidadeVencedor: number | null, ativo = true) {
  const tmp = await mkdtemp(join(tmpdir(), "ml-estoque-seguro-"));
  const oldFetch = globalThis.fetch;
  const keys = [
    "MERCADOLIVRE_CATALOG_404_CACHE_PATH", "MERCADOLIVRE_SEARCH_PAGES_PER_QUERY",
    "MERCADOLIVRE_REQUEST_INTERVAL_MS", "MERCADOLIVRE_MAX_OFFERS_PER_QUERY",
    "MIN_DISCOUNT_PERCENT"
  ];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  let queryCount = 0;
  try {
    process.env.MERCADOLIVRE_CATALOG_404_CACHE_PATH = join(tmp, "404.json");
    process.env.MERCADOLIVRE_SEARCH_PAGES_PER_QUERY = "1";
    process.env.MERCADOLIVRE_REQUEST_INTERVAL_MS = "250";
    process.env.MERCADOLIVRE_MAX_OFFERS_PER_QUERY = "1";
    process.env.MIN_DISCOUNT_PERCENT = "20";
    globalThis.fetch = (async (request: URL | string) => {
      queryCount++;
      const url = String(request);
      if (url.includes("/products/search")) return payload({
        paging: { total: 1 },
        results: [{ id: "MLB12345678", status: "active", name: "Smartwatch D20 branco" }]
      });
      if (url.endsWith("/products/MLB12345678/items")) return payload({
        results: [{
          item_id: "MLB987654321", seller_id: 4423, price: 400,
          original_price: 600, condition: "new"
          // available_quantity omitted by third-party marketplace API
        }]
      });
      if (url.includes("/users/bulk")) return payload([{
        status_code: 200, body: {
          id: 4423, seller_reputation: { level_id: "5_green" }
        }
      }]);
      if (url.endsWith("/products/MLB12345678")) return payload({
        id: "MLB12345678", status: ativo ? "active" : "paused",
        buy_box_winner: quantidadeVencedor === null ? null : {
          item_id: "MLB987654321", seller_id: 4423,
          price: 400, available_quantity: quantidadeVencedor
        }
      });
      throw new Error("Unexpected request in offline mock: " + new URL(url).pathname);
    }) as typeof fetch;

    const ofertas = await new MercadoLivreApiFonte(
      "smartwatch", 1, "synthetic-token"
    ).buscar();
    assert.ok(queryCount <= 5, "fixture must remain a bounded offline search");
    return ofertas;
  } finally {
    globalThis.fetch = oldFetch;
    for (const key of keys) {
      if (previous[key] == null) delete process.env[key];
      else process.env[key] = previous[key];
    }
    await rm(tmp, { recursive: true, force: true });
  }
}

test("produto ativo mas indisponivel nunca entra em ofertas mesmo com 33% off", async () => {
  for (const stock of [null, 0]) {
    const ofertas = await catalogoSintetico(stock);
    assert.equal(ofertas.length, 0, "sem buybox compravel o produto fica bloqueado");
  }
  const inativo = await catalogoSintetico(10, false);
  assert.equal(inativo.length, 0, "catalogo pausado com stock antigo tambem fica bloqueado");
});

test("buybox confirma estoque quando a listagem publica nao expõe quantidade", async () => {
  const ofertas = await catalogoSintetico(3);
  assert.equal(ofertas.length, 1);
  assert.equal(ofertas[0]?.estoqueDisponivel, 3);
  assert.equal(ofertas[0]?.disponibilidadeConfirmada, true);
  assert.equal(ofertas[0]?.anuncioId, "MLB987654321");
  assert.equal(ofertas[0]?.vendedorId, 4423);
  assert.equal(avaliarQualidadeOferta(ofertas[0]!).elegivel, true);
});
