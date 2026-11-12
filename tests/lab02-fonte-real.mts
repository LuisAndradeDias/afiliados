import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {auditar,preparar,sondar,extrair,Bloqueio,API_URL,LIMIT} from "../labs/fonte-real/sonda.js";
const valid={
  LAB02_EXECUCAO_UNICA:"sim",
  LAB02_SHOPEE_API_APROVADA:"sim",
  LAB02_SHOPEE_DOC_OFICIAL_CONFERIDO:"sim",
  LAB02_SHOPEE_USO_DADOS_PERMITIDO:"sim",
  LAB02_SHOPEE_APP_ID:"123456789",
  LAB02_SHOPEE_APP_SECRET:"TEST_SECRET_NOT_REAL_123456"
};
const produto={
  itemId:"12345678910",shopId:"987654321",
  productName:"Parafusadeira 21V de laboratorio",
  priceMin:"199.90",offerLink:"https://shopee.com.br/produto-i.987654321.12345678910"
};
const resposta=(nodes:unknown[]=[produto])=>({data:{productOfferV2:{nodes}}});
const mock=(response:Response,counter:{n:number})=>
  (async (_url:string|URL|Request,_init?:RequestInit)=>{
    counter.n++;return response;
  }) as typeof fetch;
const reject=(codigo:string,fn:()=>unknown|Promise<unknown>)=>
  assert.rejects(async()=>{await fn()},(e:unknown)=>
    e instanceof Bloqueio&&e.codigo===codigo);

test("status padrao nao requisita nem revela segredos",()=>{
  const d=auditar({});
  assert.equal(d.tipo,"SEM_CONSULTAS_REAIS");
  assert.equal(d.consultas,0);
  assert.equal(d.envios,0);
  assert.equal(d.resultadosReais,0);
  assert.equal(d.fontes.length,3);
  assert.equal(d.fontes[0].pronta,false);
  assert.ok(d.fontes[0].pendencias.length>=5);
  assert.equal(d.fontes[1].pronta,false);
  assert.equal(d.fontes[2].pronta,false);
  assert.ok(!JSON.stringify(d).includes("SECRET"));
});
test("mercado livre fica bloqueado mesmo que outra fonte seja liberada",()=>{
  const d=auditar(valid);
  assert.equal(d.fontes[0].pronta,true);
  assert.equal(d.fontes[2].pronta,false);
});
test("Amazon nao pode ser qualificada sem aprovacao escrita para analise",()=>{
 const d=auditar({...valid,
  LAB02_AMAZON_CONTA_ACEITA:"sim",
  LAB02_AMAZON_CREATORS_ID:"id",
  LAB02_AMAZON_CREATORS_SECRET:"secret",
  LAB02_AMAZON_CREATORS_VERSION:"3.1",
  LAB02_AMAZON_PARTNER_TAG:"exemplo-20"
 });
 assert.equal(d.fontes[1].pronta,false);
 assert.ok(d.fontes[1].pendencias.some(x=>x.includes("escrito")));
});
test("sonda nao aciona transporte quando falta qualquer permissao",async()=>{
 let n=0;
 const fake=mock(new Response(JSON.stringify(resposta())),{get n(){return n},set n(v){n=v}});
 for(const k of ["LAB02_SHOPEE_API_APROVADA",
  "LAB02_SHOPEE_DOC_OFICIAL_CONFERIDO",
  "LAB02_SHOPEE_USO_DADOS_PERMITIDO","LAB02_SHOPEE_APP_ID","LAB02_SHOPEE_APP_SECRET"]){
    const vars={...valid,[k]:""};
    await reject("SEM_LIBERACAO_OFICIAL",()=>sondar(vars,"parafusadeira",fake,1800000000));
 }
 assert.equal(n,0);
});
test("assinatura deterministica do contrato provisório, 1 query e sem credencial no corpo",()=>{
 const ts=1800000000;
 const q=preparar(valid,"parafusadeira",ts);
 assert.equal(q.url,API_URL);
 assert.ok(q.body.includes("productOfferV2"));
 assert.ok(q.body.includes("limit: 5"));
 assert.equal(q.body.includes(valid.LAB02_SHOPEE_APP_SECRET),false);
 assert.ok(!q.body.includes("mutation"));
 const sign=createHash("sha256")
   .update(valid.LAB02_SHOPEE_APP_ID+ts+q.body+valid.LAB02_SHOPEE_APP_SECRET)
   .digest("hex");
 assert.equal(q.headers.authorization,
   "SHA256 Credential="+valid.LAB02_SHOPEE_APP_ID+
   ", Timestamp="+ts+", Signature="+sign);
});
test("palavra chave nao permite injection GraphQL",()=>{
 for(const x of ["","a","x\") { mutation {hack}","invasao\n","a".repeat(120)]){
  assert.throws(()=>preparar(valid,x,1800000000),Bloqueio);
 }
 assert.equal(preparar(valid,"câmera digital",1800000000).url,API_URL);
});
test("sonda unica usa HTTP POST, https fixo, sem redirects e sem enviar mensagem",async()=>{
 let called=0;let meta:RequestInit|undefined;let uri="";
 const fake=(async (u:string|URL|Request,opt?:RequestInit)=>{
  uri=String(u);meta=opt;called++;
  return new Response(JSON.stringify(resposta()),{
   status:200,headers:{"content-type":"application/json"}
  });
 }) as typeof fetch;
 const result=await sondar(valid,"parafusadeira",fake,1800000000);
 assert.equal(called,1);
 assert.equal(uri,API_URL);
 assert.equal(meta?.method,"POST");
 assert.equal(meta?.redirect,"error");
 assert.equal(meta?.cache,"no-store");
 assert.equal(result.requisicoes,1);
 assert.equal(result.envios,0);
 assert.equal(result.candidatos.length,1);
 assert.equal(result.candidatos[0].precoInformadoCentavos,19990);
 assert.equal(result.candidatos[0].podePublicar,false);
 assert.equal(result.candidatos[0].checkoutConfirmado,false);
 assert.equal(result.candidatos[0].estoqueConfirmado,false);
 assert.equal(result.candidatos[0].descontoConfirmado,false);
});
test("erro 403 e 401 sao tratados como falta de permissao, nunca contornados",async()=>{
 for(const status of [401,403]){
  const count={n:0};
  await reject("SEM_PERMISSAO",()=>sondar(valid,"parafusadeira",
    mock(new Response("x",{status}),count),1800000000));
  assert.equal(count.n,1);
 }
});
test("429 nao e repetido; 503 e encerrado com seguranca",async()=>{
 const c={n:0};
 await reject("LIMITADO_PELO_PROVEDOR",()=>sondar(valid,"parafusadeira",
  mock(new Response("rate limit",{status:429}),c),1800000000));
 assert.equal(c.n,1);
 await reject("API_INDISPONIVEL",()=>sondar(valid,"parafusadeira",
  mock(new Response("erro",{status:503}),c),1800000000));
 assert.equal(c.n,2);
});
test("falha de rede nao devolve cabecalhos ou segredos",async()=>{
 const fake=(async()=>{throw Error("raw authorization SECRET")}) as typeof fetch;
 await reject("TRANSPORTE_FALHOU",()=>sondar(valid,"teclado",fake,1800000000));
});
test("resposta parcial de GraphQL nao pode virar oferta",()=>{
 assert.throws(()=>extrair({...resposta(),errors:[{message:"denied"}]}),
  (e:unknown)=>e instanceof Bloqueio&&e.codigo==="GRAPHQL_RETORNOU_ERROS");
 assert.throws(()=>extrair({data:{other:{}}}),Bloqueio);
 assert.throws(()=>extrair({data:{productOfferV2:{nodes:[]}},errors:[{message:"x"}]}),Bloqueio);
});
test("limite maximo de 5 registros aplicados antes da extracao",()=>{
 assert.equal(LIMIT,5);
 assert.throws(()=>extrair(resposta(Array.from({length:6},()=>produto))),Bloqueio);
});
test("links externos, campos adulterados e URLs inseguras sao descartados",()=>{
 const result=extrair(resposta([
  {...produto,offerLink:"https://shopee.com.br.evil.example/abc",priceMin:"120.32"},
  {...produto,itemId:"98765432100",offerLink:"javascript:alert(1)",priceMin:"-2"},
  {...produto,itemId:"22222222222",productName:""},
  {...produto,itemId:"12345678910",priceMin:"0.01"}
 ]));
 assert.equal(result.length,2);
 assert.equal(result[0].linkAfiliado,null);
 assert.equal(result[1].linkAfiliado,null);
 assert.equal(result[1].precoInformadoCentavos,null);
 assert.ok(result.every(x=>!x.podePublicar));
});
test("preco, frete e cupom nao inventados; mesmo produto nao duplica",()=>{
 const result=extrair(resposta([produto,produto]));
 assert.equal(result.length,1);
 assert.equal(result[0].precoInformadoCentavos,19990);
 assert.ok(!Object.hasOwn(result[0],"freteCentavos"));
 assert.ok(!Object.hasOwn(result[0],"cupom"));
});
test("resposta excessiva ou corpo sem JSON nao sao processados",async()=>{
 await reject("RESPOSTA_EXCESSIVA",()=>sondar(valid,"parafusadeira",
  mock(new Response("{}",{headers:{"content-length":"150001"}}),{n:0}),1800000000));
 await reject("JSON_INVALIDO",()=>sondar(valid,"parafusadeira",
  mock(new Response("not json"),{n:0}),1800000000));
});
test("nenhuma chamada real foi feita nesta suite",()=>{
 assert.equal(auditar({}).consultas,0);
});

test("mesmo com credenciais e liberacoes declaradas, sem chave de execucao nao ha chamada",async()=>{
 const c={n:0};
 await reject("SONDA_NAO_ARMADA",()=>sondar(
  {...valid,LAB02_EXECUCAO_UNICA:"nao"},"parafusadeira",
  mock(new Response(JSON.stringify(resposta())),c),1800000000));
 assert.equal(c.n,0);
});
