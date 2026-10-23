import assert from "node:assert/strict";
import { consultasMercadoLivre, CONSULTAS_PADRAO_MERCADOLIVRE } from "../src/fontes/mercadolivre/busca-config.js";
import { descontoMinimoOferta, avaliarQualidadeOferta } from "../src/ofertas/qualidade.js";
import { planejarBuscasMercadoLivre } from "../src/ofertas/diversidade.js";
import { MercadoLivreApiFonte } from "../src/fontes/mercadolivre/api.js";

const padrao = consultasMercadoLivre({} as NodeJS.ProcessEnv);
assert.equal(padrao.length, CONSULTAS_PADRAO_MERCADOLIVRE.length);
assert.ok(padrao.length >= 20, "Sem .env, n�o pode buscar apenas smartphone.");
assert.ok(padrao.includes("smartphone samsung") && padrao.includes("air fryer") && padrao.includes("fone bluetooth"));
assert.deepEqual(consultasMercadoLivre({MERCADOLIVRE_QUERIES:" notebook ,fone bluetooth,notebook "} as NodeJS.ProcessEnv),["notebook","fone bluetooth"]);
assert.deepEqual(consultasMercadoLivre({MERCADOLIVRE_QUERY:"ssd"} as NodeJS.ProcessEnv),["ssd"]);
const primeiras = planejarBuscasMercadoLivre(padrao,0,3,[],true);
const outras = planejarBuscasMercadoLivre(padrao,4,3,[],true);
assert.equal(primeiras.consultas.length,4);
assert.equal(outras.consultas[0],padrao[4]);
assert.equal(descontoMinimoOferta({} as NodeJS.ProcessEnv),20);
assert.equal(descontoMinimoOferta({MIN_DISCOUNT_PERCENT:"25"} as NodeJS.ProcessEnv),25);
const exemplo = {
  plataforma:"Mercado Livre", produtoId:"MLB-TEST-QUALITY", titulo:"Smartphone Samsung",
  precoAtual:800,precoAnterior:1000,descontoPercentual:20,imagem:undefined,
  urlProduto:"https://www.mercadolivre.com.br/p/MLBTESTQUALITY",encontradoEm:new Date(),
};
assert.equal(avaliarQualidadeOferta(exemplo,{} as NodeJS.ProcessEnv).elegivel,true);
assert.equal(avaliarQualidadeOferta({...exemplo,precoAnterior:900,descontoPercentual:11},{} as NodeJS.ProcessEnv).elegivel,false);
assert.equal(avaliarQualidadeOferta({
  ...exemplo, precoAtual:900, precoAnterior:1000,
  descontoPercentual:10, descontoEfetivoPercentual:27,
  precoComCupomEstimado:730, cupomValidacao:"catalogo-oficial-estimado",
},{} as NodeJS.ProcessEnv).elegivel,false,
  "Cupom nao confirmado nao pode gerar desconto artificial.");

const antigo = process.env.MERCADOLIVRE_MAX_OFFERS_PER_QUERY;
const pags = process.env.MERCADOLIVRE_SEARCH_PAGES_PER_QUERY;
const intervalo = process.env.MERCADOLIVRE_REQUEST_INTERVAL_MS;
const fetchReal = globalThis.fetch;
process.env.MERCADOLIVRE_MAX_OFFERS_PER_QUERY = "1";
process.env.MERCADOLIVRE_SEARCH_PAGES_PER_QUERY = "1";
process.env.MERCADOLIVRE_REQUEST_INTERVAL_MS = "250";
let requests = 0;
globalThis.fetch = async (url,options) => {
  requests++;
  const dest=String(url);
  if(dest.includes("/products/search")){
    return new Response(JSON.stringify({results:[
      {id:"MLBTESTLOW",name:"Smartphone Galaxy basic",status:"active"},
      {id:"MLBTESTGOOD",name:"Smartphone Galaxy bom",status:"active"},
      {id:"MLBTESTBAD",name:"Smartphone Galaxy restante",status:"active"},
    ],paging:{total:3}}),{status:200});
  }
  if(dest.includes("/products/MLBTESTLOW/items") || dest.includes("/products/MLBTESTGOOD/items")){
    const good=dest.includes("MLBTESTGOOD");
    return new Response(JSON.stringify({results:[{
      item_id:good?"MLB1234567":"MLB9876543",seller_id:55,
      price:good?800:950,original_price:1000,condition:"new",
      available_quantity:8,
    }]}),{status:200});
  }
  if(dest.includes("/users/bulk?ids=")){
    return new Response(JSON.stringify([{
      status_code:200,body:{id:55,seller_reputation:{level_id:"5_green"}},
    }]),{status:200});
  }
  throw new Error("Rede inesperada no teste: "+new URL(dest).pathname);
};
try{
  const ofertas=await new MercadoLivreApiFonte("smartphone",10,"mock-token").buscar();
  assert.equal(ofertas.length,2,"O primeiro an�ncio abaixo de 20% n�o deve encerrar a busca.");
  assert.ok(ofertas.some(o=>o.descontoPercentual===20));
  assert.ok(requests >=4);
}finally{
  globalThis.fetch=fetchReal;
  if(antigo===undefined)delete process.env.MERCADOLIVRE_MAX_OFFERS_PER_QUERY;
  else process.env.MERCADOLIVRE_MAX_OFFERS_PER_QUERY=antigo;
  if(pags===undefined)delete process.env.MERCADOLIVRE_SEARCH_PAGES_PER_QUERY;
  else process.env.MERCADOLIVRE_SEARCH_PAGES_PER_QUERY=pags;
  if(intervalo===undefined)delete process.env.MERCADOLIVRE_REQUEST_INTERVAL_MS;
  else process.env.MERCADOLIVRE_REQUEST_INTERVAL_MS=intervalo;
}
console.log("mercadolivre-descoberta: consultas m�ltiplas, corte real de 20%, e busca sem truncamento precoce OK");
