import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdtemp,mkdir,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {chromium} from "playwright";
import {responderRotaVisual} from "../src/painel/rotas-visuais.js";
import {responderRotaMeliAssistido} from "../src/painel/mercadolivre-assistido-http.js";
const root=process.cwd();
const dir=await mkdtemp(join(tmpdir(),"meli09-canal-ui-"));
let methods:string[]=[];
const status={operacaoEstado:"paused",monitorAlternadoAtivo:false,modoBusca:"media",
 whatsappAutoEnvioAtivo:true,whatsappEnvioPendente:false,ofertaPreparada:false,
 executando:[],grupoConfigurado:true,mercadoLivreApiConfigurada:true,
 mercadoLivreFluxoEtapa:"idle",mercadoLivreFluxoMensagem:"",descontoMinimo:20,
 cooldownHoras:24,previewCooldownMinutos:120,logs:[]};
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url||"/","http://127.0.0.1").pathname;
  if(req.method!=="GET")methods.push((req.method||"")+" "+path);
  if(path==="/api/status"&&req.method==="GET"){
   res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify(status));return;
  }
  if(await responderRotaMeliAssistido({req,res,pathname:path,raiz:dir,
    grupoAtual:"Grupo Público Sintético"}))return;
  if(await responderRotaVisual({method:req.method,pathname:path,res,raiz:root}))return;
  res.writeHead(404);res.end();
 }catch(e){res.writeHead(500);res.end(String(e));}
});
await new Promise<void>(ok=>server.listen(0,"127.0.0.1",ok));
const address=server.address();assert.ok(address&&typeof address!=="string");
const base="http://127.0.0.1:"+address.port;
const browser=await chromium.launch({channel:"chrome",headless:true});
const out=join(root,"test-results","meli09");
await mkdir(out,{recursive:true});
try{
 for(const width of [1595,390]){
  methods=[];
  const ctx=await browser.newContext({viewport:{width,height:850},locale:"pt-BR",reducedMotion:"reduce"});
  const page=await ctx.newPage(),errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("dialog",dialog=>void dialog.accept());
  await page.goto(base+"/ofertas",{waitUntil:"domcontentloaded"});
  await page.locator("#cpvSettingsButton").click({timeout:7000});
  await page.locator("#cpvSettingsTab-ferramentas").click({timeout:7000});
  await page.locator("#mlCanalDetails > summary").click({timeout:7000});
  await page.locator("#mlCanalStatus").getByText(/bloqueado|não confirmado/i).waitFor({timeout:7000});
  for(const id of ["mlCanalPublico","mlCanalCadastrado","mlCanalSemPrivado"]){
   await page.locator("#"+id).check();
  }
  await page.locator("#mlCanalConfirmar").click();
  await page.locator("#mlCanalStatus").getByText(/declarado pelo operador/i).waitFor({timeout:7000});
  await page.locator("#mlCanalDetails > summary").evaluate(el=>
   el.scrollIntoView({block:"start",behavior:"instant"}));
  await page.screenshot({path:join(out,"canal-"+width+".png"),fullPage:true,animations:"disabled"});
  await page.locator("#mlCanalRevogar").click();
  await page.locator("#mlCanalStatus").getByText(/bloqueado|não confirmado/i).waitFor({timeout:7000});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),
    "Canal não deve ultrapassar a largura "+width);
  assert.deepEqual(methods,[
   "POST /api/mercadolivre/canal","POST /api/mercadolivre/canal"
  ],"Somente confirmar/revogar; nenhum envio nem preparação");
  assert.deepEqual(errors,[]);
  await ctx.close();
 }
 console.log("MELI09_CANAL_VISUAL_OK: 1595/390, confirmação/revogação explícitas, zero WhatsApp.");
}finally{
 await browser.close();
 server.closeAllConnections();await new Promise<void>(ok=>server.close(()=>ok()));
 await rm(dir,{recursive:true,force:true});
}
