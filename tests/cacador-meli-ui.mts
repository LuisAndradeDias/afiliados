import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdtemp,mkdir,writeFile,readFile,rm,stat} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {chromium} from "playwright";
import {responderRotaCacadorMeli} from "../src/painel/cacador-meli-http.js";
import {responderRotaVisual} from "../src/painel/rotas-visuais.js";

const dir=await mkdtemp(join(tmpdir(),"cacador-meli-test-"));
const screenshotDir=join(process.cwd(),"test-results","cacador-meli");
await mkdir(join(dir,"data"),{recursive:true});
await mkdir(screenshotDir,{recursive:true});
const now=Date.now();
const iso=(mins:number)=>new Date(now-mins*60_000).toISOString();
const mk=(n:number,mins:number,changes:Record<string,unknown>={})=>({
 id:"00000000-0000-4000-8000-"+String(n).padStart(12,"0"),
 titulo:"Parafusadeira de impacto — registro "+n,
 urlProduto:"https://www.mercadolivre.com.br/p/MLB47099790"+String(n).padStart(2,"0"),
 urlAfiliado:"https://meli.la/teste"+n,
 precoAtual:219.9,precoAnterior:289.9,descontoPercentual:24.15,
 origem:"conferencia-manual",status:"rascunho-nao-publicado",
 conferidoEm:iso(mins),...changes
});
const file=join(dir,"data","mercadolivre-rascunhos-assistidos.json");
const entries=[
 mk(65,10),mk(66,375),mk(67,3480),
 mk(65,70,{id:"99999999-9999-4999-8999-999999999999"})
];
await writeFile(file,JSON.stringify({versao:1,rascunhos:entries}));
const before=await readFile(file);
const hash=(value:Buffer)=>createHash("sha256").update(value).digest("hex");
const beforeSha=hash(before);
let writes=0;
const server=createServer(async (req,res)=>{
 try{
  const path=new URL(req.url??"/","http://127.0.0.1").pathname;
  if(await responderRotaCacadorMeli(req,res,path,dir))return;
  if(req.method!=="GET"){writes++;res.writeHead(405);res.end();return;}
  if(await responderRotaVisual({method:req.method,pathname:path,res,raiz:process.cwd()}))return;
  res.writeHead(404,{"content-type":"text/plain"});res.end("not found");
 }catch{
  if(!res.headersSent)res.writeHead(500);
  res.end("unavailable");
 }
});
await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
const addr=server.address();assert.ok(addr&&typeof addr!=="string");
const origin="http://127.0.0.1:"+addr.port;
const browser=await chromium.launch({channel:"chrome",headless:true});
try{
 const api=await fetch(origin+"/api/mercadolivre/cacador");
 assert.equal(api.status,200);
 assert.match(api.headers.get("cache-control")??"",/no-store/);
 const payload=await api.json();
 assert.equal(payload.ok,true);
 assert.equal(payload.modo,"ASSISTIDO");
 assert.equal(payload.fonteExterna.buscaAutomaticaAtiva,false);
 assert.equal(payload.guardrails.motorLigado,false);
 assert.equal(payload.guardrails.enviosRealizados,0);
 assert.equal(payload.totais.registros,4);
 assert.equal(payload.totais.identidades,3);
 assert.equal(payload.totais.duplicados,1);
 assert.equal(payload.totais.revisar,1);
 assert.equal(payload.totais.revalidar,1);
 assert.equal(payload.totais.bloqueados,1);
 assert.ok(payload.candidatos.every((p:any)=>p.podePublicar===false));
 assert.ok(payload.candidatos.every((p:any)=>!("urlAfiliado" in p)),
   "endpoint deve ocultar link de afiliado");
 const post=await fetch(origin+"/api/mercadolivre/cacador",{method:"POST"});
 assert.equal(post.status,405);
 assert.equal(post.headers.get("allow"),"GET");
 const cross=await fetch(origin+"/api/mercadolivre/cacador",{
  headers:{"sec-fetch-site":"cross-site"}
 });
 assert.equal(cross.status,403);
 assert.equal(writes,0);
 const response=await fetch(origin+"/cacador");
 assert.equal(response.status,200);
 assert.match(response.headers.get("content-security-policy")??"",/connect-src 'self'/);
 assert.match(response.headers.get("content-security-policy")??"",/img-src 'none'/);
 const text=await response.text();
 assert.ok(!text.includes("R$ 219,90"),"HTML da produção não deve conter preços fictícios");
 for(const width of [1440,768,390]){
  const context=await browser.newContext({viewport:{width,height:900},locale:"pt-BR",
   deviceScaleFactor:1,reducedMotion:"reduce"});
  const errors:string[]=[],external:string[]=[],requests:string[]=[];
  await context.route("**/*",async route=>{
   const url=new URL(route.request().url());
   if(url.origin!==origin||route.request().method()!=="GET"){
    external.push(route.request().method()+" "+url.origin+url.pathname);
    await route.abort();
   }else{requests.push(url.pathname);await route.continue();}
  });
  const page=await context.newPage();
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
  const navigation=await page.goto(origin+"/cacador",{waitUntil:"networkidle"});
  assert.equal(navigation?.status(),200);
  assert.ok(requests.includes("/api/mercadolivre/cacador"));
  assert.equal(await page.locator("#metricItems").innerText(),"03");
  assert.equal(await page.locator("#metricReview").innerText(),"01");
  assert.equal(await page.locator("#metricStale").innerText(),"02");
  assert.equal(await page.locator("#metricRequests").innerText(),"00");
  assert.equal(await page.locator(".cac-hero-button").getAttribute("href"),"/ofertas#mlAssistDetails");
  assert.equal(await page.locator(".cac-list-footer a").getAttribute("href"),"/ofertas#mlAssistDetails");
  assert.equal(await page.locator("#cacRows tr").count(),3);
  assert.match(await page.locator("#cacNotice").innerText(),/não disponibilizada/);
  assert.equal(await page.locator("#detailPrice").innerText(),"R$\u00a0219,90");
  assert.equal(await page.locator("#detailHistory").innerText(),"Não comprovado");
  assert.match(await page.locator("#detailReasons").innerText(),/não comprova queda histórica/);
  assert.equal(await page.locator("#openProduct").isVisible(),true);
  const long=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert.ok(long<=2,"Overflow desktop "+width+": "+long);
  const shot=await page.screenshot({path:join(screenshotDir,"cacador-real-"+width+".png"),
   fullPage:true,animations:"disabled"});
  if(width===1440){
   const height=await page.evaluate(()=>document.documentElement.scrollHeight);
   assert.ok(height>900);
   const inspector=await context.newPage();
   try{
    const color=await inspector.evaluate(async({base64,y})=>{
     const img=new Image();img.src="data:image/png;base64,"+base64;await img.decode();
     const canvas=document.createElement("canvas");canvas.width=1;canvas.height=1;
     const ctx=canvas.getContext("2d");if(!ctx)throw Error("canvas");
     ctx.drawImage(img,-20,-y);
     return [...ctx.getImageData(0,0,1,1).data].slice(0,3);
    },{base64:shot.toString("base64"),y:height-18});
    assert.deepEqual(color,[23,35,51],"Barra lateral deve continuar escura até o rodapé");
   }finally{await inspector.close();}
  }
  await page.locator("button[data-filter='revalidar']").click();
  assert.equal(await page.locator("#cacRows tr").count(),1);
  assert.match(await page.locator("#detailName").innerText(),/registro 66/);
  await page.locator("button[data-filter='bloqueado']").click();
  assert.equal(await page.locator("#cacRows tr").count(),1);
  await page.locator("button[data-filter='todos']").click();
  await page.locator("#cacSearch").fill("registro 66");
  assert.equal(await page.locator("#cacRows tr").count(),1);
  await page.locator("#cacSearch").fill("");
  await page.locator("#demoLink").click();
  await page.waitForURL("**/cacador?demo=1");
  assert.match(await page.locator("#cacNotice").innerText(),/FICTÍCIOS/);
  assert.equal(await page.locator("#metricItems").innerText(),"04");
  assert.equal(await page.locator("#metricReview").innerText(),"02");
  assert.equal(await page.locator("#cacRows tr").count(),4);
  assert.equal(await page.locator("#openProduct").isVisible(),false);
  await page.screenshot({path:join(screenshotDir,"cacador-demo-"+width+".png"),
   fullPage:true,animations:"disabled"});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=2,true);
  assert.deepEqual(errors,[],"Browser errors "+width);
  assert.deepEqual(external,[],"No external traffic or POST "+width);
  console.log("CACADOR_MELI_UX="+width+"px real=3 demo=4 sidebar=ok zero_external=true");
  await context.close();
 }
 assert.equal(hash(await readFile(file)),beforeSha,"Arquivo de rascunhos não pode ser modificado");
 const meta=await stat(file);assert.ok(meta.size>0);
 assert.equal(writes,0);
 console.log("CACADOR_UI_VALIDADO: 3 tamanhos, 0 escritas, 0 scraping, 0 envios");
}finally{
 await browser.close();
 server.closeAllConnections();
 await new Promise<void>(r=>server.close(()=>r()));
 await rm(dir,{recursive:true,force:true});
}
