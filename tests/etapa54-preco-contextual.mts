import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { Oferta } from "../src/fontes/types.js";
import {
  auditarPrecoContextualMercadoLivre,
  revalidarEstoqueEPrecoMercadoLivre
} from "../src/fontes/mercadolivre/preco-contextual.js";
import { formatarOfertaWhatsapp } from "../src/mensagens/whatsapp.js";

const now = Date.now();
const produtoId = "MLB38053317";
const anuncioId = "MLB3771505959";
const oferta: Oferta = {
  plataforma: "Mercado Livre",
  produtoId, anuncioId,
  vendedorId: 4488,
  estoqueDisponivel: 3,
  disponibilidadeConfirmada: true,
  disponibilidadeVerificadaEm: new Date(now).toISOString(),
  titulo: "Parafusadeira The Black Tools",
  precoAtual: 148,
  precoAnterior: 299.90,
  descontoPercentual: 50,
  urlProduto: "https://www.mercadolivre.com.br/p/" + produtoId,
  encontradoEm: new Date(now)
};
const price = (amount = 148, extra: Record<string, unknown> = {}) => ({
  price_id: "teste",
  amount,
  regular_amount: 299.90,
  currency_id: "BRL",
  reference_date: new Date(now).toISOString(),
  ...extra
});
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body),{
    status, headers: {"content-type":"application/json"}
  });
}
const opts = (fetchImpl: typeof fetch) => ({
  obterToken: async () => "token-sintetico",
  fetchImpl,
  agora: () => now
});
type AuditoriaMock = (url: URL | RequestInfo, options?: RequestInit) => Promise<Response>;

test("GET oficial de preco em contexto marketplace usa o item e nunca assume Pix", async()=>{
  const chamadas: Array<{url:string;method?:string;accept?:string}> = [];
  const mock:AuditoriaMock = async (url,options)=>{
    chamadas.push({
      url:String(url), method: options?.method,
      accept:new Headers(options?.headers).get("accept") ?? ""
    });
    assert.ok(options?.signal);
    return response(price());
  };
  const audit = await auditarPrecoContextualMercadoLivre(oferta,
    opts(mock as typeof fetch));
  assert.equal(audit.situacao,"coerente");
  assert.equal(audit.motivo,"PRECO_CANAL_CORRESPONDENTE");
  assert.equal(audit.precoDaOferta,148);
  assert.equal(audit.precoDoCanal,148);
  assert.equal(audit.modalidadePagamentoConfirmada,false);
  assert.equal(audit.cupomAplicavelConfirmado,false);
  assert.equal(audit.atribuicaoComprovada,false);
  assert.deepEqual(chamadas,[{
    url:"https://api.mercadolibre.com/items/"+anuncioId+
      "/sale_price?context=channel_marketplace",
    method:"GET",accept:"application/json"
  }]);
  assert.doesNotMatch(JSON.stringify(audit),/token-sintetico|Bearer|cookie|sec\//);
  const preview = formatarOfertaWhatsapp(oferta);
  assert.match(preview,/Preço informado no catálogo/);
  assert.match(preview,/Pix, cartão ou benefícios/);
  assert.doesNotMatch(preview,/no Pix|4x R\$|140,60/);
});

test("diferenca de um centavo bloqueia, sem trocar valor da oferta automaticamente",async()=>{
  let chamadas=0;
  const mock:AuditoriaMock=async()=>{chamadas++; return response(price(148.01));};
  const audit=await auditarPrecoContextualMercadoLivre(oferta,
    opts(mock as typeof fetch));
  assert.equal(chamadas,1);
  assert.equal(audit.situacao,"divergente");
  assert.equal(audit.motivo,"PRECO_CANAL_DIVERGENTE");
  assert.equal(audit.precoDaOferta,148);
  assert.equal(audit.precoDoCanal,148.01);
  assert.equal(oferta.precoAtual,148,"Nunca corrigir silenciosamente valores antigos");
});

test("dados incompletos, moedas, centavos e referencias antigas nao homologam",async()=>{
  const cases=[
    [price(148.005),"PRECO_RESPOSTA_INCOMPLETA"],
    [price(0),"PRECO_RESPOSTA_INCOMPLETA"],
    [price(148,{currency_id:"USD"}),"PRECO_MOEDA_NAO_BRL"],
    [price(148,{currency_id:undefined}),"PRECO_MOEDA_NAO_BRL"],
    [price(148,{reference_date:"INVALIDA"}),"PRECO_REFERENCIA_DESATUALIZADA"],
    [price(148,{reference_date:new Date(now-11*60_000).toISOString()}),"PRECO_REFERENCIA_DESATUALIZADA"],
    [price(148,{reference_date:new Date(now+2*60_000).toISOString()}),"PRECO_REFERENCIA_DESATUALIZADA"],
    [price("148" as unknown as number),"PRECO_RESPOSTA_INCOMPLETA"]
  ] as const;
  for(const [payload,motivo] of cases) {
    const audit=await auditarPrecoContextualMercadoLivre(
      oferta, opts((async()=>response(payload)) as typeof fetch)
    );
    assert.equal(audit.situacao,"inconclusivo",JSON.stringify(payload));
    assert.equal(audit.motivo,motivo,JSON.stringify(payload));
    assert.equal(audit.modalidadePagamentoConfirmada,false);
  }
});

test("401, 403, 429, HTTP 500 e falha de rede nunca viram preco confirmado",async()=>{
  for(const [status,motivo] of [
    [401,"PRECO_API_SEM_PERMISSAO"],
    [403,"PRECO_API_SEM_PERMISSAO"],
    [429,"PRECO_API_LIMITE_429"],
    [500,"PRECO_API_INDISPONIVEL"]
  ] as const){
    let chamadas=0;
    const fake:AuditoriaMock=async()=>{
      chamadas++;
      return response({error:"ocultado"},status);
    };
    const result=await auditarPrecoContextualMercadoLivre(oferta,
      opts(fake as typeof fetch));
    assert.equal(result.motivo,motivo);
    assert.equal(result.situacao,"inconclusivo");
    assert.equal(chamadas,1,"Nunca retry automatico no endpoint de preco");
  }
  const fail=await auditarPrecoContextualMercadoLivre(oferta,
    opts((async()=>{throw new Error("Bearer TOKEN-NAO-EXIBIR");}) as typeof fetch));
  assert.equal(fail.motivo,"PRECO_ERRO_REDE");
  assert.doesNotMatch(JSON.stringify(fail),/TOKEN-NAO-EXIBIR|Bearer/);
});

test("oferta invalida bloqueia antes de token ou rede",async()=>{
  const invalidos=[
    {...oferta,precoAtual:148.005},
    {...oferta,precoAtual:0},
    {...oferta,produtoId:"MLBOUTRO"},
    {...oferta,anuncioId:"https://example.org"},
    {...oferta,vendedorId:undefined},
    {...oferta,estoqueDisponivel:0},
    {...oferta,disponibilidadeConfirmada:false},
    {...oferta,plataforma:"Amazon Brasil"}
  ];
  for(const item of invalidos){
    const audit=await auditarPrecoContextualMercadoLivre(item,{
      ...opts((async()=>{throw new Error("REDE_NAO_DEVE_SER_CHAMADA")}) as typeof fetch),
      obterToken:async()=>{throw new Error("TOKEN_NAO_DEVE_SER_BUSCADO");}
    });
    assert.equal(audit.situacao,"inconclusivo");
    assert.equal(audit.motivo,"PRECO_OFERTA_INVALIDA");
  }
});

test("guarda de envio confirma catalogo, seller e preco com exatamente dois GET",async()=>{
  const chamadas: string[]=[];
  const fake:AuditoriaMock=async(url,options)=>{
    const path=new URL(String(url)).pathname;
    assert.equal(options?.method,"GET");
    chamadas.push(path);
    if(path==="/products/"+produtoId) return response({
      id:produtoId,status:"active",
      buy_box_winner:{
        item_id:anuncioId,seller_id:4488,price:148,
        available_quantity:3,currency_id:"BRL",condition:"new"
      }
    });
    if(path==="/items/"+anuncioId+"/sale_price") return response(price());
    throw new Error("URL_INESPERADA");
  };
  const result=await revalidarEstoqueEPrecoMercadoLivre(
    oferta,opts(fake as typeof fetch));
  assert.equal(result.estoqueDisponivel,3);
  assert.match(result.verificadoEm,/^\d{4}-/);
  assert.equal(result.precoMercadoLivreConfirmadoEm,new Date(now).toISOString());
  assert.deepEqual(chamadas,[
    "/products/"+produtoId,
    "/items/"+anuncioId+"/sale_price"
  ]);
});

test("guarda de envio falha fechada em 1 centavo ou estoque / vendedor errado",async()=>{
  let chamadas: string[]=[];
  const fake:AuditoriaMock=async(url)=>{
    const path=new URL(String(url)).pathname;
    chamadas.push(path);
    return path.startsWith("/products/")
      ? response({id:produtoId,status:"active",
          buy_box_winner:{item_id:anuncioId,seller_id:4488,
            price:148,available_quantity:3}})
      : response(price(147.99));
  };
  await assert.rejects(
    revalidarEstoqueEPrecoMercadoLivre(oferta,opts(fake as typeof fetch)),
    /PRECO_CONTEXTUAL_NAO_CONFIRMADO: PRECO_CANAL_DIVERGENTE/
  );
  assert.deepEqual(chamadas,[
    "/products/"+produtoId,"/items/"+anuncioId+"/sale_price"
  ]);
  chamadas=[];
  const stockFail:AuditoriaMock=async(url)=>{
    const path=new URL(String(url)).pathname;
    chamadas.push(path);
    if(!path.startsWith("/products/")) throw new Error("PRECO_NAO_DEVE_SER_CONSULTADO");
    return response({
      id:produtoId,status:"active",
      buy_box_winner:{
        item_id:anuncioId,seller_id:4499,price:148,available_quantity:3
      }
    });
  };
  await assert.rejects(
    revalidarEstoqueEPrecoMercadoLivre(oferta,opts(stockFail as typeof fetch)),
    /PRODUTO_INDISPONIVEL/
  );
  assert.deepEqual(chamadas,["/products/"+produtoId]);
});

test("guarda de envio bloqueia API de preco 429 sem retry ou cupom",async()=>{
  let prices=0;
  const mock:AuditoriaMock=async(url)=>{
    const path=new URL(String(url)).pathname;
    if(path.startsWith("/products/")) return response({
      id:produtoId,status:"active",
      buy_box_winner:{item_id:anuncioId,seller_id:4488,price:148,
        available_quantity:2}
    });
    prices++;
    return response({error:"TOO_MANY_REQUESTS"},429);
  };
  await assert.rejects(
    revalidarEstoqueEPrecoMercadoLivre(oferta,opts(mock as typeof fetch)),
    /PRECO_CONTEXTUAL_NAO_CONFIRMADO: PRECO_API_LIMITE_429/
  );
  assert.equal(prices,1);
});

test("guarda de preco conecta todas as etapas de preparacao e clique",async()=>{
  const server=await readFile("src/painel/server.ts","utf8");
  const preview=await readFile("src/robo/mercadolivre-whatsapp.ts","utf8");
  const preparar=await readFile("src/robo/whatsapp-preparar.ts","utf8");
  const pos=server.indexOf("async function criarPedidoLinkMercadoLivre");
  const trecho=server.slice(pos,pos+1200);
  assert.match(trecho,/await revalidarDisponibilidadeMercadoLivre\(oferta\)/);
  assert.doesNotMatch(trecho,/revalidarEstoqueEPrecoMercadoLivre/);
  assert.match(preview,/await revalidarEstoqueEPrecoMercadoLivre\(oferta\)/);
  const usos=preparar.match(/await revalidarEstoqueEPrecoMercadoLivre\(/g) ?? [];
  assert.equal(usos.length,2,"Proteger inicio e instante do clique real");
  assert.match(preparar,/if \(!modoTeste && pacote.plataforma === "Mercado Livre"\)/);
  assert.match(preparar,/if \(enviarPorPainel \|\| enviarAutomaticamente\)/);
});

test("catalogo ativo sem buy box nunca habilita auditoria de preco nem envio",async()=>{
  let chamadasCatalogo=0;
  let chamadasPreco=0;
  const fake:AuditoriaMock=async(url)=>{
    const path=new URL(String(url)).pathname;
    if(path.startsWith("/products/")){
      chamadasCatalogo++;
      return response({id:produtoId,status:"active",buy_box_winner:null});
    }
    chamadasPreco++;
    throw new Error("NAO_PODE_CONSULTAR_PRECO_SEM_VENCEDOR");
  };
  await assert.rejects(
    revalidarEstoqueEPrecoMercadoLivre(oferta,opts(fake as typeof fetch)),
    /PRODUTO_INDISPONIVEL/
  );
  assert.equal(chamadasCatalogo,1);
  assert.equal(chamadasPreco,0);
});
test("diagnostico de catalogo registra falta de vencedor sem dados pessoais",async()=>{
  const codigo=await readFile("src/robo/mercadolivre-preco-diagnostico.ts","utf8");
  assert.match(codigo,/CATALOGO_ATIVO_SEM_VENCEDOR_OFICIAL/);
  assert.match(codigo,/criteriosCatalogo/);
  assert.match(codigo,/if \(!vencedor\) \{/);
  assert.match(codigo,/seller_id:vencedor\?\.seller_id/);
  assert.match(codigo,/modalidadePagamentoConfirmada:false/);
  assert.doesNotMatch(codigo,/console\.log\(token\)|console\.log\(vencedor\)/);
});
