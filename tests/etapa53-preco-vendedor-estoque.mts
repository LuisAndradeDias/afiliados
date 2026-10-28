import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MercadoLivreApiFonte } from "../src/fontes/mercadolivre/api.js";
import {
  centavosBRL, catalogoComCompraConfirmada, publicacaoCandidataParaConfirmar,
  selecionarPublicacaoVencedora, revalidarDisponibilidadeMercadoLivre,
  type DetalheCatalogoDisponibilidade
} from "../src/fontes/mercadolivre/disponibilidade.js";
import { formatarOfertaWhatsapp } from "../src/mensagens/whatsapp.js";
import type { Oferta } from "../src/fontes/types.js";

const produtoId = "MLB38053317";
const perdedor = {
  item_id: "MLB1111111111", seller_id: 111, price: 140.60,
  original_price: 299.90, currency_id: "BRL", condition: "new",
  available_quantity: 9, status: "active"
};
const vencedor = {
  item_id: "MLB2222222222", seller_id: 222, price: 148,
  original_price: 299.90, currency_id: "BRL", condition: "new",
  available_quantity: 5, status: "active"
};
const detalhe = {
  id: produtoId, status: "active",
  buy_box_winner: {
    item_id: vencedor.item_id, seller_id: vencedor.seller_id,
    price: 148, available_quantity: 5, currency_id: "BRL"
  }
};

function payload(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status, headers: { "content-type": "application/json" }
  });
}

async function buscarOffline(options: {
  winner?: DetalheCatalogoDisponibilidade["buy_box_winner"];
  items?: typeof vencedor[];
  greenSellers?: number[];
  originalPrice?: number;
} = {}) {
  const temp = await mkdtemp(join(tmpdir(), "etapa53-oferta-"));
  const keys = [
    "MERCADOLIVRE_CATALOG_404_CACHE_PATH",
    "MERCADOLIVRE_SEARCH_PAGES_PER_QUERY",
    "MERCADOLIVRE_REQUEST_INTERVAL_MS",
    "MERCADOLIVRE_MAX_OFFERS_PER_QUERY"
  ];
  const envOld = new Map(keys.map(key => [key, process.env[key]]));
  const fetchOld = globalThis.fetch;
  const bulkIds: string[] = [];
  const calls: string[] = [];
  try {
    process.env.MERCADOLIVRE_CATALOG_404_CACHE_PATH = join(temp, "404.json");
    process.env.MERCADOLIVRE_SEARCH_PAGES_PER_QUERY = "1";
    process.env.MERCADOLIVRE_REQUEST_INTERVAL_MS = "250";
    process.env.MERCADOLIVRE_MAX_OFFERS_PER_QUERY = "1";
    globalThis.fetch = (async (url: URL | RequestInfo) => {
      const target = String(url);
      calls.push(new URL(target).pathname);
      if (target.includes("/products/search")) {
        return payload({ paging: {total: 1}, results: [
          {id:produtoId, name:"Parafusadeira de impacto The Black Tools", status:"active"}
        ] });
      }
      if (target.endsWith("/products/" + produtoId + "/items")) {
        return payload({ results: options.items ?? [perdedor, vencedor] });
      }
      if (target.endsWith("/products/" + produtoId)) {
        return payload({...detalhe,
          buy_box_winner:options.winner === undefined ? detalhe.buy_box_winner : options.winner
        });
      }
      if (target.includes("/users/bulk")) {
        const ids = new URL(target).searchParams.get("ids") || "";
        bulkIds.push(ids);
        return payload(ids.split(",").map(s => ({
          status_code:200, body:{
            id:Number(s), seller_reputation:{
              level_id:(options.greenSellers ?? [111,222]).includes(Number(s))
                ? "5_green" : "3_yellow"
            }
          }
        })));
      }
      throw new Error("Rede nao prevista: " + new URL(target).pathname);
    }) as typeof fetch;
    const ofertas = await new MercadoLivreApiFonte("parafusadeira",1,"TOKEN_FICTICIO").buscar();
    return {ofertas, bulkIds, calls};
  } finally {
    globalThis.fetch = fetchOld;
    for (const [k, v] of envOld) {
      if (v == null) delete process.env[k];
      else process.env[k] = v;
    }
    await rm(temp,{recursive:true,force:true});
  }
}

test("corresponde ao vendedor vencedor, nunca ao concorrente mais barato no Pix",async()=>{
  const {ofertas,bulkIds,calls}=await buscarOffline({});
  assert.equal(ofertas.length,1);
  const oferta=ofertas[0]!;
  assert.equal(oferta.produtoId,produtoId);
  assert.equal(oferta.anuncioId,vencedor.item_id);
  assert.equal(oferta.vendedorId,222);
  assert.equal(oferta.precoAtual,148);
  assert.equal(oferta.precoAnterior,299.90);
  assert.equal(oferta.descontoPercentual,50,"Porcentagem nao arredonda para cima");
  assert.equal(oferta.estoqueDisponivel,5);
  assert.equal(oferta.precoFonte,"catalogo-vencedor-api");
  assert.equal(oferta.precoCondicaoPagamento,"nao-verificada");
  assert.match(oferta.precoVerificadoEm ?? "", /^\d{4}-/);
  assert.deepEqual(bulkIds,["222"],"Nunca consultar reputacao de outros vendedores como se fossem ganhadores");
  assert.equal(calls.filter(x=>x.endsWith("/products/"+produtoId)).length,1,
    "A pagina de produto deve ser consultada uma vez na busca");
  const texto=formatarOfertaWhatsapp(oferta);
  assert.match(texto,/Preço informado no catálogo/);
  assert.match(texto,/148,00/);
  assert.match(texto,/Pix, cartão/);
  assert.doesNotMatch(texto,/140,60|no Pix|4x R\$|💰 Por \*/);
});

test("ficha oficial completa recupera vencedor omitido da lista sem assumir dados",async()=>{
  const completo={
    ...detalhe.buy_box_winner,condition:"new",
    original_price:299.90
  };
  const ok=await buscarOffline({items:[perdedor],winner:completo});
  assert.equal(ok.ofertas.length,1,"Detalhe buy box oficial completo pode suprir lista incompleta");
  assert.deepEqual(ok.bulkIds,["222"]);
  assert.equal(ok.ofertas[0]?.anuncioId,vencedor.item_id);
  assert.equal(ok.ofertas[0]?.precoAtual,148);
  assert.equal(ok.ofertas[0]?.estoqueDisponivel,5);
  assert.equal(ok.ofertas[0]?.precoAnterior,299.9);
  const semCondicao=await buscarOffline({items:[perdedor],winner:{
    ...detalhe.buy_box_winner,condition:undefined
  }});
  assert.deepEqual(semCondicao.ofertas,[]);
  assert.deepEqual(semCondicao.bulkIds,[]);
  const conflito=await buscarOffline({items:[
    perdedor,{...vencedor,price:140.60}
  ],winner:completo});
  assert.deepEqual(conflito.ofertas,[],"Lista contraditoria nao pode ser ocultada pelo fallback");
});

test("vendedor vencedor sem reputacao verde nao usa concorrente verde",async()=>{
  const result=await buscarOffline({greenSellers:[111]});
  assert.deepEqual(result.ofertas,[]);
  assert.deepEqual(result.bulkIds,["222"]);
});

test("vencedor ausente, outro item e preco divergente bloqueiam antes de reputacao",async()=>{
  for(const winner of [
    null,
    {...detalhe.buy_box_winner,item_id:"MLB9999999999"},
    {...detalhe.buy_box_winner,seller_id:111},
    {...detalhe.buy_box_winner,price:140.60},
    {...detalhe.buy_box_winner,available_quantity:0},
    {...detalhe.buy_box_winner,available_quantity:1.5},
    {...detalhe.buy_box_winner,price:148.005},
    {...detalhe.buy_box_winner,currency_id:"USD"}
  ]) {
    const result=await buscarOffline({winner});
    assert.equal(result.ofertas.length,0,JSON.stringify(winner));
    assert.deepEqual(result.bulkIds,[],"Nao consultar vendedor quando catalogo diverge");
  }
});

test("nunca confirma moeda, estoque e centavos invalidos",()=>{
  for(const value of [0,-1,Infinity,NaN,140.605,148.001,1_000_000.01]) {
    assert.equal(centavosBRL(value),undefined,String(value));
  }
  assert.equal(centavosBRL(140.60),14060);
  assert.equal(centavosBRL(148),14800);
  assert.equal(publicacaoCandidataParaConfirmar({...vencedor,price:148.005}),false);
  assert.equal(publicacaoCandidataParaConfirmar({...vencedor,available_quantity:1.2}),false);
  assert.equal(publicacaoCandidataParaConfirmar({...vencedor,seller_id:222.5}),false);
  assert.equal(publicacaoCandidataParaConfirmar({...vencedor,currency_id:"USD"}),false);
  assert.equal(catalogoComCompraConfirmada(produtoId,vencedor,detalhe),true);
  assert.equal(selecionarPublicacaoVencedora(produtoId,[perdedor,vencedor],detalhe)?.seller_id,222);
  assert.equal(catalogoComCompraConfirmada(produtoId,vencedor,{
    ...detalhe,buy_box_winner:{...detalhe.buy_box_winner,seller_id:undefined}
  }),false,"Vendedor ausente nao comprova anuncio do link");
  assert.equal(catalogoComCompraConfirmada(produtoId,vencedor,{
    ...detalhe,buy_box_winner:{...detalhe.buy_box_winner,price:148.01}
  }),false,"Diferenca de 1 centavo bloqueia");
});

test("revalidacao antes do envio bloqueia troca de vendedor, preco e estoque",async()=>{
  const oferta:Oferta={
    plataforma:"Mercado Livre",produtoId,anuncioId:vencedor.item_id,
    vendedorId:222,estoqueDisponivel:5,disponibilidadeConfirmada:true,
    titulo:"Parafusadeira de impacto",precoAtual:148,
    urlProduto:"https://www.mercadolivre.com.br/p/"+produtoId,
    encontradoEm:new Date()
  };
  const get=(winner: typeof detalhe.buy_box_winner)=>async(_url:RequestInfo|URL,
      init?:RequestInit)=>{
    assert.equal(init?.method,"GET");
    return payload({...detalhe,buy_box_winner:winner});
  };
  const options={obterToken:async()=> "TOKEN_FICTICIO"};
  const valid=await revalidarDisponibilidadeMercadoLivre(oferta,{
    ...options,fetchImpl:get(detalhe.buy_box_winner) as typeof fetch
  });
  assert.equal(valid.estoqueDisponivel,5);
  for(const winner of [
    {...detalhe.buy_box_winner,price:140.60},
    {...detalhe.buy_box_winner,seller_id:111},
    {...detalhe.buy_box_winner,available_quantity:0},
    {...detalhe.buy_box_winner,currency_id:"USD"}
  ]) {
    await assert.rejects(
      revalidarDisponibilidadeMercadoLivre(oferta,{
        ...options,fetchImpl:get(winner) as typeof fetch
      }),
      /PRODUTO_INDISPONIVEL/,
      JSON.stringify(winner)
    );
  }
});
