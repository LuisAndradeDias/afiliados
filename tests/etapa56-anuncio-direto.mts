import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { auditarAnuncioDiretoMercadoLivre } from
  "../src/fontes/mercadolivre/auditoria-anuncio-direto.js";

const produtoId="MLB38053317";
const anuncioId="MLB3771505959";
const now=Date.now();
const item={
  id:anuncioId,catalog_product_id:produtoId,seller_id:123456,
  title:"Parafusadeira The Black Tools TB-21PW",
  status:"active",condition:"new",price:148.00,
  currency_id:"BRL",buying_mode:"buy_it_now",
  permalink:"https://produto.mercadolivre.com.br/MLB-3771505959-parafusadeira-_JM"
};
const price=(amount=148,override:Record<string,unknown>={})=>({
  amount,currency_id:"BRL",reference_date:new Date(now).toISOString(),...override
});
const res=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{"content-type":"application/json"}
});
const options=(fetchImpl:typeof fetch)=>({
  fetchImpl,agora:()=>now
});
type Mock=(url:URL|RequestInfo,init?:RequestInit)=>Promise<Response>;

test("GET anuncio proprio + preco contextual, estoque omitido nao prova compra",async()=>{
  const calls:string[]=[];
  const mock:Mock=async(url,init)=>{
    const target=String(url);
    calls.push(target);
    assert.equal(init?.method,"GET");
    assert.ok(init?.signal);
    assert.equal(new Headers(init?.headers).get("authorization"),"Bearer TOKEN_FICTICIO");
    if(target.endsWith("/sale_price?context=channel_marketplace"))return res(price());
    return res(item);
  };
  const got=await auditarAnuncioDiretoMercadoLivre(
    produtoId,anuncioId,"TOKEN_FICTICIO",options(mock as typeof fetch)
  );
  assert.deepEqual(calls,[
    "https://api.mercadolibre.com/items/"+anuncioId,
    "https://api.mercadolibre.com/items/"+anuncioId+
      "/sale_price?context=channel_marketplace"
  ]);
  assert.equal(got.situacao,"anuncio_vinculado_pendente");
  assert.equal(got.catalogoCorrespondente,true);
  assert.equal(got.anuncioAtivo,true);
  assert.equal(got.vendedorIdentificado,true);
  assert.equal(got.linkDiretoOficial,true);
  assert.equal(got.estoque,"nao_exposto");
  assert.equal(got.precoDoAnuncio,148);
  assert.equal(got.precoCanalMarketplace,148);
  assert.equal(got.precoCanalStatus,"coerente");
  assert.equal(got.vendedorVencedorConfirmado,false);
  assert.equal(got.envioPermitido,false);
  assert.equal(got.atribuicaoComprovada,false);
  assert.equal(got.cupomAplicavelConfirmado,false);
  assert.equal(got.modalidadePagamentoConfirmada,false);
  assert.doesNotMatch(JSON.stringify(got),/TOKEN_FICTICIO|123456|mercadolivre\.com\.br|Bearer/);
});

test("preco do item pode divergir do canal, sem autorizar modalidade Pix",async()=>{
  const mock:Mock=async(url)=>String(url).includes("sale_price")?
    res(price(140.60)):res(item);
  const got=await auditarAnuncioDiretoMercadoLivre(
    produtoId,anuncioId,"TESTE",options(mock as typeof fetch));
  assert.equal(got.precoDoAnuncio,148);
  assert.equal(got.precoCanalMarketplace,140.60);
  assert.equal(got.precoCanalStatus,"divergente");
  assert.equal(got.modalidadePagamentoConfirmada,false);
  assert.equal(got.envioPermitido,false);
});

test("catalogo diferente bloqueia consulta de preco contextual",async()=>{
  let queries=0;
  const mock:Mock=async()=>{queries++;return res({
    ...item,catalog_product_id:"MLB99999999"
  });};
  const got=await auditarAnuncioDiretoMercadoLivre(
    produtoId,anuncioId,"TESTE",options(mock as typeof fetch));
  assert.equal(queries,1);
  assert.equal(got.situacao,"anuncio_divergente");
  assert.equal(got.motivo,"ANUNCIO_CATALOGO_DIVERGENTE");
  assert.equal(got.envioPermitido,false);
});

test("vendedor, catalogo, permalink, condicao e valores insuficientes nao provam",async()=>{
  for (const [changes,expected] of [
    [{catalog_product_id:null},"ANUNCIO_DADOS_INSUFICIENTES"],
    [{seller_id:null},"ANUNCIO_DADOS_INSUFICIENTES"],
    [{condition:"used"},"ANUNCIO_DADOS_INSUFICIENTES"],
    [{permalink:undefined},"ANUNCIO_DADOS_INSUFICIENTES"],
    [{permalink:"https://evil.tld/MLB-3771505959-foobar"},"ANUNCIO_LINK_NAO_OFICIAL"],
    [{permalink:"http://produto.mercadolivre.com.br/MLB-3771505959-foo"},"ANUNCIO_LINK_NAO_OFICIAL"],
    [{price:148.005},"ANUNCIO_PRECO_INVALIDO"],
    [{price:0},"ANUNCIO_PRECO_INVALIDO"],
    [{currency_id:"USD"},"ANUNCIO_MOEDA_INVALIDA"],
    [{status:"paused"},"ANUNCIO_STATUS_INATIVO"],
    [{available_quantity:0},"ANUNCIO_DADOS_INSUFICIENTES"],
    [{available_quantity:-2},"ANUNCIO_DADOS_INSUFICIENTES"]
  ] as const) {
    let calls=0;
    const mock:Mock=async()=>{calls++;return res({...item,...changes});};
    const got=await auditarAnuncioDiretoMercadoLivre(
      produtoId,anuncioId,"TESTE",options(mock as typeof fetch)
    );
    assert.equal(calls,1,JSON.stringify(changes));
    assert.equal(got.motivo,expected,JSON.stringify(changes));
    assert.equal(got.envioPermitido,false);
    assert.equal(got.precoCanalStatus,"nao_consultado");
  }
});

test("permalink oficial de outro anuncio nao valida identidade nem consulta preco",async()=>{
  for(const permalink of [
    "https://produto.mercadolivre.com.br/MLB-9999999999-anuncio-diferente-_JM",
    "https://produto.mercadolivre.com.br:8443/MLB-3771505959-parafusadeira-_JM",
    "https://produto.mercadolivre.com.br/checkout/MLB-3771505959-parafusadeira"
  ]){
    let requests=0;
    const mock:Mock=async()=>{
      requests++;
      return res({...item,permalink});
    };
    const got=await auditarAnuncioDiretoMercadoLivre(
      produtoId,anuncioId,"TOKEN_FICTICIO",options(mock as typeof fetch)
    );
    assert.equal(requests,1,"Nao consultar preco antes de validar o permalink: "+permalink);
    assert.equal(got.situacao,"anuncio_divergente",permalink);
    assert.equal(got.motivo,"ANUNCIO_LINK_NAO_OFICIAL",permalink);
    assert.equal(got.linkDiretoOficial,false,permalink);
    assert.equal(got.atribuicaoComprovada,false);
    assert.equal(got.envioPermitido,false);
  }
});

test("estoque declarado positivo so e observado e nao equivale a buybox",async()=>{
  const got=await auditarAnuncioDiretoMercadoLivre(
    produtoId,anuncioId,"TESTE",{
      ...options((async()=>res({...item,available_quantity:8})) as typeof fetch),
      consultarPrecoContextual:false
    });
  assert.equal(got.estoque,"declarado_positivo");
  assert.equal(got.situacao,"anuncio_vinculado_pendente");
  assert.equal(got.vendedorVencedorConfirmado,false);
  assert.equal(got.envioPermitido,false);
  assert.equal(got.precoCanalStatus,"nao_consultado");
});

test("erros 403/401/404/429/500, resposta invalida e timeout nao repetem",async()=>{
  for(const [code,reason] of [
    [401,"ANUNCIO_PERMISSAO_NEGADA"],
    [403,"ANUNCIO_PERMISSAO_NEGADA"],
    [404,"ANUNCIO_NAO_ENCONTRADO"],
    [429,"ANUNCIO_LIMITE_429"],
    [500,"ANUNCIO_HTTP_INDISPONIVEL"]
  ] as const) {
    let count=0;
    const mock:Mock=async()=>{count++;return res({token:"NEVER_PRINT"},code);};
    const r=await auditarAnuncioDiretoMercadoLivre(produtoId,anuncioId,"TESTE",
      options(mock as typeof fetch));
    assert.equal(count,1);
    assert.equal(r.motivo,reason);
    assert.equal(r.envioPermitido,false);
    assert.doesNotMatch(JSON.stringify(r),/NEVER_PRINT/);
  }
  const bad=await auditarAnuncioDiretoMercadoLivre(produtoId,anuncioId,"TESTE",
    options((async()=>new Response("INVALID_JSON",{status:200})) as typeof fetch));
  assert.equal(bad.motivo,"ANUNCIO_RESPOSTA_INVALIDA");
  const fail=await auditarAnuncioDiretoMercadoLivre(produtoId,anuncioId,"TESTE",
    options((async()=>{throw new Error("Bearer private-credential");}) as typeof fetch));
  assert.equal(fail.motivo,"ANUNCIO_REDE_INDISPONIVEL");
  assert.doesNotMatch(JSON.stringify(fail),/private-credential|Bearer/);
});

test("preco contextual incompleto, antigo, USD ou 429 bloqueiam",async()=>{
  const payloads:[
    unknown,string
  ][]=[
    [price(140.605),"PRECO_REFERENCIA_INVALIDA"],
    [price(148,{currency_id:"USD"}),"PRECO_MOEDA_NAO_CONFIRMADA"],
    [price(148,{reference_date:new Date(now-60*60_000).toISOString()}),"PRECO_REFERENCIA_INVALIDA"],
    [price(148,{reference_date:"bad date"}),"PRECO_REFERENCIA_INVALIDA"],
    [{amount:null,reference_date:new Date(now).toISOString(),currency_id:"BRL"},"PRECO_REFERENCIA_INVALIDA"]
  ];
  for(const [data,reason] of payloads){
    let calls=0;
    const mock:Mock=async(url)=>{
      calls++;
      return String(url).includes("sale_price")?res(data):res(item);
    };
    const r=await auditarAnuncioDiretoMercadoLivre(
      produtoId,anuncioId,"TESTE",options(mock as typeof fetch));
    assert.equal(calls,2);
    assert.equal(r.precoCanalStatus,"inconclusivo");
    assert.equal(r.precoCanalMotivo,reason);
    assert.equal(r.envioPermitido,false);
  }
  for(const code of [401,403,429,500]){
    let count=0;
    const r=await auditarAnuncioDiretoMercadoLivre(
      produtoId,anuncioId,"TESTE",options((async(url)=>{
        count++;return String(url).includes("sale_price")?
          res({},code):res(item);
      }) as typeof fetch));
    assert.equal(count,2);
    assert.equal(r.precoCanalStatus,"inconclusivo");
    assert.equal(r.envioPermitido,false);
  }
});

test("IDs invalidos impedem token e rede; JSON de ID divergente rejeitado",async()=>{
  const forbid:Mock=async()=>{throw new Error("NETWORK_MUST_NOT_BE_CALLED");};
  for(const a of ["MLB999","https://evil","MLB000\nfoo","MLA22222222"]){
    const r=await auditarAnuncioDiretoMercadoLivre(
      produtoId,a,"TESTE",options(forbid as typeof fetch));
    assert.equal(r.motivo,"ANUNCIO_DADOS_INSUFICIENTES");
  }
  const noAuth=await auditarAnuncioDiretoMercadoLivre(
    produtoId,anuncioId,"",options(forbid as typeof fetch));
  assert.equal(noAuth.motivo,"ANUNCIO_DADOS_INSUFICIENTES");
  const wrong=await auditarAnuncioDiretoMercadoLivre(
    produtoId,anuncioId,"TESTE",
    options((async()=>res({...item,id:"MLB99999999"})) as typeof fetch));
  assert.equal(wrong.motivo,"ANUNCIO_RESPOSTA_INVALIDA");
});

test("CLI do diagnostico usa somente preflight e caminhos autorizados",async()=>{
  const cli=await readFile("src/robo/mercadolivre-preco-diagnostico.ts","utf8");
  assert.match(cli,/const anuncioSolicitado = process\.argv\[3\]/);
  assert.match(cli,/await auditarAnuncioDiretoMercadoLivre\(/);
  assert.match(cli,/ANUNCIO_SOLICITADO_NAO_EH_VENCEDOR_OFICIAL/);
  assert.match(cli,/investigacaoAnuncioDireto,/);
  assert.match(cli,/estado\.operacaoEstado !== "paused"/);
  assert.match(cli,/CENTRAL_INACESSIVEL/);
  assert.doesNotMatch(cli,/enviarWhatsApp\(|checkout\(|publicarOferta\(/);
});
