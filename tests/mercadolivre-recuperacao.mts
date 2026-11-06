/** MELI-07: testes isolados; nenhuma rede real, arquivo privado ou envio. */
import assert from "node:assert/strict";
import { MercadoLivreApiFonte } from "../src/fontes/mercadolivre/api.js";
import { lerRetryAfterMs } from "../src/fontes/mercadolivre/erros.js";

const oldFetch = globalThis.fetch;
const names = ["MERCADOLIVRE_REQUEST_INTERVAL_MS", "MERCADOLIVRE_SEARCH_PAGES_PER_QUERY", "MERCADOLIVRE_PRODUCTS_CHECKED_PER_QUERY", "MERCADOLIVRE_MAX_OFFERS_PER_QUERY"];
const oldEnv = Object.fromEntries(names.map(n => [n, process.env[n]]));
const response = (body: unknown, status = 200, headers: Record<string,string> = {}) =>
  new Response(JSON.stringify(body), {status, headers:{"content-type":"application/json", ...headers}});
const item = (n: number) => ({item_id:"MLB100" + n, seller_id:300+n,
  price:50+n, original_price:200, condition:"new"});
const detail = (n: number) => ({id:item(n).item_id, seller_id:item(n).seller_id,
  price:50+n, original_price:200, condition:"new", status:"active",
  title:"Produto sintetico", permalink:"https://produto.mercadolivre.com.br/MLB-100"+n+"-teste-_JM"});
let failures = 0;
async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); console.log("PASS " + name); }
  catch (error) { failures++; console.error("FAIL " + name + ": " + (error instanceof Error ? error.message : String(error))); }
}
function stub(
  onDetail: (n: number) => Response,
  options: {catalogStatus?:number; sellerStatus?:number; count?:number; innerStatus?:number} = {}
) {
  const details:number[]=[];
  globalThis.fetch=(async(input, init) => {
    const u=new URL(String(input));
    assert.equal(u.origin,"https://api.mercadolibre.com","Rede externa bloqueada pelo teste");
    assert.equal(init?.method ?? "GET","GET");
    if(u.pathname==="/products/search") return response({results:[{
      id:"MLB100",name:"Produto sintetico",status:"active",pictures:[]
    }],paging:{total:1}});
    if(u.pathname==="/products/MLB100/items") return options.catalogStatus
      ? response({error:"access_denied"},options.catalogStatus)
      : response({results:Array.from({length:options.count??2},(_,i)=>item(i+1))});
    if(u.pathname==="/users/bulk") return options.sellerStatus
      ? response({error:"access_denied"},options.sellerStatus)
      : response(Array.from({length:options.count??2},(_,i)=>({status_code:options.innerStatus??200,
        body:options.innerStatus ? undefined : {id:301+i,seller_reputation:{level_id:"5_green"}}})));
    const match=u.pathname.match(/^\/items\/MLB100(\d+)$/);
    if(match){const n=Number(match[1]);details.push(n);return onDetail(n);}
    throw Error("Recurso fora do stub: "+u.pathname);
  }) as typeof fetch;
  return details;
}
const search = () => new MercadoLivreApiFonte("fone bluetooth",1,"token-falso").buscar();

try {
  const agora=Date.UTC(2026,10,6,12);
  assert.equal(lerRetryAfterMs("60",agora),60000);
  assert.equal(lerRetryAfterMs("0.001",agora),1);
  assert.equal(lerRetryAfterMs(new Date(agora+120000).toUTCString(),agora),120000);
  for(const invalid of [null,"","bad", "-1", "Infinity", "999999999999999999999"]){
    assert.equal(lerRetryAfterMs(invalid,agora),0);
  }
  process.env.MERCADOLIVRE_REQUEST_INTERVAL_MS="250";
  process.env.MERCADOLIVRE_SEARCH_PAGES_PER_QUERY="1";
  process.env.MERCADOLIVRE_PRODUCTS_CHECKED_PER_QUERY="5";
  process.env.MERCADOLIVRE_MAX_OFFERS_PER_QUERY="5";
  await check("recupera segundo anuncio apos esgotamento explicito do primeiro",async()=>{
    const calls=stub(n=>response(n===1 ? {...detail(n),available_quantity:0} : detail(n)));
    const offers=await search();
    assert.equal(offers.length,1,"Nao abandonar o produto por causa do primeiro vendedor");
    assert.match(offers[0].urlProduto,/MLB-1002-/);
    assert.deepEqual(calls,[1,2]);
  });
  await check("recupera segundo anuncio apos 404 sem inventar link",async()=>{
    stub(n=>n===1 ? response({},404) : response(detail(n)));
    const offers=await search();assert.equal(offers.length,1);
    assert.match(offers[0].urlProduto,/MLB-1002-/);
  });
  await check("reclassifica descontos depois de confirmar o preco atual",async()=>{
    const calls=stub(n=>response(n===1 ? {...detail(n),price:149,original_price:150} : detail(n)));
    const offers=await search();assert.equal(offers.length,1);
    assert.match(offers[0].urlProduto,/MLB-1002-/,
      "Preco do primeiro mudou: escolher desconto confirmado do segundo");
    assert.equal(offers[0].precoAtual,52);assert.deepEqual(calls,[1,2]);
  });
  await check("limita tentativas de detalhe a tres anuncios por produto",async()=>{
    const calls=stub(n=>response(n<=3 ? {...detail(n),status:"paused"}:detail(n)),{count:4});
    assert.equal((await search()).length,0);assert.deepEqual(calls,[1,2,3]);
  });
  await check("403 no anuncio interrompe com diagnostico de permissao",async()=>{
    const calls=stub(()=>response({error:"access_denied"},403));
    await assert.rejects(search(),(e:any)=>e.code==="MERCADOLIVRE_PERMISSION_REQUIRED");
    assert.deepEqual(calls,[1],"Nao tentar driblar a restricao com outros anuncios");
  });
  await check("403 na reputacao nao vira vendedor reprovado",async()=>{
    stub(n=>response(detail(n)),{sellerStatus:403});
    await assert.rejects(search(),(e:any)=>e.code==="MERCADOLIVRE_PERMISSION_REQUIRED");
  });
  await check("403 no catalogo nao vira resultado vazio",async()=>{
    stub(n=>response(detail(n)),{catalogStatus:403});
    await assert.rejects(search(),(e:any)=>e.code==="MERCADOLIVRE_PERMISSION_REQUIRED");
  });
  await check("429 encerra na primeira resposta e preserva Retry-After",async()=>{
    let calls=0;
    globalThis.fetch=(async()=>{calls++;return response({},429,{"retry-after":"0.001"});}) as typeof fetch;
    await assert.rejects(search(),(e:any)=>e.code==="MERCADOLIVRE_RATE_LIMIT" && e.retryAfterMs===1);
    assert.equal(calls,1,"Nao repetir quatro requisicoes depois da limitacao");
  });
  for (const innerStatus of [403,429]) {
    await check("respeita erro "+innerStatus+" dentro de envelope HTTP 200",async()=>{
      stub(n=>response(detail(n)),{innerStatus});
      await assert.rejects(search(),(e:any)=>e.code===(innerStatus===403
        ? "MERCADOLIVRE_PERMISSION_REQUIRED" : "MERCADOLIVRE_RATE_LIMIT"));
    });
  }
  await check("preserva intervalo de requisicoes configurado acima de dez segundos",async()=>{
    const oldTimer=globalThis.setTimeout;const atrasos:number[]=[];
    process.env.MERCADOLIVRE_REQUEST_INTERVAL_MS="30000";
    try {
      globalThis.setTimeout=((fn:()=>void,ms:number)=>{atrasos.push(ms);queueMicrotask(fn);return 0;}) as any;
      stub(n=>response(detail(n)),{count:1});await search();
      assert.ok(atrasos.some(ms=>ms>29000),"Nao acelerar um intervalo maior explicitamente configurado");
    } finally {globalThis.setTimeout=oldTimer;process.env.MERCADOLIVRE_REQUEST_INTERVAL_MS="250";}
  });
  await check("cada requisicao possui timeout explicito",async()=>{
    globalThis.fetch=(async(_input,init)=>{
      assert.ok(init?.signal instanceof AbortSignal,"Fetch sem prazo pode travar a rodada");
      return response({results:[],paging:{total:0}});
    }) as typeof fetch;
    assert.deepEqual(await search(),[]);
  });
} finally {
  globalThis.fetch=oldFetch;
  for(const [key,value] of Object.entries(oldEnv)){
    if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
}
if(failures){console.error("MELI07_FAILURES="+failures);process.exitCode=1;}
else console.log("MELI07_RECUPERACAO_OK: 12 cenarios, zero rede real/arquivos de operacao/envios.");
