import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdtemp,mkdir,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {chromium} from "playwright";
import {responderRotaVisual} from "../src/painel/rotas-visuais.js";
import {responderRotaMeliAssistido} from "../src/painel/mercadolivre-assistido-http.js";
const root=process.cwd();
const dir=await mkdtemp(join(tmpdir(),"cpv-meli08-ui-"));
const out=join(root,"test-results","meli08-ux");
await mkdir(out,{recursive:true});
let apiWrites:string[]=[];
const status={
 operacaoEstado:"error",monitorAlternadoAtivo:false,mercadoLivreMonitorAtivo:false,
 executando:[],ofertaPreparada:false,whatsappEnvioPendente:false,
 whatsappAutoEnvioAtivo:true,grupo:"GRUPO TESTE",grupoConfigurado:true,
 mercadoLivreFluxoEtapa:"error",
 mercadoLivreFluxoMensagem:"Mercado Livre: acesso negado (HTTP 403).",
 mercadoLivreApiConfigurada:true,mercadoLivreExtensionConectada:true,
 descontoMinimo:20,cooldownHoras:24,previewCooldownMinutos:120,
 sessaoWhatsapp:true,afiliadoConfigurado:true,
 logs:[],mercadoLivreOferta:{}
};
const server=createServer(async(req,res)=>{
 try{
 const path=new URL(req.url||"/","http://127.0.0.1").pathname;
 if(req.method!=="GET")apiWrites.push(path);
 if(path==="/api/status"&&req.method==="GET"){
  res.writeHead(200,{"content-type":"application/json"});
  res.end(JSON.stringify(status));return;
 }
 if(await responderRotaMeliAssistido({req,res,pathname:path,raiz:dir}))return;
 if(await responderRotaVisual({method:req.method,pathname:path,res,raiz:root}))return;
 if(path==="/"&&req.method==="GET"){
  const {readFileSync}=await import("node:fs");
  res.writeHead(200,{"content-type":"text/html;charset=utf-8"});
  res.end(readFileSync(join(root,"src","painel","public","index.html"),"utf8"));return;
 }
 if(path==="/ofertas"&&req.method==="GET"){
  res.writeHead(302,{location:"/"});res.end();return;
 }
 res.writeHead(404);res.end();
 }catch(e){res.writeHead(500);res.end(String(e));}
});
await new Promise<void>(ok=>server.listen(0,"127.0.0.1",ok));
const address=server.address();assert.ok(address&&typeof address!=="string");
const base="http://127.0.0.1:"+address.port;
const browser=await chromium.launch({channel:"chrome",headless:true});
try{
 for(const width of [1595,390]){
  apiWrites=[];
  const ctx=await browser.newContext({viewport:{width,height:900},locale:"pt-BR",reducedMotion:"reduce"});
  const page=await ctx.newPage(),errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  // Atalho do Caçador: abre Ferramentas e o formulário MELI sem enviar nada.
  const shortcut=await ctx.newPage();
  await shortcut.goto(base+"/ofertas#mlAssistDetails",{waitUntil:"domcontentloaded"});
  await shortcut.locator("#cpvSettingsDialog").waitFor({state:"visible",timeout:5000});
  assert.equal(await shortcut.locator("#cpvSettingsTab-ferramentas").getAttribute("aria-selected"),"true");
  assert.equal(await shortcut.locator("#mlAssistDetails").evaluate((el:HTMLDetailsElement)=>el.open),true);
  await shortcut.close();
  await page.goto(base+"/ofertas",{waitUntil:"domcontentloaded"});
  await page.locator("#cpvSettingsButton").click({timeout:5000});
  await page.locator("#cpvSettingsTab-ferramentas").click({timeout:5000});
  await page.locator("#mlAssistDetails > summary").click({timeout:3500});
  await page.locator("#mlAssistTitle").fill("Fone Bluetooth original");
  await page.locator("#mlAssistProduct").fill("https://www.mercadolivre.com.br/p/MLB38053317");
  await page.locator("#mlAssistAffiliate").fill("https://meli.la/testecpv");
  await page.locator("#mlAssistPrice").fill("149,90");
  await page.locator("#mlAssistPrevious").fill("199,90");
  for(const id of ["mlAssistPriceCheck","mlAssistStockCheck","mlAssistSellerCheck","mlAssistLinkCheck"]){
    await page.locator("#"+id).check();
  }
  await page.locator("#mlAssistSave").click();
  await page.locator("#mlAssistFeedback").getByText(/rascunho/i).waitFor({timeout:5000});
  await page.locator("#mlAssistList article").first().waitFor({timeout:5000});
  assert.equal(await page.locator("#mlAssistList article").count(),1);
  assert.match(await page.locator("#mlAssistList").innerText(),/25,01%/);
  assert.doesNotMatch(await page.locator("#mlAssistList").innerText(),/Enviar|Preparar/i);
  const measure=await page.evaluate(()=>({
    scroll:document.documentElement.scrollWidth-innerWidth,
    right:document.getElementById("mlAssistSave")!.getBoundingClientRect().right
  }));
  assert.ok(measure.scroll<=1,"Rolagem horizontal em "+width+": "+JSON.stringify(measure));
  assert.ok(measure.right<=width+1,"Formulário extrapolou a tela");
  assert.deepEqual(apiWrites,["/api/mercadolivre/rascunhos-assistidos"],
    "Nenhuma rota de WhatsApp/autoenvio pode ser acionada");
  await page.locator("#mlAssistDetails > summary").evaluate(el=>
    el.scrollIntoView({block:"start",behavior:"instant"}));
  await page.screenshot({path:join(out,"mercadolivre-assistido-"+width+".png"),
    fullPage:true,animations:"disabled"});
  await page.evaluate(()=>{window.confirm=()=>true;});
  await page.locator("#mlAssistList button[data-remove]").click();
  await page.locator("#mlAssistList article").first().waitFor({state:"detached",timeout:5000});
  assert.equal(await page.locator("#mlAssistList article").count(),0);
  assert.deepEqual(apiWrites,[
    "/api/mercadolivre/rascunhos-assistidos",
    "/api/mercadolivre/rascunhos-assistidos/"+apiWrites.at(-1)!.split("/").pop()
  ]);
  assert.deepEqual(errors,[]);
  await ctx.close();
 }
 console.log("MELI08_UI_OK: rascunho manual visual, desktop/celular, sem acionar WhatsApp.");
}finally{
 await browser.close();
 server.closeAllConnections();await new Promise<void>(ok=>server.close(()=>ok()));
 await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
