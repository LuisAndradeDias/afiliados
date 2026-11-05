/**
 * Teste visual e funcional com estado inteiramente fictício.
 * Somente POST simulado "busca-modo-set" é aceito; sem WhatsApp, APIs ou discos de operação.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { responderRotaVisual } from "../src/painel/rotas-visuais.js";
import { orcamentoBusca } from "../src/ofertas/modos-busca.js";
const root=process.cwd();
const out=join(root,"test-results","modos-busca");
await mkdir(out,{recursive:true});
const env={
  AMAZON_QUERIES_PER_RUN:"4", AMAZON_LIMIT:"20",
  MERCADOLIVRE_QUERIES_PER_RUN:"2", MERCADOLIVRE_LIMIT:"20",
  MERCADOLIVRE_SEARCH_PAGES_PER_QUERY:"2",
  MERCADOLIVRE_PRODUCTS_CHECKED_PER_QUERY:"25"
} as NodeJS.ProcessEnv;
const planos={
  media:orcamentoBusca("media",env),
  longa:orcamentoBusca("longa",env)
};
const status:Record<string,unknown>={
  operacaoEstado:"paused", monitorAlternadoAtivo:false,
  monitorAlternadoProximaPlataforma:"mercado-livre",
  monitorAlternadoSlotSegundos:60, mercadoLivreMonitorAtivo:false,
  whatsappAutoEnvioAtivo:true, whatsappAutoEnvioDelayMs:1500,
  grupo:"GRUPO SINTÉTICO", grupoConfigurado:true,
  sessaoWhatsapp:true, afiliadoConfigurado:true, afiliadoTag:"teste-20",
  mercadoLivreApiConfigurada:true, mercadoLivreExtensionConectada:false,
  mercadoLivreCuponsTotal:0,mercadoLivreCuponsAtivos:0,
  ofertaPreparada:false,whatsappRevisaoPronta:false,whatsappEnvioPendente:false,
  descontoMinimo:20,cooldownHoras:24,previewCooldownMinutos:120,
  mercadoLivreFluxoEtapa:"idle",mercadoLivreFluxoMensagem:"",
  executando:[],logs:[],imagemUrl:"",mensagem:"",
  modoBusca:"media",orcamentoBusca:planos.media,orcamentoBuscaOpcoes:planos
};
const actions:{action:string,modo:string}[]=[];
const server=createServer(async(req,res)=>{
  try{
    const path=new URL(req.url||"/","http://127.0.0.1").pathname;
    if(req.method==="GET"&&path==="/api/status"){
      res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
      res.end(JSON.stringify(status));return;
    }
    if(req.method==="POST"&&path==="/api/action"){
      let body="";
      for await(const chunk of req) body+=String(chunk);
      const parsed=JSON.parse(body) as {action:string;modo:string};
      actions.push(parsed);
      const ok=parsed.action==="busca-modo-set" &&
        ["media","longa"].includes(parsed.modo) &&
        !status.monitorAlternadoAtivo;
      if(ok){
        status.modoBusca=parsed.modo;
        status.orcamentoBusca=planos[parsed.modo as "media"|"longa"];
      }
      res.writeHead(ok?200:409,{"content-type":"application/json"});
      res.end(JSON.stringify({ok,mensagem:ok?"Modo salvo em dados fictícios":"Bloqueado"}));
      return;
    }
    if(req.method==="GET" && await responderRotaVisual({
      method:req.method,pathname:path,res,raiz:root
    })) return;
    res.writeHead(404);res.end();
  }catch(error){res.writeHead(500);res.end(String(error));}
});
await new Promise<void>(ok=>server.listen(0,"127.0.0.1",ok));
const address=server.address();
assert.ok(address && typeof address!=="string");
const base="http://127.0.0.1:"+address.port;
const browser=await chromium.launch({channel:"chrome",headless:true});
try{
  for(const width of [1595,390]){
    status.monitorAlternadoAtivo=false;
    status.operacaoEstado="paused";
    status.modoBusca="media";status.orcamentoBusca=planos.media;
    const ctx=await browser.newContext({viewport:{width,height:900},locale:"pt-BR",
      deviceScaleFactor:1,reducedMotion:"reduce"});
    await ctx.route("**/*",async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==base || !["GET","POST"].includes(route.request().method())){
        await route.abort();return;
      }
      await route.continue();
    });
    const page=await ctx.newPage(),errors:string[]=[];
    page.on("pageerror",err=>errors.push(err.message));
    const response=await page.goto(base+"/ofertas",{waitUntil:"networkidle"});
    assert.equal(response?.status(),200);
    await page.locator("#buscaMediaButton[aria-pressed=true]").waitFor();
    assert.equal(await page.locator("#buscaLongaButton").getAttribute("aria-pressed"),"false");
    assert.match(await page.locator("#buscaMediaResumo").innerText(),/Amazon: 4/);
    assert.match(await page.locator("#buscaLongaResumo").innerText(),/Amazon: 6/);
    assert.ok((await page.locator("#buscaModoNota").innerText()).includes("25"));
    assert.equal(await page.locator("#buscaLongaButton").isDisabled(),false);
    await page.screenshot({path:join(out,"busca-media-"+width+".png"),
      fullPage:true,animations:"disabled"});
    const prev=actions.length;
    await page.locator("#buscaLongaButton").click();
    await page.locator("#buscaLongaButton[aria-pressed=true]").waitFor({timeout:6000});
    assert.equal(actions.length,prev+1,"Botão precisa enviar exatamente uma alteração");
    assert.deepEqual(actions.at(-1),{action:"busca-modo-set",modo:"longa"});
    assert.equal(await page.locator("#toast").innerText(),"",
      "Seleção não deve cobrir o conteúdo com uma notificação fixa");
    assert.match(await page.locator("#buscaModoNota").innerText(),/40 produtos/);
    assert.match(await page.locator("#buscaModoNota").innerText(),/4 páginas/);
    const dimensions=await page.evaluate(()=>{
      const el=document.getElementById("buscaLongaButton")!.getBoundingClientRect();
      return {x:el.x,right:el.right,overflow:document.documentElement.scrollWidth-innerWidth};
    });
    assert.ok(dimensions.x>=0&&dimensions.right<=width+1,
      "Botões devem caber na tela: "+JSON.stringify(dimensions));
    assert.ok(dimensions.overflow<=1,"Sem rolagem horizontal em "+width+"px");
    await page.screenshot({path:join(out,"busca-longa-"+width+".png"),
      fullPage:true,animations:"disabled"});
    status.monitorAlternadoAtivo=true;
    status.operacaoEstado="scheduled";
    await page.locator("#buscaLongaButton:disabled").waitFor({timeout:4500});
    assert.equal(await page.locator("#buscaMediaButton").isDisabled(),true);
    assert.equal(await page.locator("#buscaLongaButton").getAttribute("aria-pressed"),"true");
    const beforeBlocked=actions.length;
    await page.locator("#buscaMediaButton").click({force:true}).catch(()=>{});
    assert.equal(actions.length,beforeBlocked,
      "Busca ativa não deve permitir reconfiguração via botão desabilitado");
    assert.deepEqual(errors,[],"Erro de JS na tela "+width);
    await ctx.close();
  }
  assert.ok(actions.every(x=>x.action==="busca-modo-set"),
    "Nenhuma ação de monitor, WhatsApp ou link deve ser executada");
  console.log("MODOS_BUSCA_UI_OK: 1595/390px, alternância, bloqueio em monitor ativo, contraste e zero envio.");
}finally{
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>(ok=>server.close(()=>ok()));
}
