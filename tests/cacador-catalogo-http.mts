import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,rm} from "node:fs/promises";
import {existsSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {createServer} from "node:http";
import {CatalogoCacador,validarEntradaCacador,chaveCacador}
  from "../src/cacador/catalogo.js";
import {responderRotaCacador} from "../src/painel/cacador-http.js";

const AGORA=Date.parse("2026-11-13T12:00:00Z");
const old=(d:string,n:number)=>({instanteUtc:d,origem:"snapshot-claude" as const});
const entrada=(sobrescritas:Record<string,unknown>={})=>({
  canal:"Mercado Livre",produtoId:"MLB123456789",titulo:"Furadeira de impacto 21 V",
  vendedor:"Vendedor001",variante:"21V",pagamento:"geral",
  precoCentavos:8500,freteCentavos:0,precoAnteriorCentavos:14000,
  urlProduto:"https://www.mercadolivre.com.br/p/MLB123456789",
  urlAfiliado:"https://meli.la/abcd1234",disponibilidade:"declarada",
  nota:4.7,avaliacoes:412,vendidos:2000,freteGratis:true,
  cupomCodigo:"PROMO10",confirmadoManualmente:true,
  ...sobrescritas
});
test("GET de catálogo vazio não cria banco, monitor ou mensagens",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"cat-empty-"));
  try{
    const arquivo=join(dir,"data","catalogo.sqlite");
    const repo=new CatalogoCacador(arquivo,()=>AGORA);
    assert.equal(repo.listar().resumo.total,0);
    assert.equal(existsSync(arquivo),false);
    assert.equal(repo.listar().resumo.enviosRealizados,0);
    assert.equal(repo.listar().resumo.buscasAutomaticas,0);
  }finally{await rm(dir,{force:true,recursive:true});}
});
test("3 períodos anteriores e queda de preço geram apenas revisão, nunca envio",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"cat-memo-"));
  const arquivo=join(dir,"cat.sqlite");
  const repo=new CatalogoCacador(arquivo,()=>AGORA);
  try{
    for(const d of ["2026-11-08T10:00:00Z","2026-11-09T10:00:00Z","2026-11-10T10:00:00Z"]){
      repo.registrar(entrada({precoCentavos:12000}),old(d,12000));
    }
    const p=repo.registrar(entrada(),old("2026-11-13T11:00:00Z",8500));
    assert.equal(p.memoria?.periodos,3);
    assert.equal(p.memoria?.precoNormalCentavos,12000);
    assert.equal(p.memoria?.veredito,"menor_preco");
    assert.equal(p.memoria?.quedaHistoricaPercentual,29.2);
    assert.equal(p.situacao,"revisar");
    assert.equal(p.podePublicar,false);
    assert.equal(repo.listar().resumo.paraRevisar,1);
    assert.equal(repo.listar().resumo.observacoes,4);
    assert.equal(p.cupomStatus,"nao-verificado");
    assert.equal(repo.listar().resumo.enviosRealizados,0);
    assert.equal(repo.listar().resumo.buscasAutomaticas,0);
    repo.fechar();
    const again=new CatalogoCacador(arquivo,()=>AGORA);
    assert.equal(again.listar().resumo.observacoes,4);
    assert.equal(again.listar().itens[0].situacao,"revisar");
    again.fechar();
  }finally{repo.fechar();await rm(dir,{force:true,recursive:true});}
});
test("não mistura modalidade, variante, vendedor ou anúncio",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"cat-id-"));
  const repo=new CatalogoCacador(join(dir,"cat.sqlite"),()=>AGORA);
  try{
    const different=[
      {vendedor:"OutroVendedor"},{variante:"18V"},{pagamento:"pix"},
      {produtoId:"MLB987654321",urlProduto:"https://www.mercadolivre.com.br/p/MLB987654321"}
    ];
    repo.registrar(entrada(),old("2026-11-08T10:00:00Z",8500));
    for(const c of different)repo.registrar(entrada(c),old("2026-11-09T10:00:00Z",8500));
    const itens=repo.listar().itens;
    assert.equal(itens.length,5);
    assert.equal(new Set(itens.map(x=>x.chave)).size,5);
    assert.ok(itens.every(x=>x.memoria?.periodos===0));
  }finally{repo.fechar();await rm(dir,{force:true,recursive:true});}
});
test("duplicata exata idempotente; conflito no mesmo instante bloqueia sem sobrescrever",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"cat-dupe-"));
  const repo=new CatalogoCacador(join(dir,"cat.sqlite"),()=>AGORA);
  try{
    const opt=old("2026-11-09T10:00:00Z",8500);
    repo.registrar(entrada(),opt);
    repo.registrar(entrada(),opt);
    assert.equal(repo.listar().resumo.observacoes,1);
    assert.throws(()=>repo.registrar(entrada({precoCentavos:5000}),opt),/Conflito/);
    assert.equal(repo.listar().itens[0].precoCentavos,8500);
    assert.equal(repo.listar().resumo.observacoes,1);
  }finally{repo.fechar();await rm(dir,{force:true,recursive:true});}
});
test("retroimportação não substitui preço mais recente do catálogo",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"cat-backfill-"));
  const repo=new CatalogoCacador(join(dir,"cat.sqlite"),()=>AGORA);
  try{
    repo.registrar(entrada({precoCentavos:7500}),
      old("2026-11-13T10:00:00Z",7500));
    repo.registrar(entrada({precoCentavos:12500}),
      old("2026-11-08T10:00:00Z",12500));
    assert.equal(repo.listar().resumo.observacoes,2);
    const atual=repo.listar().itens[0];
    assert.equal(atual.precoCentavos,7500);
    assert.equal(atual.observadoEmUtc,"2026-11-13T10:00:00.000Z");
    assert.equal(atual.memoria?.menorPrecoCentavos,12500);
  }finally{repo.fechar();await rm(dir,{force:true,recursive:true});}
});
test("sem frete não comprova queda; indisponível e preço inflado bloqueados",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"cat-block-"));
  const repo=new CatalogoCacador(join(dir,"cat.sqlite"),()=>AGORA);
  try{
    const x=repo.registrar(entrada({freteCentavos:null}),old("2026-11-13T10:00:00Z",8500));
    assert.equal(x.memoria,null);
    assert.notEqual(x.situacao,"revisar");
    assert.ok(x.alertas.some(x=>x.includes("Frete desconhecido")));
    const unavailable=repo.registrar(entrada({disponibilidade:"indisponivel"}),
      old("2026-11-13T11:00:00Z",8500));
    assert.equal(unavailable.situacao,"bloqueado");
    const inflated=repo.registrar(entrada({
      precoAnteriorCentavos:90000
    }),old("2026-11-13T11:20:00Z",8500));
    assert.equal(inflated.situacao,"bloqueado");
  }finally{repo.fechar();await rm(dir,{force:true,recursive:true});}
});
test("dados inválidos, URL externa e disponibilidade não confirmada são sinalizados",()=>{
  for(const x of [
    {urlProduto:"https://evil.example/p/MLB123456789"},
    {urlAfiliado:"https://evil.example/affiliate"},
    {produtoId:"MLB-outro"},
    {precoCentavos:-5},{precoCentavos:NaN},
    {titulo:"\u0000malicioso"}, {nota:7},{avaliacoes:-20},
    {cupomCodigo:"<script>"},{confirmadoManualmente:false}
  ])assert.throws(()=>validarEntradaCacador(entrada(x)));
  const id=chaveCacador(validarEntradaCacador(entrada()));
  assert.match(id,/^[a-f0-9]{64}$/);
});
test("API local: GET/POST com origem e corpo limitados, sem publicação",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"cat-http-"));
  await mkdir(join(dir,"data"));
  const server=createServer(async(req,res)=>{
    const p=new URL(req.url??"/","http://localhost").pathname;
    if(await responderRotaCacador({req,res,pathname:p,raiz:dir}))return;
    res.writeHead(404);res.end();
  });
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const a=server.address();assert.ok(a&&typeof a!=="string");
  const host="http://127.0.0.1:"+a.port;
  const post=(path:string,payload:unknown,origin=host)=>fetch(host+path,{
    method:"POST",headers:{"Content-Type":"application/json","Origin":origin},
    body:JSON.stringify(payload)
  });
  try{
    let r=await fetch(host+"/api/cacador/catalogo");
    assert.equal(r.status,200);
    assert.equal((await r.json()).resumo.total,0);
    r=await post("/api/cacador/observacoes",entrada(), "https://malicioso.example");
    assert.equal(r.status,403);
    r=await post("/api/cacador/observacoes",entrada());
    assert.equal(r.status,201);
    const data=await r.json();
    assert.equal(data.produto.podePublicar,false);
    const key=data.produto.chave;
    r=await fetch(host+"/api/cacador/produto/"+key);
    assert.equal((await r.json()).produto.chave,key);
    r=await fetch(host+"/api/cacador/catalogo?canal=Shopee");
    assert.equal((await r.json()).itens.length,0);
    r=await post("/api/cacador/encaminhar/"+key,{confirmacoes:{
      preco:true,disponibilidade:true,reputacaoVerde:true,linkAfiliado:true
    }});
    assert.equal(r.status,201);
    const draft=await r.json();
    assert.equal(draft.destino,"/revisao");
    assert.match(draft.mensagem,/Nenhum envio/);
    r=await fetch(host+"/api/cacador/catalogo");
    assert.equal((await r.json()).resumo.enviosRealizados,0);
    const drafts=await import("../src/painel/mercadolivre-assistido.js");
    const list=await drafts.criarRepositorioMeli(join(dir,"data","mercadolivre-rascunhos-assistidos.json")).listar();
    assert.equal(list.length,1);
    r=await post("/api/cacador/encaminhar/"+key,{confirmacoes:{
      preco:true,disponibilidade:true,reputacaoVerde:true,linkAfiliado:true
    }});
    assert.equal(r.status,400);
  }finally{
    server.closeAllConnections();
    await new Promise<void>(resolve=>server.close(()=>resolve()));
    await rm(dir,{recursive:true,force:true});
  }
});
test("catálogo integra Shopee por rascunho sem mexer no WhatsApp",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"cat-shopee-"));
  const repo=new CatalogoCacador(join(dir,"data","catalogo.sqlite"),()=>AGORA);
  try{
    const p=repo.registrar(entrada({
      canal:"Shopee",produtoId:"1234512345",
      urlProduto:"https://shopee.com.br/item/12345/1234512345",
      urlAfiliado:"https://shope.ee/teste123",
      pagamento:"geral",precoAnteriorCentavos:null
    }),old("2026-11-13T11:00:00Z",8500));
    assert.equal(p.canal,"Shopee");assert.equal(p.podePublicar,false);
    assert.equal(p.cupomStatus,"nao-verificado");
  }finally{repo.fechar();await rm(dir,{recursive:true,force:true});}
});
