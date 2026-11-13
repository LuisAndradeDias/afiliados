/** Validação visual 100% sintética do novo Caçador. NENHUM POST/DELETE. */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdtemp,mkdir,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {chromium} from "playwright";
import {responderRotaVisual} from "../src/painel/rotas-visuais.js";
import {responderRotaCacador} from "../src/painel/cacador-http.js";
import {responderRotaShopee} from "../src/painel/shopee-http.js";
import {responderRotaMeliAssistido} from "../src/painel/mercadolivre-assistido-http.js";
import {CatalogoCacador} from "../src/cacador/catalogo.js";

const root=process.cwd();
const dir=await mkdtemp(join(tmpdir(),"cpv-hunt-visual-"));
await mkdir(join(dir,"data"));
const snapshot=new CatalogoCacador(join(dir,"data","cacador-catalogo.sqlite"),
  ()=>Date.parse("2026-11-13T12:00:00Z"));
const entrada={
  canal:"Mercado Livre",produtoId:"MLB123456789",
  titulo:"Furadeira de impacto e maleta · exemplo fictício",
  vendedor:"SellerDemo",variante:"21V",pagamento:"geral",
  precoCentavos:7500,freteCentavos:0,precoAnteriorCentavos:12000,
  urlProduto:"https://www.mercadolivre.com.br/p/MLB123456789",
  urlAfiliado:"https://meli.la/demo12345",
  disponibilidade:"declarada",nota:4.7,avaliacoes:1345,
  vendidos:2100,freteGratis:true,full:true,maisVendido:true,
  cupomCodigo:"CUPOMDEMO",confirmadoManualmente:true
};
for(const date of [
  "2026-11-08T10:00:00Z","2026-11-09T10:00:00Z","2026-11-10T10:00:00Z"
]){
  snapshot.registrar({...entrada,precoCentavos:12000},
    {instanteUtc:date,origem:"snapshot-claude"});
}
snapshot.registrar(entrada,{instanteUtc:"2026-11-13T11:30:00Z",origem:"snapshot-claude"});
snapshot.fechar();
let writes=0;
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url??"/","http://127.0.0.1");
    const pathname=url.pathname;
    if(req.method!=="GET"){writes++;res.writeHead(405);res.end();return;}
    if(pathname==="/api/status"){
      res.writeHead(200,{"content-type":"application/json"});
      res.end(JSON.stringify({monitorAlternadoAtivo:false,
        operacaoEstado:"paused",whatsappAutoEnvioAtivo:false}));return;
    }
    if(await responderRotaVisual({method:req.method,pathname,res,raiz:root}))return;
    if(await responderRotaCacador({req,res,pathname,raiz:dir}))return;
    if(await responderRotaMeliAssistido({req,res,pathname,raiz:dir}))return;
    if(await responderRotaShopee({req,res,pathname,raiz:dir}))return;
    res.writeHead(404);res.end("not found");
  }catch(e){res.writeHead(500);res.end(String(e));}
});
await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
const addr=server.address();
assert.ok(addr&&typeof addr!=="string");
const base="http://127.0.0.1:"+addr.port;
const captures=join(root,"test-results","cacador-visual");
await mkdir(captures,{recursive:true});
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
try{
  browser=await chromium.launch({channel:"chrome",headless:true});
  for(const width of [1595,1280,768,390]){
    const context=await browser.newContext({
      viewport:{width,height:900},deviceScaleFactor:1,
      reducedMotion:"reduce",locale:"pt-BR"
    });
    await context.route("**/*",async route=>{
      if(route.request().method()!=="GET"){writes++;await route.abort();}
      else await route.continue();
    });
    const page=await context.newPage();
    const errors:string[]=[];
    const failed:string[]=[];
    page.on("pageerror",e=>errors.push(e.message));
    page.on("response",r=>{
      const path=new URL(r.url()).pathname;
      if(path.startsWith("/central/assets/")&&r.status()>=400)
        failed.push(path+" "+r.status());
    });
    const r=await page.goto(base+"/cacador",{waitUntil:"networkidle"});
    assert.equal(r?.status(),200);
    await page.locator("#huntTotal").getByText("1").waitFor();
    assert.equal(await page.locator("#huntReview").innerText(),"1");
    assert.equal(await page.locator("#huntCoupon").innerText(),"1");
    assert.ok(await page.locator("a[href='/cacador']").count()>=1);
    const layout=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth-innerWidth,
      top:document.querySelector(".cpv-global-top")?.getBoundingClientRect().height,
      nav:document.querySelector("#cpvUnifiedNav a[href='/cacador']")?.getAttribute("aria-current")
    }));
    assert.ok(layout.overflow<=2,"Overflow "+width+": "+layout.overflow);
    assert.ok(layout.top===78||layout.top===70);
    assert.equal(layout.nav,"page");
    await page.screenshot({
      path:join(captures,"cacador-"+width+".png"),fullPage:true,animations:"disabled"
    });
    await page.getByRole("button",{name:"Ver histórico"}).click();
    await page.locator("#huntDialog[open]").waitFor();
    assert.equal(await page.locator("#huntDetailNeverExists").count(),0);
    assert.ok((await page.locator("#huntDialogBody").innerText()).toLowerCase().includes("não"));
    await page.screenshot({
      path:join(captures,"detalhe-"+width+".png"),animations:"disabled"
    });
    await page.locator("#huntCloseDialog").click();
    await page.locator("#huntFilterCanal").selectOption("Shopee");
    await page.getByText("Nenhum produto atende aos filtros").waitFor();
    await page.locator("#huntFilterCanal").selectOption("todos");
    await page.locator("#huntShowForm").click();
    assert.equal(await page.locator("#huntFormPanel").isVisible(),true);
    assert.equal(await page.locator("#huntShowForm").getAttribute("aria-expanded"),"true");
    const confirm=await page.locator("#huntForm input[name='confirmadoManualmente']");
    assert.equal(await confirm.isChecked(),false);
    await page.locator("#huntCloseForm").click();
    assert.equal(await page.locator("#huntFormPanel").isVisible(),false);
    if(width<=860){
      await page.locator("#menuBtn").click();
      await page.locator("#sidebar.open").waitFor();
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#sidebar.open").count(),0);
    }
    assert.deepEqual(errors,[],"JS errors "+width);
    assert.deepEqual(failed,[],"Assets missing "+width);
    await context.close();
    console.log("CACADOR_VISUAL_OK width="+width+" GET_ONLY=TRUE screenshot=TRUE");
  }
  assert.equal(writes,0,"Teste visual não pode efetuar POST/DELETE");
}finally{
  await browser?.close();
  server.closeAllConnections();
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  await rm(dir,{recursive:true,force:true});
}
console.log("CACADOR_VISUAL_PASS=4 widths, filtros, modal, formulário, zero envios, zero escrita HTTP");
