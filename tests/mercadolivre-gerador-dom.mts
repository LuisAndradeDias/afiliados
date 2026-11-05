/**
 * O conector NÃO força botão Gerar desabilitado nem fabrica link de afiliado.
 * Chrome em páginas LOCAIS fictícias; todos os comandos runtime interceptados.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const code=await readFile(join(process.cwd(),
  "browser-extension","mercadolivre-affiliate","content.js"),"utf8");
const artifactDir=join(process.cwd(),"test-results","meli");
await mkdir(artifactDir,{recursive:true});
let httpWrites=0;
const server=createServer((req,res)=>{
  if(req.method!=="GET"){httpWrites++;res.writeHead(405);res.end();return;}
  res.writeHead(200,{"content-type":"text/html"});
  res.end("<html lang='pt-BR'><head><title>Fixture Meli</title></head><body></body></html>");
});
await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
const addr=server.address();
assert.ok(addr && typeof addr!=="string");
const url="http://127.0.0.1:"+addr.port+"/afiliados";
let browser:Awaited<ReturnType<typeof chromium.launch>>|null=null;
try{
  browser=await chromium.launch({channel:"chrome",headless:true});
  for(const scenario of ["disabled","enabled"] as const){
    const ctx=await browser.newContext({
      viewport:{width:1250,height:820},reducedMotion:"reduce"
    });
    const page=await ctx.newPage();
    const jsErrors:string[]=[];
    page.on("pageerror",error=>jsErrors.push(error.message));
    // Script literal: não depende de helpers do transpiler TSX no navegador.
    await page.addInitScript({content: String.raw`
      window.__reports = [];
      window.__job = {
        id: "SIMULATED_JOB",
        urlProduto: "https://www.mercadolivre.com.br/p/MLB74501173",
        status: "pending"
      };
      window.chrome.runtime = {
        id: "TEST_EXTENSION_IN_BROWSER",
        lastError: undefined,
        sendMessage(message, callback) {
          let response = {ok:true};
          if(message.type === "getJob") response = {ok:true,job:window.__job};
          if(message.type === "result"){
            window.__reports.push(message);
            window.__job = undefined;
          }
          callback(response);
        }
      };
    `});
    await page.goto(url,{waitUntil:"domcontentloaded"});
    const enabled=scenario==="enabled";
    await page.setContent([
      '<main style="padding:40px;font:16px Arial;max-width:900px">',
      '<h2>Gerador de produtos recomendados — TESTE LOCAL</h2>',
      '<form>',
      '<label>Insira URLs das páginas de produtos</label>',
      '<textarea aria-label="Insira um ou mais URLs" rows="4" style="display:block;width:600px"></textarea>',
      '<p>Etiqueta em uso:</p>',
      enabled
        ? '<select aria-label="Etiqueta em uso"><option value="etiqueta-ficticia" selected>etiqueta-ficticia</option></select>'
        : '<button role="combobox" type="button" aria-label="Seletor" style="width:220px">etiqueta-ficticia</button>',
      '<button id="generate" type="button" ' + (enabled?"":"disabled") +
        ' style="display:block;margin-top:22px;width:140px;height:45px">Gerar</button>',
      '<div id="generated"></div>',
      '</form></main>'
    ].join(""),{waitUntil:"load"});
    await page.evaluate(()=>{
      (window as unknown as {__generateClicks:number}).__generateClicks=0;
      document.getElementById("generate")!.addEventListener("click",()=>{
        (window as unknown as {__generateClicks:number}).__generateClicks++;
        const a=document.createElement("a");
        a.href="https://meli.la/linkficticio2026";
        a.textContent=a.href;
        document.getElementById("generated")!.appendChild(a);
      });
    });
    await page.addScriptTag({content:code});
    await page.waitForFunction(()=>{
      const a=(window as unknown as {__reports:unknown[]}).__reports;
      return Array.isArray(a)&&a.length===1;
    },null,{timeout:10000});
    const result=await page.evaluate(()=>({
      report:(window as unknown as {__reports:Record<string,unknown>[]}).__reports[0],
      clicks:(window as unknown as {__generateClicks:number}).__generateClicks,
      disabled:(document.getElementById("generate") as HTMLButtonElement).disabled,
      text:document.getElementById("afiliados-auto-link-status")?.textContent||""
    }));
    if(enabled){
      assert.equal(result.clicks,1,"Botão ativo deve ter exatamente um clique no mock");
      assert.equal(result.report?.link,"https://meli.la/linkficticio2026");
      assert.ok(!result.report?.error,"Não reportar erro no caso habilitado");
    }else{
      assert.equal(result.clicks,0,"Nunca clicar em Gerar desabilitado");
      assert.equal(result.disabled,true,"O conector não altera atributo disabled");
      const error=String(result.report?.error||"");
      assert.match(error,/BOTAO_DISABLED/);
      assert.match(error,/ETIQUETA_CUSTOM_VISIVEL_NAO_VERIFICADA/,
        "Combobox customizado existente não pode ser rotulado como etiqueta ausente");
      assert.doesNotMatch(error,/etiqueta-ficticia|MLB74501173/,
        "Diagnóstico não deve enviar valores do usuário");
      assert.match(result.text,/desabilitado/i);
    }
    assert.deepEqual(jsErrors,[],scenario+": erros de JS");
    await page.screenshot({
      path:join(artifactDir,"gerador-"+scenario+".png"),
      animations:"disabled"
    });
    await ctx.close();
  }
  assert.equal(httpWrites,0,"O teste não pode enviar dados a servidores");
  console.log("MELI_GERADOR_DOM_OK: custom tag sem falso negativo, disabled preservado, link somente após clique habilitado, 0 rede/escritas reais");
}finally{
  await browser?.close();
  server.closeAllConnections();
  await new Promise<void>(resolve=>server.close(()=>resolve()));
}
