import test from "node:test";
import assert from "node:assert/strict";
import type { Oferta } from "../src/fontes/types.js";
import {
  publicacaoComEstoqueConfirmado,
  publicacaoCandidataParaConfirmar,
  catalogoComCompraConfirmada,
  disponibilidadeMercadoLivreRecente,
  revalidarDisponibilidadeMercadoLivre
} from "../src/fontes/mercadolivre/disponibilidade.js";
import { avaliarQualidadeOferta } from "../src/ofertas/qualidade.js";

const item = {
  item_id: "MLB987654321", seller_id: 1234, price: 600,
  original_price: 900, condition: "new", status: "active",
  available_quantity: 7
};
const catalog = {
  id: "MLB12345678", status: "active",
  buy_box_winner: {
    item_id: "MLB987654321", seller_id: 1234,
    price: 600, available_quantity: 7
  }
};
function oferta(overrides: Partial<Oferta> = {}): Oferta {
  return {
    plataforma: "Mercado Livre",
    produtoId: "MLB12345678",
    anuncioId: "MLB987654321",
    vendedorId: 1234,
    titulo: "Air Fryer 5 litros",
    precoAtual: 600,
    precoAnterior: 900,
    descontoPercentual: 33,
    estoqueDisponivel: 7,
    disponibilidadeConfirmada: true,
    disponibilidadeVerificadaEm: new Date().toISOString(),
    urlProduto: "https://www.mercadolivre.com.br/p/MLB12345678",
    encontradoEm: new Date(),
    ...overrides
  };
}

test("estoque zero, desconhecido e publicacao pausada jamais passam", () => {
  assert.equal(publicacaoComEstoqueConfirmado(item), true);
  for (const qty of [0, -1, null, undefined, NaN]) {
    assert.equal(publicacaoComEstoqueConfirmado({
      ...item, available_quantity: qty
    }), false, "Quantity " + qty);
  }
  assert.equal(publicacaoComEstoqueConfirmado({ ...item, status: "paused" }), false);
  assert.equal(publicacaoComEstoqueConfirmado({ ...item, condition: "used" }), false);
  assert.equal(publicacaoComEstoqueConfirmado({ ...item, price: 0 }), false);
});

test("catalogo ativo sem vencedor ou sem estoque nunca comprova compra", () => {
  assert.equal(catalogoComCompraConfirmada(catalog.id, item, catalog), true);
  assert.equal(catalogoComCompraConfirmada(catalog.id, item,
    { ...catalog, buy_box_winner: null }), false);
  assert.equal(catalogoComCompraConfirmada(catalog.id, item,
    { ...catalog, buy_box_winner: { ...catalog.buy_box_winner, available_quantity: 0 } }), false);
  assert.equal(catalogoComCompraConfirmada(catalog.id, item,
    { ...catalog, buy_box_winner: { ...catalog.buy_box_winner, available_quantity: undefined } }), false);
  assert.equal(catalogoComCompraConfirmada(catalog.id, item,
    { ...catalog, buy_box_winner: { ...catalog.buy_box_winner, item_id: "MLB999" } }), false);
  assert.equal(catalogoComCompraConfirmada(catalog.id, item,
    { ...catalog, buy_box_winner: { ...catalog.buy_box_winner, seller_id: 55 } }), false);
  assert.equal(catalogoComCompraConfirmada(catalog.id, item,
    { ...catalog, buy_box_winner: { ...catalog.buy_box_winner, price: 650 } }), false);
  assert.equal(catalogoComCompraConfirmada(catalog.id, item,
    { ...catalog, status: "paused" }), false);
  assert.equal(catalogoComCompraConfirmada("MLBOTHER", item, catalog), false);
});

test("qualidade bloqueia oferta sem disponibilidade mesmo com desconto grande", () => {
  assert.equal(avaliarQualidadeOferta(oferta()).elegivel, true);
  for (const delta of [
    { estoqueDisponivel: 0 }, { estoqueDisponivel: undefined },
    { disponibilidadeConfirmada: false }, { anuncioId: undefined },
    { vendedorId: undefined }, { disponibilidadeVerificadaEm: undefined },
    { disponibilidadeVerificadaEm: new Date(Date.now() - 11 * 60_000).toISOString() }
  ]) {
    const result = avaliarQualidadeOferta(oferta(delta));
    assert.equal(result.elegivel, false);
    assert.match(result.motivo, /disponibilidade|estoque/);
  }
  assert.equal(disponibilidadeMercadoLivreRecente(oferta()), true);
  assert.equal(disponibilidadeMercadoLivreRecente(oferta({
    disponibilidadeVerificadaEm: new Date(Date.now() - 11 * 60_000).toISOString()
  })), false);
});

test("revalidacao usa somente GET e recusa API incompleta antes do WhatsApp", async () => {
  let calls = 0;
  const mockGet = async (url: unknown, options: unknown): Promise<Response> => {
    const opts = options as { method?: string };
    assert.equal(opts.method, "GET");
    assert.equal(String(url), "https://api.mercadolibre.com/products/MLB12345678");
    calls++;
    return new Response(JSON.stringify(catalog), { status: 200 });
  };
  const token = async () => "synthetic-token";
  const good = await revalidarDisponibilidadeMercadoLivre(oferta(), {
    obterToken: token, fetchImpl: mockGet as typeof fetch
  });
  assert.ok(good.estoqueDisponivel > 0);
  assert.equal(calls, 1);
  assert.match(good.verificadoEm, /^\d{4}-/);

  const badResponse = async () => new Response(JSON.stringify({
    ...catalog, buy_box_winner: { ...catalog.buy_box_winner, available_quantity: 0 }
  }), { status: 200 });
  await assert.rejects(
    revalidarDisponibilidadeMercadoLivre(oferta(), {
      obterToken: token, fetchImpl: badResponse as typeof fetch
    }),
    /PRODUTO_INDISPONIVEL/
  );
  const unauthorized = async () => new Response("{}", { status: 403 });
  await assert.rejects(
    revalidarDisponibilidadeMercadoLivre(oferta(), {
      obterToken: token, fetchImpl: unauthorized as typeof fetch
    }),
    /HTTP 403/
  );
  let networkCalled = false;
  await assert.rejects(
    revalidarDisponibilidadeMercadoLivre(oferta({ disponibilidadeConfirmada: false }), {
      obterToken: async () => {
        networkCalled = true;
        return "never";
      }
    }),
    /DISPONIBILIDADE_NAO_CONFIRMADA/
  );
  assert.equal(networkCalled, false, "invalid cached availability must block before HTTP/token");
});


test("quantidade nao publicada requer buy box oficial positiva antes de liberar", () => {
  const desconhecida = { ...item, available_quantity: undefined };
  assert.equal(publicacaoComEstoqueConfirmado(desconhecida), false);
  assert.equal(publicacaoCandidataParaConfirmar(desconhecida), true);
  assert.equal(catalogoComCompraConfirmada(catalog.id, desconhecida, catalog), true,
    "estoque positivo do vencedor confirma anuncio mesmo sem quantidade publica");
  assert.equal(catalogoComCompraConfirmada(catalog.id,
    { ...item, available_quantity: null }, catalog), true);

  assert.equal(catalogoComCompraConfirmada(catalog.id,
    { ...item, available_quantity: 0 }, catalog), false,
    "zero declarado pelo anuncio nao pode ser ignorado");
  assert.equal(catalogoComCompraConfirmada(catalog.id,
    desconhecida, { ...catalog, buy_box_winner: null }), false,
    "catalogo active com pagina indisponivel permanece bloqueado");
  assert.equal(catalogoComCompraConfirmada(catalog.id,
    desconhecida, { ...catalog, buy_box_winner: {
      ...catalog.buy_box_winner, available_quantity: undefined
    } }), false, "buy box sem quantidade tambem bloqueia");
});
