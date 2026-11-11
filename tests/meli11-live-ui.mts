import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdir} from "node:fs/promises";
import {join} from "node:path";
import {chromium} from "playwright";
import {PipelineMeli11,type Permissao,type Observacao} from "../src/historico/meli11.js";
import {responderRotaHistorico} from "../src/painel/historico-http.js";
import {responderRotaVisual} from "../src/painel/rotas-visuais.js";

const folder=join(process.cwd(),"test-results","meli11-ui");
await mkdir(folder,{recursive:true});
let pipeline=new PipelineMeli11();
pipeline.iniciar();
const server=createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url??"/","http://127.0.0.1").pathname;
    if(responderRotaHistorico(req.method,pathname,res,pipeline))return;
    if(await responderRotaVisual({method:req.method,pathname,res,raiz:process.cwd()}))return;
    res.writeHead(404,{"content-type":"text/plain"});res.end("not found");
  }catch{if(!res.headersSent)res.writeHead(500);res.end("error");}
});
await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
const address=server.address();
assert.ok(address&&typeof address!=="string");
const root="http://127.0.0.1:"+address.port;
const browser=await chromium.launch({channel:"chrome",headless:true});
try {
  const block=await fetch(root+"/api/historico-precos");
  assert.equal(block.status,200);
  assert.match(block.headers.get("cache-control")??"",/no-store/);
  assert.deepEqual((await block.json()).itens,[]);
  assert.equal((await fetch(root+"/api/historico-precos",{method:"POST"})).status,405);
  const html=await fetch(root+"/historico-precos");
  assert.match(html.headers.get("content-security-policy")??"",/connect-src 'self'/);
  assert.ok(!(await html.text()).includes("R$ 289,90"),"O HTML real não deve exibir preço fictício");

  for(const width of [1440,768,390]){
    const context=await browser.newContext({viewport:{width,height:900},locale:"pt-BR",
      reducedMotion:"reduce",deviceScaleFactor:1});
    const errors:string[]=[];
    const external:string[]=[];
    const requested:string[]=[];
    await context.route("**/*",async route=>{
      const u=new URL(route.request().url());
      const method=route.request().method();
      if(u.origin!==root||method!=="GET"){
        external.push(method+" "+u.origin+u.pathname);
        await route.abort();
      }else{
        requested.push(u.pathname);
        await route.continue();
      }
    });
    const page=await context.newPage();
    page.on("pageerror",e=>errors.push(e.message));
    page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
    const resp=await page.goto(root+"/historico-precos",{waitUntil:"networkidle"});
    assert.equal(resp?.status(),200);
    assert.equal(await page.locator("#metricTotal").innerText(),"00");
    assert.equal(await page.locator("#currentPrice").innerText(),"—");
    assert.equal(await page.locator("#sourceStatusTitle").innerText(),"Aguardando autorização");
    assert.match(await page.locator("#sourceNotice").innerText(),/SEM DADOS REAIS/);
    assert.ok(requested.includes("/api/historico-precos"),"A tela deve ler API real");
    assert.equal(await page.locator("#productRows tr").count(),1);
    assert.match(await page.locator("#productRows tr").innerText(),/Nenhuma cotação real/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)<=2);
    await page.screenshot({path:join(folder,"hist-real-sem-fonte-"+width+".png"),
      fullPage:true,animations:"disabled"});
    await page.locator("#modeLink").click();
    await page.waitForURL("**/historico-precos?demo=1");
    assert.equal(await page.locator("#currentPrice").innerText(),"R$ 289,90");
    assert.equal(await page.locator("#metricTotal").innerText(),"04");
    assert.match(await page.locator("#sourceNotice").innerText(),/DEMONSTRAÇÃO/);
    assert.equal(await page.locator("#modeLink").innerText(),"Voltar ao histórico real");
    assert.deepEqual(errors,[],"Console/JS: "+width);
    assert.deepEqual(external,[],"Chamadas indevidas: "+width);
    await context.close();
  }
  // Ensaio de injeção autorizada: somente dados sintéticos, nunca API real.
  const agora=Date.now();
  const referencia=new Date(agora).toISOString();
  const permission:Permissao={referencia:"licenca_somente_teste",fonte:"fixture_isolado",
    escopo:"afiliados_autorizados",aprovada:true,retencaoDias:30};
  const base:Observacao={
    itemId:"MLB123456789",titulo:"AMOSTRA INTERNA — NÃO PUBLICAR",
    vendedorId:"seller_teste",varianteId:"principal",pagamento:"pix",moeda:"BRL",
    centavos:9990,observadoEm:new Date(agora-600_000).toISOString(),
    disponibilidade:"confirmada"
  };
  const lote=[{...base,centavos:12000,observadoEm:new Date(agora-2*86400000).toISOString()},
    {...base,centavos:11000,observadoEm:new Date(agora-86400000).toISOString()},base];
  const fake=new PipelineMeli11({habilitado:true,permissao:permission,
    fonte:{identificador:"fixture_isolado",async coletar(){return lote}},
    agora:()=>agora});
  await fake.executarUmaVez();
  pipeline=fake;
  const context=await browser.newContext({viewport:{width:1366,height:850},locale:"pt-BR"});
  try{
    const page=await context.newPage();
    await page.goto(root+"/historico-precos",{waitUntil:"networkidle"});
    assert.equal(await page.locator("#metricTotal").innerText(),"01");
    assert.equal(await page.locator("#currentPrice").innerText(),"R$ 99,90");
    assert.equal(await page.locator("#sourceStatusTitle").innerText(),"Fonte autorizada");
    assert.equal(await page.locator("#metricReady").innerText(),"01");
  }finally{await context.close();await fake.fechar();}
  console.log("MELI11_UI_OK: vazio real, demo opt-in e adaptador sintético; 3 larguras, zero rede externa/escritas.");
}finally{
  await pipeline.fechar();
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>(resolve=>server.close(()=>resolve()));
}
