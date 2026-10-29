import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium } from "playwright";
import { responderRotaVisual } from "../src/painel/rotas-visuais.js";

const pages = [
  { route:"/", current:"/", marker:"#metricCandidates" },
  { route:"/central", current:"/", marker:"#metricCandidates" },
  { route:"/ofertas", current:"/ofertas", marker:"#launchCard" },
  { route:"/revisao", current:"/revisao", marker:"#metricAll" },
  { route:"/shopee", current:"/shopee", marker:"#shopeeForm" }
];

const server = createServer(async (req,res) => {
  if(req.url === "/api/status" && req.method === "GET"){
    res.writeHead(200, {"content-type":"application/json"});
    res.end(JSON.stringify({
      operacaoEstado:"paused",
      monitorAlternadoAtivo:false,
      monitorAlternadoProximaPlataforma:"amazon",
      ofertaPreparada:false,
      whatsappAutoEnvioAtivo:false
    }));
    return;
  }
  if(req.url === "/api/revisao" && req.method === "GET"){
    res.writeHead(200, {"content-type":"application/json"});
    res.end(JSON.stringify({
      modo:"somente-leitura",
      resumo:{candidatos:0,bloqueados:0,necessitamRevisao:0,aprovados:0},
      fichas:[],avisos:[],consultadoEm:new Date().toISOString()
    }));
    return;
  }
  if(await responderRotaVisual({
    method:req.method,pathname:req.url ?? "/",res,raiz:process.cwd()
  })) return;
  res.writeHead(404, {"content-type":"application/json"});
  res.end("{}");
});
await new Promise<void>(ok=>server.listen(0,"127.0.0.1",ok));
const address=server.address();
if(!address || typeof address==="string")throw Error("Sem porta");
const base="http://127.0.0.1:"+address.port;
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
try{
  browser=await chromium.launch({channel:"chrome",headless:true});
  for(const viewport of [{width:1330,height:900},{width:390,height:844}]){
    for(const item of pages){
      const page=await browser.newPage({viewport});
      const response=await page.goto(base+item.route,{waitUntil:"domcontentloaded"});
      assert.equal(response?.status(),200,item.route);
      await page.locator('#sidebar[data-cpv-nav="true"]').waitFor();
      assert.equal(await page.locator(item.marker).count(),1,item.marker);
      const links=page.locator("#sidebar nav a");
      for(const href of ["/","/ofertas","/revisao","/shopee"]){
        assert.equal(await links.filter({has:page.locator('span')}).count()>=0,true);
        assert.equal(await page.locator('#sidebar nav a[href="'+href+'"]').count(),1,
          item.route+" precisa de "+href);
      }
      const current=page.locator('#sidebar nav a[aria-current="page"]');
      assert.equal(await current.count(),1,item.route+" deve ter 1 menu ativo");
      assert.equal(await current.getAttribute("href"),item.current);
      const titlePx = await page.locator("h1").first().evaluate((x) =>
        parseFloat(getComputedStyle(x).fontSize));
      assert.ok(titlePx >= 27 && titlePx <= 35,
        item.route+" deve usar tipografia Lovable: "+titlePx+"px");
      const navHeight=await current.evaluate(x=>x.getBoundingClientRect().height);
      assert.ok(navHeight>=43.5,"Menu clicavel deve ter 44px ("+navHeight+")");
      if(viewport.width<500){
        const btn=page.locator("#menuBtn");
        assert.equal(await btn.getAttribute("aria-expanded"),"false");
        await btn.click();
        assert.equal(await btn.getAttribute("aria-expanded"),"true");
        assert.equal(await page.locator("#sidebar").evaluate(x=>x.classList.contains("open")),true);
        await page.keyboard.press("Escape");
        assert.equal(await btn.getAttribute("aria-expanded"),"false");
      }
      const overflow=await page.evaluate(()=>({
        width:document.documentElement.scrollWidth,
        viewport:window.innerWidth
      }));
      assert.ok(overflow.width<=overflow.viewport+2,item.route+" overflow "+JSON.stringify(overflow));
      if(item.route === "/" || item.route === "/central") {
        assert.equal(await page.locator('input[type="password"]').count(),0);
      }
      await page.close();
    }
  }
  console.log("ux-lovable-visual: OK (5 rotas, 2 resolucoes, menu responsivo, sem login)");
}finally{
  await browser?.close();
  await new Promise<void>((ok,no)=>server.close(e=>e?no(e):ok()));
}
