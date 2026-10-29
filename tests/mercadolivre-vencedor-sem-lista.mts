import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MercadoLivreApiFonte } from "../src/fontes/mercadolivre/api.js";
import { avaliarQualidadeOferta } from "../src/ofertas/qualidade.js";

const produtoId = "MLB87654321";
const itemId = "MLB9988776655";
const preco = 299.90;
const original = 499.90;
function resposta(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { "content-type": "application/json" }
  });
}

async function executarComAPI(
  { itemInvalido = false, semVencedor = false } = {}
) {
  const dir = await mkdtemp(join(tmpdir(), "cpv-ml-buybox-"));
  const oldFetch = globalThis.fetch;
  const envNames = [
    "MERCADOLIVRE_CATALOG_404_CACHE_PATH",
    "MERCADOLIVRE_SEARCH_PAGES_PER_QUERY",
    "MERCADOLIVRE_REQUEST_INTERVAL_MS",
    "MIN_DISCOUNT_PERCENT"
  ];
  const oldEnv = Object.fromEntries(envNames.map(k => [k, process.env[k]]));
  const caminhos: string[] = [];
  let sellers = 0;
  try {
    process.env.MERCADOLIVRE_CATALOG_404_CACHE_PATH = join(dir, "cache.json");
    process.env.MERCADOLIVRE_SEARCH_PAGES_PER_QUERY = "1";
    process.env.MERCADOLIVRE_REQUEST_INTERVAL_MS = "250";
    process.env.MIN_DISCOUNT_PERCENT = "25";
    globalThis.fetch = (async (url: URL | string) => {
      const path = new URL(String(url)).pathname;
      caminhos.push(path);
      if (path === "/products/search") return resposta({
        paging:{total:1},results:[{id:produtoId,name:"Air fryer digital",status:"active"}]
      });
      if (path === "/products/"+produtoId) return resposta({
        id:produtoId,status:"active",
        buy_box_winner: semVencedor ? null : {
          item_id:itemId,seller_id:77,price:preco,
          available_quantity:4,currency_id:"BRL"
          // API pode nao retornar condicao e preco antigo no objeto buy_box.
        }
      });
      if (path === "/products/"+produtoId+"/items") return resposta({},404);
      if (path === "/items/"+itemId) return resposta({
        id:itemId, seller_id:itemInvalido ? 444 : 77,
        price:preco, original_price:original, condition:"new", status:"active",
        available_quantity:4,currency_id:"BRL",catalog_product_id:produtoId
      });
      if (path === "/users/bulk") {
        sellers++;
        return resposta([{status_code:200,body:{id:77,seller_reputation:{
          level_id:"5_green"
        }}}]);
      }
      throw new Error("Unexpected local fixture request "+path);
    }) as typeof fetch;
    const ofertas = await new MercadoLivreApiFonte(
      "air fryer",1,"TOKEN_FICTICIO"
    ).buscar();
    return { ofertas, caminhos, sellers };
  } finally {
    globalThis.fetch = oldFetch;
    for(const k of envNames) {
      if(oldEnv[k] == null) delete process.env[k];
      else process.env[k] = oldEnv[k];
    }
    await rm(dir,{force:true,recursive:true});
  }
}

test("404 na lista de publicacoes nao oculta vencedor compravel no catalogo",async()=>{
  const resultado=await executarComAPI();
  assert.equal(resultado.ofertas.length,1,
    "O vencedor verificado deve ser recuperado pelo detalhe oficial e pelo item direto");
  const oferta=resultado.ofertas[0]!;
  assert.equal(oferta.anuncioId,itemId);
  assert.equal(oferta.vendedorId,77);
  assert.equal(oferta.precoAtual,preco);
  assert.equal(oferta.precoAnterior,original);
  assert.equal(oferta.estoqueDisponivel,4);
  assert.ok((oferta.descontoPercentual??0)>=25);
  assert.equal(avaliarQualidadeOferta(oferta).elegivel,true);
  assert.deepEqual(resultado.caminhos,[
    "/products/search","/products/"+produtoId,
    "/products/"+produtoId+"/items","/items/"+itemId,"/users/bulk"
  ]);
});

test("informacao contraditoria no item direto nunca gera desconto publicavel",async()=>{
  const r=await executarComAPI({itemInvalido:true});
  assert.equal(r.ofertas.length,0);
  assert.equal(r.sellers,0);
});

test("catalogo sem vencedor nao chama lista, item ou reputacao",async()=>{
  const r=await executarComAPI({semVencedor:true});
  assert.equal(r.ofertas.length,0);
  assert.deepEqual(r.caminhos,[
    "/products/search","/products/"+produtoId
  ]);
  assert.equal(r.sellers,0);
});
