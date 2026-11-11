import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdir} from "node:fs/promises";
import {join} from "node:path";
import {chromium} from "playwright";
import {PipelineMeli11} from "../src/historico/meli11.js";
import {responderRotaHistorico} from "../src/painel/historico-http.js";
import {responderRotaMarketplace} from "../src/painel/historico-marketplace-http.js";
import {responderRotaVisual} from "../src/painel/rotas-visuais.js";

const screenshotDir=join(process.cwd(),"test-results","meli14-ui");
await mkdir(screenshotDir,{recursive:true});
const pipeline=new PipelineMeli11();
pipeline.iniciar();
let writes=0;
const server=createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url??"/","http://127.0.0.1").pathname;
    if(responderRotaHistorico(req.method,pathname,res,pipeline))return;
    if(responderRotaMarketplace(req.method,pathname,res))return;
    if(req.method!=="GET"){writes++;res.writeHead(405);res.end();return;}
    if(await responderRotaVisual({method:req.method,pathname,res,raiz:process.cwd()}))return;
    res.writeHead(404);res.end("not found");
  }catch{
    if(!res.headersSent)res.writeHead(500);
    res.end("not available");
  }
});
await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
const addr=server.address();
assert.ok(addr && typeof addr!=="string");
const origin="http://127.0.0.1:"+addr.port;
const browser=await chromium.launch({channel:"chrome",headless:true});
try{
  const status=await fetch(origin+"/api/historico-precos/marketplace");
  assert.equal(status.status,200);
  assert.match(status.headers.get("cache-control")??"",/no-store/);
  assert.match(status.headers.get("x-content-type-options")??"",/nosniff/);
  const parsed=await status.json();
  assert.equal(parsed.categoria,"preco_geral_marketplace");
  assert.equal(parsed.autorizacaoConfirmada,false);
  assert.equal(parsed.coletaHabilitada,false);
  assert.deepEqual(parsed.itens,[]);
  const post=await fetch(origin+"/api/historico-precos/marketplace",{method:"POST"});
  assert.equal(post.status,405);
  assert.equal(post.headers.get("allow"),"GET");
  for(const width of [1440,768,390]){
    const ctx=await browser.newContext({viewport:{width,height:900},locale:"pt-BR",
      deviceScaleFactor:1,reducedMotion:"reduce"});
    const errors:string[]=[];
    const external:string[]=[];
    const requests:string[]=[];
    await ctx.route("**/*",async route=>{
      const url=new URL(route.request().url());
      const method=route.request().method();
      if(url.origin!==origin||method!=="GET"){
        external.push(method+" "+url.origin+url.pathname);
        await route.abort();
      }else{
        requests.push(url.pathname);
        await route.continue();
      }
    });
    const page=await ctx.newPage();
    page.on("pageerror",e=>errors.push(e.message));
    page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
    const res=await page.goto(origin+"/historico-precos",{waitUntil:"networkidle"});
    assert.equal(res?.status(),200);
    assert.equal(await page.locator("#metricTotal").innerText(),"00");
    assert.equal(await page.locator("#generalView").isVisible(),false);
    assert.ok(requests.includes("/api/historico-precos/marketplace"));
    await page.locator("#paymentToggle button[data-pay='geral']").click();
    assert.equal(await page.locator("#generalView").isVisible(),true);
    assert.equal(await page.locator("#pixCartaoAnalysis").isVisible(),false);
    assert.equal(await page.locator("#pixCartaoProducts").isVisible(),false);
    assert.equal(await page.locator("#generalPrice").innerText(),"—");
    assert.match(await page.locator("#generalRows").innerText(),/Nenhuma cotação geral autorizada/);
    assert.equal(await page.locator("#generalEvidenceSource").innerText(),"Autorização pendente");
    assert.match(await page.locator(".market-constraints").innerText(),/Indeterminada/);
    assert.match(await page.locator(".market-constraints").innerText(),/Bloqueada/);
    const wide=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert.ok(wide<=2,"Overflow real "+width+": "+wide);
    await page.screenshot({path:join(screenshotDir,"geral-real-vazio-"+width+".png"),
      fullPage:true,animations:"disabled"});
    await page.locator("#modeLink").click();
    await page.waitForURL("**/historico-precos?demo=1");
    await page.locator("#paymentToggle button[data-pay='geral']").click();
    assert.equal(await page.locator("#generalCount").innerText(),"2 itens fictícios");
    assert.equal(await page.locator("#generalPrice").innerText(),"R$ 309,90");
    assert.match(await page.locator("#generalChartSummary").innerText(),/Nenhuma confirma disponibilidade/);
    assert.equal(await page.locator("#generalRows tr").count(),2);
    assert.equal(await page.locator("#metricReady").innerText(),"00");
    assert.equal(await page.locator("#metricReview").innerText(),"02");
    const screenshot=await page.screenshot({path:join(screenshotDir,"geral-demo-"+width+".png"),
      fullPage:true,animations:"disabled"});
    if(width===1440){
      const fullHeight=await page.evaluate(()=>document.documentElement.scrollHeight);
      assert.ok(fullHeight>1050,"Página deve ser longa para validar barra lateral");
      const inspector=await ctx.newPage();
      try{
        const color=await inspector.evaluate(async ({base64,y})=>{
          const img=new Image();img.src="data:image/png;base64,"+base64;await img.decode();
          const c=document.createElement("canvas");c.width=c.height=1;
          const context=c.getContext("2d");if(!context)throw Error("canvas");
          context.drawImage(img,-20,-y);
          return [...context.getImageData(0,0,1,1).data].slice(0,3);
        },{base64:screenshot.toString("base64"),y:fullHeight-18});
        assert.deepEqual(color,[23,35,51],
          "A barra lateral deve continuar escura até o final da página");
      }finally{await inspector.close();}
    }
    await page.locator("#historySearch").fill("DEMO-GERAL-002");
    assert.equal(await page.locator("#generalRows tr").count(),1);
    await page.getByRole("button",{name:/Selecionar preço geral de Produto fictício B/}).click();
    assert.equal(await page.locator("#generalPrice").innerText(),"R$ 189,90");
    await page.locator("#periodToggle button[data-period='7']").click();
    assert.match(await page.locator("#generalChartSummary").innerText(),/7 dias/);
    await page.locator("#historySearch").fill("");
    await page.locator("#paymentToggle button[data-pay='pix']").click();
    assert.equal(await page.locator("#generalView").isVisible(),false);
    assert.equal(await page.locator("#pixCartaoAnalysis").isVisible(),true);
    assert.equal(await page.locator("#currentPrice").innerText(),"R$ 289,90");
    await page.locator("#paymentToggle button[data-pay='cartao']").click();
    assert.equal(await page.locator("#currentPrice").innerText(),"R$ 314,90");
    assert.deepEqual(errors,[],"JS errors width="+width);
    assert.deepEqual(external,[],"Network violations width="+width);
    const after=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert.ok(after<=2,"Overflow after "+width+": "+after);
    await ctx.close();
    console.log("MELI14_UX_WIDTH_OK="+width);
  }
  // Ensaio de contrato: UI nao aceita dados nao licenciados ou valor publicavel.
  const ctx=await browser.newContext({viewport:{width:1366,height:850},locale:"pt-BR"});
  try{
    const page=await ctx.newPage();
    const today=new Date().toISOString().slice(0,10);
    const item={chave:"MLB123456789|sellerTest|default",itemId:"MLB123456789",
      titulo:"AMOSTRA APENAS DE TESTE",contexto:"channel_marketplace",
      modalidadePagamento:"nao_informada",disponibilidade:"indeterminada",
      serie:[{observadoEmUtc:today+"T12:00:00.000Z",
        referenciaOficialUtc:today+"T11:55:00.000Z",
        centavos:12345,modalidadePagamento:"nao_informada",
        disponibilidade:"indeterminada",podePublicar:false,
        podeCompararComoDesconto:false}]};
    let autorizado=false,invalid=false;
    await page.route("**/api/historico-precos/marketplace",async route=>{
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
        ok:true,modo:"real",categoria:"preco_geral_marketplace",
        autorizacaoConfirmada:autorizado,coletaHabilitada:autorizado,
        itens:[{...item,serie:invalid?[{...item.serie[0],podePublicar:true}]:item.serie}]
      })});
    });
    await page.goto(origin+"/historico-precos",{waitUntil:"networkidle"});
    await page.locator("#paymentToggle button[data-pay='geral']").click();
    assert.equal(await page.locator("#generalPrice").innerText(),"—");
    autorizado=true;
    await page.reload({waitUntil:"networkidle"});
    await page.locator("#paymentToggle button[data-pay='geral']").click();
    assert.equal(await page.locator("#generalPrice").innerText(),"R$ 123,45");
    assert.match(await page.locator("#generalPriceNote").innerText(),/sem estoque confirmado/);
    assert.match(await page.locator("#generalRows").innerText(),/Não publicar/);
    invalid=true;
    await page.reload({waitUntil:"networkidle"});
    await page.locator("#paymentToggle button[data-pay='geral']").click();
    assert.equal(await page.locator("#generalPrice").innerText(),"—");
  }finally{await ctx.close();}
  assert.equal(writes,0,"Endpoint de preco geral nao pode escrever");
  console.log("MELI14_UI_OK: 3 tamanhos, modo real vazio, demo, contrato, 0 escritas e sem API externa");
}finally{
  await pipeline.fechar();await browser.close();
  server.closeAllConnections();
  await new Promise<void>(resolve=>server.close(()=>resolve()));
}
