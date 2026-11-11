/**
 * MELI-10E: teste visual e funcional com dados DEMO-ML; zero API real.
 * Executa rotas estáticas em servidor efêmero e bloqueia tráfego externo.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { responderRotaVisual } from "../src/painel/rotas-visuais.js";

const screenshotDir=join(process.cwd(),"test-results","meli10e-ui");
await mkdir(screenshotDir,{recursive:true});
let writes=0;
const server=createServer(async (req,res)=>{
  try {
    const pathname=new URL(req.url??"/","http://127.0.0.1").pathname;
    if(req.method!=="GET"){writes++;res.writeHead(405);res.end();return;}
    if(await responderRotaVisual({method:req.method,pathname,res,raiz:process.cwd()}))return;
    res.writeHead(404);res.end();
  } catch(err){res.writeHead(500);res.end(String(err));}
});
await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
const address=server.address();
assert.ok(address && typeof address!=="string");
const origin="http://127.0.0.1:"+address.port;
const browser=await chromium.launch({channel:"chrome",headless:true});
try {
  const denied=await fetch(origin+"/central/assets/qualquer-arquivo.txt");
  assert.equal(denied.status,404,"nenhum arquivo arbitrário pode ser servido");
  const pageResponse=await fetch(origin+"/historico-precos");
  assert.equal(pageResponse.status,200);
  assert.match(pageResponse.headers.get("content-security-policy")??"",/connect-src 'none'/);
  assert.match(pageResponse.headers.get("content-security-policy")??"",/script-src 'self'/);

  for(const width of [1595,1280,768,390]){
    const context=await browser.newContext({viewport:{width,height:900},
      deviceScaleFactor:1,reducedMotion:"reduce",locale:"pt-BR"});
    const requests:string[]=[];
    const errors:string[]=[];
    await context.route("**/*",async route=>{
      const url=new URL(route.request().url());
      const urlOrigin=url.origin;
      if(urlOrigin!==origin || route.request().method()!=="GET"){
        requests.push(route.request().method()+" "+urlOrigin+url.pathname);
        await route.abort();
      } else await route.continue();
    });
    const page=await context.newPage();
    page.on("pageerror",err=>errors.push(err.message));
    page.on("console",msg=>{if(msg.type()==="error")errors.push(msg.text())});
    const res=await page.goto(origin+"/historico-precos",{waitUntil:"networkidle"});
    assert.equal(res?.status(),200);
    assert.equal(await page.locator("#historyTitle").innerText(),"Histórico inteligente de preços");
    assert.equal(await page.locator("#currentPrice").innerText(),"R$ 289,90");
    assert.equal(await page.locator("#metricTotal").innerText(),"04");
    assert.equal(await page.locator("#metricReady").innerText(),"02");
    assert.equal(await page.locator("#metricReview").innerText(),"02");
    assert.equal(await page.locator("#confidenceNumber").innerText(),"3/3");
    assert.equal(await page.locator("#productRows tr").count(),4);
    assert.equal(await page.locator('#cpvUnifiedNav a[href="/historico-precos"]').getAttribute("aria-current"),"page");
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert.ok(overflow<=2,"Rolagem horizontal em "+width+": "+overflow);
    const screenshot=await page.screenshot({path:join(screenshotDir,"historico-"+width+".png"),
      fullPage:true,animations:"disabled"});
    const documentHeight=await page.evaluate(()=>document.documentElement.scrollHeight);
    // Regressao visual: a barra fixa ocupa a janela, mas seu fundo deve
    // continuar ate o fim do documento em capturas de pagina inteira.
    if(width===1595 || width===1280) {
      assert.ok(documentHeight>1000,
        "O teste precisa de uma pagina longa para detectar a falha original");
      const inspector=await context.newPage();
      try {
        const pixel=await inspector.evaluate(async ({png,y})=>{
          const img=new Image();
          img.src="data:image/png;base64,"+png;
          await img.decode();
          const canvas=document.createElement("canvas");
          canvas.width=canvas.height=1;
          const ctx=canvas.getContext("2d");
          if(!ctx)throw new Error("Canvas indisponivel no teste de pixel");
          ctx.drawImage(img,-20,-y);
          return Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3);
        }, {png:screenshot.toString("base64"),y:documentHeight-18});
        assert.deepEqual(pixel,[23,35,51],
          "A faixa lateral deve permanecer azul-marinho ate o rodape inteiro; nao pode terminar no viewport");
      } finally { await inspector.close(); }
    }
    if(width<=768) {
      const background=await page.evaluate(()=>getComputedStyle(document.body).backgroundImage);
      assert.equal(background,"none","No celular nao pode existir faixa lateral escura escondida");
    }
    await page.locator("#paymentToggle [data-pay='cartao']").click();
    assert.equal(await page.locator("#currentPrice").innerText(),"R$ 314,90");
    assert.equal(await page.locator("#paymentToggle [data-pay='cartao']").getAttribute("aria-pressed"),"true");
    await page.locator("#periodToggle [data-period='7']").click();
    assert.match(await page.locator("#chartTextSummary").innerText(),/7 dias/);
    assert.equal(await page.locator("#periodToggle [data-period='7']").getAttribute("aria-pressed"),"true");
    await page.locator("#periodToggle [data-period='90']").click();
    assert.match(await page.locator("#chartTextSummary").innerText(),/90 dias/);
    await page.locator("#historySearch").fill("DEMO-ML-002");
    assert.equal(await page.locator("#productRows tr").count(),1);
    await page.getByRole("button",{name:"Selecionar Produto fictício B"}).click();
    assert.equal(await page.locator("#currentPrice").innerText(),"—",
      "Observação sem disponibilidade não pode ser exibida como preço confirmado");
    assert.equal(await page.locator("#chartState").innerText(),"Revisar disponibilidade");
    assert.equal(await page.locator("#confidenceNumber").innerText(),"2/3");
    await page.locator("#historySearch").fill("item inexistente");
    assert.match(await page.locator("#productRows").innerText(),/Nenhum item demonstrativo/);
    if(width<=768) {
      await page.locator("#menuBtn").click();
      assert.equal(await page.locator("#menuBtn").getAttribute("aria-expanded"),"true");
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#menuBtn").getAttribute("aria-expanded"),"false");
    }
    const overflowAfter=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert.ok(overflowAfter<=2,"Rolagem horizontal após filtros em "+width+": "+overflowAfter);
    assert.deepEqual(requests,[],"Página demonstrativa tentou rede externa/ação");
    assert.deepEqual(errors,[],"Erros JS/CSP em "+width);
    await context.close();
  }
  assert.equal(writes,0,"Página demonstrativa não pode escrever ou acionar motor");
  console.log("MELI10E_UX_OK: 4 larguras, faixa lateral ate o rodape verificada por pixel, filtros, CSP, 4 capturas, 0 escritas/rede externa.");
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>(resolve=>server.close(()=>resolve()));
}
