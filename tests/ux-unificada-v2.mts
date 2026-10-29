import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium } from "playwright";
import { responderRotaVisual } from "../src/painel/rotas-visuais.js";

// Fluxos reais do frontend com APIs de teste: nenhum contato ou automacao real.
const routes = [
  { path: "/", active: "/", heading: "Painel de métricas", control: "#monitor" },
  { path: "/central", active: "/", heading: "Painel de métricas", control: "#monitor" },
  { path: "/ofertas", active: "/ofertas", heading: "Central de Ofertas", control: "#cycleToggleButton" },
  { path: "/revisao", active: "/revisao", heading: "Revisão e evidências", control: "#refresh" },
  { path: "/shopee", active: "/shopee", heading: "Shopee", control: "#shopeeForm" }
];
const navPaths = ["/", "/ofertas", "/revisao", "/shopee"];
const writes:string[] = [];
const server = createServer(async (req,res) => {
  const pathname = (req.url||"").split("?")[0];
  if(req.method !== "GET" && req.method !== "HEAD"){
    writes.push((req.method||"UNKNOWN")+" "+pathname);
    res.writeHead(405);res.end();return;
  }
  if(pathname === "/api/status"){
    res.writeHead(200,{"content-type":"application/json"});
    res.end(JSON.stringify({operacaoEstado:"paused",monitorAlternadoAtivo:false,
      monitorAlternadoProximaPlataforma:"mercado-livre",
      whatsappAutoEnvioAtivo:false,mercadoLivreMonitorAtivo:false,
      ofertaPreparada:false,executando:[]}));
    return;
  }
  if(pathname === "/api/revisao"){
    res.writeHead(200,{"content-type":"application/json"});
    res.end(JSON.stringify({modo:"somente-leitura",
      resumo:{candidatos:0,bloqueados:0,necessitamRevisao:0,aprovados:0},
      fichas:[],avisos:[],consultadoEm:"2026-10-29T12:00:00.000Z"}));
    return;
  }
  if (await responderRotaVisual({
    method:req.method,pathname,res,raiz:process.cwd()
  }))return;
  res.writeHead(404,{"content-type":"application/json"});res.end("{}");
});
await new Promise<void>(ok=>server.listen(0,"127.0.0.1",ok));
const address=server.address();
if(!address||typeof address==="string")throw Error("Porta de teste ausente");
const base="http://127.0.0.1:"+address.port;
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
try{
  browser=await chromium.launch({channel:"chrome",headless:true});
  let cases=0;
  for(const viewport of [{width:1440,height:900},{width:900,height:900},{width:390,height:844}]){
    let expectedPositions:unknown = null;
    for(const config of routes){
      const page=await browser.newPage({viewport});
      const errors:string[] = [], external:string[] = [];
      page.on("pageerror",e=>errors.push(e.message));
      page.on("request",r=>{
        const safeLocalHealth = /^http:\/\/127\.0\.0\.1:(3040|3045)\/saude$/.test(r.url()) && r.method()==="GET";
        if(!r.url().startsWith(base) && !r.url().startsWith("data:") && !safeLocalHealth)external.push(r.url());
      });
      const response=await page.goto(base+config.path,{waitUntil:"domcontentloaded"});
      assert.equal(response?.status(),200,config.path);
      await page.locator('body.cpv-v2 #sidebar[data-cpv-nav="true"]').waitFor({timeout:10000});
      await page.locator(config.control).waitFor();
      assert.equal(await page.locator('#sidebar nav a').count(),4,config.path+" needs 4 links");
      assert.deepEqual(await page.locator("#sidebar nav a").evaluateAll(anchors=>
        anchors.map(a=>a.getAttribute("href"))),navPaths,config.path+" routes");
      assert.equal(await page.locator("#sidebar .nav-title").count(),1);
      assert.equal((await page.locator("#sidebar .nav-title").innerText()).trim(),"INÍCIO");
      assert.equal(await page.locator('#sidebar [data-captacao]').count(),0);
      assert.equal(await page.locator('#sidebar nav a[href*="instagram"]').count(),0);
      assert.equal(await page.locator('#sidebar nav a[href*="#launchCard"]').count(),0);
      const current=page.locator('#sidebar nav a[aria-current="page"]');
      assert.equal(await current.count(),1);
      assert.equal(await current.getAttribute("href"),config.active);
      assert.equal(await page.locator(".ux-page-heading h1").first().innerText(),config.heading);
      if(viewport.width<860) {
        const button=page.locator("#menuBtn");
        await button.click();
        await page.waitForFunction(()=>{const s=document.querySelector("#sidebar");
          return s && Math.abs(s.getBoundingClientRect().x)<.02;});
        assert.equal(await button.getAttribute("aria-expanded"),"true");
      }
      const positions=await page.evaluate(()=>{
        const side=document.querySelector("#sidebar")!;
        const title=side.querySelector(".nav-title")!;
        const first=side.querySelector("nav a")!;
        const logo=side.querySelector(".logo")!;
        const foot=side.querySelector(".side-foot")!;
        const t=document.createRange();t.selectNodeContents(title);
        const lr=logo.getBoundingClientRect();
        const tr=t.getBoundingClientRect();
        const fr=first.getBoundingClientRect();
        const br=foot.getBoundingClientRect();
        return {
          logo:[Math.round(lr.x*10)/10,Math.round(lr.y*10)/10],
          title:[Math.round(tr.x*10)/10,Math.round(tr.y*10)/10],
          firstLink:[Math.round(fr.x*10)/10,Math.round(fr.y*10)/10],
          footer:[Math.round(br.x*10)/10,Math.round(br.y*10)/10],
          padding:getComputedStyle(title).paddingLeft,
          width:Math.round(fr.width),
          overflow:document.documentElement.scrollWidth-window.innerWidth
        };
      });
      assert.equal(positions.padding,"0px",config.path+" INICIO padding");
      assert.ok(positions.overflow<=2,config.path+" no horizontal overflow");
      if(!expectedPositions)expectedPositions=positions;
      else assert.deepEqual(positions,expectedPositions,
        "Sidebar must stay identical between routes: "+config.path);
      if(config.path==="/" || config.path==="/central"){
        assert.equal(await page.locator(".grid .module:visible").count(),3);
        const quick=await page.locator(".grid").innerText();
        assert.match(quick,/Revisão e evidências/);
        assert.match(quick,/Shopee/);
        assert.doesNotMatch(quick,/Gestão de contatos|Envios e campanhas/);
        assert.equal(await page.locator('input[type="password"]').count(),0);
      }
      if(config.path==="/ofertas"){
        assert.equal(await page.locator("#instagramCard:visible").count(),0);
        assert.equal(await page.locator("#launchCard:visible").count(),1);
        assert.equal(await page.locator("#cycleToggleButton").getAttribute("data-action"),"monitor-set");
      }
      if(config.path==="/revisao"){
        assert.equal(await page.locator("#refresh").isVisible(),true);
        assert.equal(await page.locator("#metricAll").count(),1);
      }
      if(config.path==="/shopee"){
        assert.equal(await page.locator("#shopeeTitulo").count(),1);
        assert.equal(await page.locator("#shopeeSave").count(),1);
      }
      if(viewport.width<860){
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("#menuBtn").getAttribute("aria-expanded"),"false");
      }
      assert.deepEqual(external,[],config.path+" external requests");
      assert.deepEqual(errors,[],config.path+" JS errors");
      cases++;
      await page.close();
    }
  }
  assert.deepEqual(writes,[],"No POST in UI tests");
  console.log("ux-unificada-v2: OK (15 navegacoes, shell identico, controles reais, nenhuma escrita)");
}finally{
  await browser?.close();
  await new Promise<void>((ok,fail)=>server.close(e=>e?fail(e):ok()));
}
