/**
 * Mercado Livre — busca profunda e anúncio específico.
 * Somente respostas sintéticas. NUNCA acessar API real, tokens ou portal.
 */
import assert from "node:assert/strict";
import { MercadoLivreApiFonte } from "../src/fontes/mercadolivre/api.js";
import {
  ordenarPublicacoes, publicacaoComEstoque, validarPermalinkOficial,
  limiteInteiro
} from "../src/fontes/mercadolivre/selecao.js";

const antigoFetch=globalThis.fetch;
const envNomes=[
  "MERCADOLIVRE_REQUEST_INTERVAL_MS",
  "MERCADOLIVRE_MAX_OFFERS_PER_QUERY",
  "MERCADOLIVRE_SEARCH_PAGES_PER_QUERY",
  "MERCADOLIVRE_PRODUCTS_CHECKED_PER_QUERY",
  "MERCADOLIVRE_DEBUG_SELLERS"
];
const antigoEnv=Object.fromEntries(envNomes.map(nome=>[nome,process.env[nome]]));
const resposta=(data:unknown,status=200)=>new Response(JSON.stringify(data),{
  status, headers:{"content-type":"application/json"}
});
const low=Array.from({length:5},(_,i)=>"MLB"+(110+i));
const winner="MLB999", stockZero="MLB998", stale="MLB997";
const itemId=(pid:string)=>"MLB"+pid.slice(3)+"00";
let fetchCalls:string[]=[];
let stockItemCalls=0;
function mockedFetch(input:string|URL|Request){
  const u=new URL(String(input));
  assert.equal(u.origin,"https://api.mercadolibre.com",
    "Testes não permitem chamada fora do stub!");
  fetchCalls.push(u.pathname+u.search);
  if(u.pathname==="/products/search"){
    assert.equal(u.searchParams.get("site_id"),"MLB");
    assert.equal(u.searchParams.get("status"),"active");
    if(u.searchParams.get("offset")==="0"){
      return Promise.resolve(resposta({results:low.map(id=>({
        id,name:"Produto "+id,status:"active",pictures:[{secure_url:"https://img.example/1.jpg"}]
      })),paging:{total:8}}));
    }
    if(u.searchParams.get("offset")==="5"){
      return Promise.resolve(resposta({results:[winner,stockZero,stale].map(id=>({
        id,name:"Produto "+id,status:"active",pictures:[]
      })),paging:{total:8}}));
    }
    throw new Error("Pagina nao esperada "+u.search);
  }
  const produto=u.pathname.match(/^\/products\/(MLB\d+)\/items$/);
  if(produto){
    const id=produto[1];
    const preco=id===winner?90:100;
    return Promise.resolve(resposta({results:[{
      item_id:itemId(id),seller_id:321,price:preco,
      original_price:id===winner?200:110,condition:"new",
      available_quantity:id===stockZero?0:3
    }]}));
  }
  if(u.pathname==="/users/bulk"){
    assert.equal(u.searchParams.get("ids"),"321");
    return Promise.resolve(resposta([{
      status_code:200,body:{id:321,seller_reputation:{level_id:"5_green"}}
    }]));
  }
  const anuncio=u.pathname.match(/^\/items\/(MLB\d+)$/);
  if(anuncio){
    const id=anuncio[1];
    if(id===itemId(stockZero))stockItemCalls++;
    if(id===itemId(stale))return Promise.resolve(resposta({
      id,status:"paused",seller_id:321,condition:"new",
      price:100,available_quantity:3,
      permalink:"https://produto.mercadolivre.com.br/MLB-"+id.slice(3)+"-fake-_JM"
    }));
    return Promise.resolve(resposta({
      id,status:"active",seller_id:321,condition:"new",
      price:id===itemId(winner)?90:100,available_quantity:3,
      original_price:id===itemId(winner)?200:110,
      permalink:"https://produto.mercadolivre.com.br/MLB-"+id.slice(3)+"-produto-_JM"
    }));
  }
  throw new Error("Endpoint não simulado: "+u.pathname);
}

try{
  process.env.MERCADOLIVRE_REQUEST_INTERVAL_MS="0"; // mínimo real 250ms
  process.env.MERCADOLIVRE_MAX_OFFERS_PER_QUERY="5";
  process.env.MERCADOLIVRE_SEARCH_PAGES_PER_QUERY="2";
  process.env.MERCADOLIVRE_PRODUCTS_CHECKED_PER_QUERY="25";
  assert.ok(!publicacaoComEstoque({
    item_id:"MLB100",seller_id:42,price:100,condition:"new",available_quantity:0
  }));
  assert.ok(!publicacaoComEstoque({
    item_id:"MLB100",seller_id:42,price:100,condition:"new",available_quantity:null
  }));
  assert.ok(!publicacaoComEstoque({
    item_id:"MLB100",seller_id:0,price:100,condition:"new",available_quantity:2
  }));
  const ranked=ordenarPublicacoes([
    {item_id:"MLB11",seller_id:1,price:90,original_price:200,condition:"new",available_quantity:2},
    {item_id:"MLB12",seller_id:1,price:100,original_price:110,condition:"new",available_quantity:2},
    {item_id:"MLB13",seller_id:1,price:90,original_price:200,condition:"used",available_quantity:2}
  ]);
  assert.deepEqual(ranked.map(r=>r.item_id),["MLB11","MLB12"]);
  assert.equal(validarPermalinkOficial(
    "https://produto.mercadolivre.com.br/MLB-12345-abc-_JM#bad","MLB12345"
  ),"https://produto.mercadolivre.com.br/MLB-12345-abc-_JM");
  assert.equal(validarPermalinkOficial(
    "https://evil.example/MLB-12345-abc-_JM","MLB12345"
  ),null);
  assert.equal(validarPermalinkOficial(
    "https://www.mercadolivre.com.br/p/MLB12345","MLB12345"
  ),null,"Página de catálogo não substitui permalink de anúncio");
  assert.equal(limiteInteiro("NaN",25,5,60),25);
  assert.equal(limiteInteiro("999",25,5,60),60);

  globalThis.fetch=mockedFetch as typeof fetch;
  const ofertas=await new MercadoLivreApiFonte("cadeira escritorio",5,"token-falso").buscar();
  assert.equal(ofertas.length,5,"Deve retornar o top-5 real após avaliar a segunda página");
  assert.equal(ofertas[0].produtoId,winner,
    "Oferta com 55% da página 2 foi ignorada pelo antigo retorno antecipado");
  assert.equal(ofertas[0].descontoPercentual,55);
  assert.equal(ofertas[0].urlProduto,
    "https://produto.mercadolivre.com.br/MLB-99900-produto-_JM",
    "Usar permalink do ANÚNCIO validado, não URL /p/ do catálogo");
  assert.ok(ofertas.every(o=>o.urlProduto.includes("/MLB-")),
    "Nunca distribuir URL de catálogo genérica como link da oferta");
  assert.equal(stockItemCalls,0,"Não consultar detalhe de anúncio sem estoque");
  assert.ok(!ofertas.some(o=>o.produtoId===stale),"Anúncio pausado não é elegível");
  assert.ok(!ofertas.some(o=>o.produtoId===stockZero),"Sem estoque não é elegível");
  assert.ok(fetchCalls.some(c=>c.startsWith("/products/search")&&c.includes("offset=5")),
    "Deve consultar segunda página mesmo após cinco achados iniciais");
  assert.ok(fetchCalls.every(c=>!c.includes("access_token=")),
    "Token não deve ser embutido na URL");

  // Falha 429 precisa encerrar a busca, não ser tratada como "sem oferta".
  globalThis.fetch=(async (input:string|URL|Request)=>{
    assert.ok(String(input).includes("api.mercadolibre.com"));
    return new Response(JSON.stringify({error:"rate_limited"}),{
      status:429,headers:{"retry-after":"0.001"}
    });
  }) as typeof fetch;
  await assert.rejects(
    new MercadoLivreApiFonte("teste",5,"token-falso").buscar(),
    /HTTP 429/,"API limitada deve acionar backoff no servidor"
  );
  console.log("MELI_BUSCA_QUALIDADE_OK: paginação completa, top 5, estoque/reputação/estado, permalink anúncio, 429 e sem rede real.");
}finally{
  globalThis.fetch=antigoFetch;
  for(const [nome,valor]of Object.entries(antigoEnv)){
    if(valor===undefined)delete process.env[nome];
    else process.env[nome]=valor;
  }
}
