import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { responderRotaVisual } from "../src/painel/rotas-visuais.js";
import { responderRotaRevisao } from "../src/painel/revisao-http.js";

const root=process.cwd();
const dir=await mkdtemp(join(tmpdir(),"meli09-review-ui-"));
await mkdir(join(dir,"data"));
const fresh=new Date(Date.now()-15*60_000).toISOString();
const old=new Date(Date.now()-150*60_000).toISOString();
const sample={
 origem:"conferencia-manual",status:"rascunho-nao-publicado",
 precoAtual:150,precoAnterior:200,descontoPercentual:25,
 urlProduto:"https://www.mercadolivre.com.br/p/MLB38053317",
 urlAfiliado:"https://meli.la/link-teste"
};
await writeFile(join(dir,"data","mercadolivre-rascunhos-assistidos.json"),
  JSON.stringify({versao:1,rascunhos:[
   {...sample,id:"c4f05a30-f0f5-42ce-b536-38b0922a8871",titulo:"Aspirador portátil para teste",conferidoEm:fresh},
   {...sample,id:"19ec3658-b7a9-463c-b4aa-38399fa1a36b",titulo:"Ferramenta para reconferir",
    urlProduto:"https://www.mercadolivre.com.br/p/MLB39000000",
    urlAfiliado:"https://meli.la/segundo",conferidoEm:old}
  ]}));
const status={operacaoEstado:"paused",monitorAlternadoAtivo:false,
 whatsappAutoEnvioAtivo:false,whatsappEnvioPendente:false,
 executando:[],ofertaPreparada:false};
let writes=0;
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url||"/","http://127.0.0.1").pathname;
  if(req.method!=="GET"){writes++;res.writeHead(405);res.end();return;}
  if(path==="/api/status"){
   res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify(status));return;
  }
  if(await responderRotaRevisao({method:req.method,pathname:path,res,raiz:dir}))return;
  if(await responderRotaVisual({method:req.method,pathname:path,res,raiz:root}))return;
  res.writeHead(404);res.end();
 }catch(e){res.writeHead(500);res.end(String(e));}
});
await new Promise<void>(ok=>server.listen(0,"127.0.0.1",ok));
const addr=server.address();assert.ok(addr&&typeof addr!=="string");
const base="http://127.0.0.1:"+addr.port;
const browser=await chromium.launch({channel:"chrome",headless:true});
const output=join(root,"test-results","meli09");
await mkdir(output,{recursive:true});
try{
 for(const width of [1595,390]){
  const context=await browser.newContext({viewport:{width,height:900},locale:"pt-BR",deviceScaleFactor:1,reducedMotion:"reduce"});
  await context.route("**/*",async route=>{
   const u=new URL(route.request().url());
   if(u.origin!==base || route.request().method()!=="GET"){writes++;await route.abort();return;}
   await route.continue();
  });
  const page=await context.newPage();
  const errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  const resp=await page.goto(base+"/revisao",{waitUntil:"networkidle"});
  assert.equal(resp?.status(),200);
  await page.locator("#revDrafts").getByText("2").waitFor({timeout:4500});
  assert.equal(await page.locator("#revObserved").innerText(),"0");
  assert.equal(await page.locator("#revRecheck").innerText(),"1");
  assert.equal(await page.locator(".rev-card").count(),2);
  assert.match(await page.locator(".rev-card").first().innerText(),/não publicado|não enviada|rascunho/i);
  assert.match(await page.locator(".rev-card").last().innerText(),/reconfir|desatualizado/i);
  const filter=page.locator('[data-rev-filter="rascunho-assistido-meli"]');
  await filter.click();
  assert.equal(await filter.getAttribute("aria-pressed"),"true");
  assert.equal(await page.locator(".rev-card").count(),2);
  assert.equal(await page.locator("button").filter({hasText:/Enviar|Publicar|WhatsApp/i}).count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),
    "Tela de revisão não deve ultrapassar "+width+"px");
  assert.deepEqual(errors,[]);
  await page.screenshot({path:join(output,"revisao-"+width+".png"),fullPage:true,animations:"disabled"});
  await context.close();
 }
 assert.equal(writes,0,"Revisão assistida é exclusivamente GET");
 console.log("MELI09_REVIEW_VISUAL_OK: desktop/mobile, contagens e filtro, nenhuma escrita ou envio.");
}finally{
 await browser.close();
 server.closeAllConnections();
 await new Promise<void>(ok=>server.close(()=>ok()));
 await rm(dir,{recursive:true,force:true});
}
