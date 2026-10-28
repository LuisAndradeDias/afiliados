import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const source=await readFile("browser-extension/mercadolivre-affiliate/content.js","utf8");
const browser=await chromium.launch({channel:"chrome",headless:true});
async function fixture(path,html,productUrl="https://www.mercadolivre.com.br/p/MLB123456"){
  const page=await browser.newPage();
  await page.route("https://www.mercadolivre.com.br"+path,route=>route.fulfill({
    status:200,contentType:"text/html; charset=utf-8",body:html
  }));
  await page.addInitScript((productUrl)=>{
    window.__meliJobResult=null;
    window.__meliGetJobCalls=0;
    const job={id:"TEST-JOB-123",urlProduto:productUrl,status:"pending"};
    Object.defineProperty(window,"chrome",{configurable:true,value:{runtime:{
      lastError:null,
      sendMessage(message,callback){
        if(message.type==="getJob"){window.__meliGetJobCalls++;queueMicrotask(()=>callback({ok:true,job}));return;}
        if(message.type==="result"){window.__meliJobResult=message;queueMicrotask(()=>callback({ok:true}));return;}
        queueMicrotask(()=>callback({ok:true}));
      }
    }}});
  },productUrl);
  await page.goto("https://www.mercadolivre.com.br"+path);
  await page.addScriptTag({content:source});
  return page;
}
try{
  const page=await fixture("/afiliados",`<!doctype html><html><body>
    <form><label>Insira URLs do produto<textarea placeholder="Cole a URL do produto"></textarea></label>
    <select aria-label="Etiqueta"><option value="">Selecione etiqueta</option><option value="padrao">Padr�o</option></select>
    <button id="gen" type="button" disabled>Criar link de afiliado</button>
    </form><div id="resultado"></div>
    <script>document.querySelector('select').addEventListener('change',()=>{
      document.querySelector('#gen').disabled=false;
    });document.querySelector('#gen').addEventListener('click',()=>{
      document.querySelector('#resultado').textContent='https://meli.la/TEST123';
    });</script>
  </body></html>`);
  await page.waitForFunction(()=>Boolean(window.__meliJobResult),null,{timeout:18000});
  const result=await page.evaluate(()=>window.__meliJobResult);
  assert.ok(!result.error,"Simulacao nao deve reportar erro.");
  assert.equal(result.link,"https://meli.la/TEST123");
  assert.equal(await page.locator("select").inputValue(),"padrao");
  assert.equal(await page.locator("textarea").inputValue(),"https://www.mercadolivre.com.br/p/MLB123456");
  await page.close();

  const page2=await fixture("/afiliados",`<html><body>
    <input type="url" aria-label="Link do produto" />
    <button id="gerar" type="button">Gerar</button>
    <div id="resultado"></div>
    <script>document.querySelector('#gerar').addEventListener('click',()=>{
      document.querySelector('#resultado').textContent='https://meli.la/TEST567';
    });</script></body></html>`);
  await page2.waitForFunction(()=>Boolean(window.__meliJobResult),null,{timeout:15000});
  assert.equal((await page2.evaluate(()=>window.__meliJobResult)).link,"https://meli.la/TEST567");
  await page2.close();

  // URL de anuncio individual: o gerador so habilita apos receber input.
  const itemUrl="https://produto.mercadolivre.com.br/MLB-1234567890-fone-teste-_JM";
  const itemPage=await fixture("/afiliados/linkbuilder",`<html><body>
    <textarea aria-label="URL do produto" placeholder="Cole a URL do produto"></textarea>
    <select aria-label="Etiqueta"><option value="tag" selected>Etiqueta existente</option></select>
    <button id="itemGerar" type="button" disabled>Gerar</button>
    <div id="resultado"></div>
    <script>
      const field=document.querySelector("textarea");
      const generate=document.querySelector("#itemGerar");
      field.addEventListener("input",()=>{generate.disabled=!field.value.includes("/MLB-")});
      generate.addEventListener("click",()=>{document.querySelector("#resultado").textContent="https://meli.la/ITEMLINK001"});
    </script>
  </body></html>`,itemUrl);
  await itemPage.waitForFunction(()=>Boolean(window.__meliJobResult),null,{timeout:17000});
  const itemResult=await itemPage.evaluate(()=>window.__meliJobResult);
  assert.equal(itemResult.link,"https://meli.la/ITEMLINK001");
  assert.equal(await itemPage.locator("textarea").inputValue(),itemUrl);
  await itemPage.close();

  // URL integral como copiada da pagina real: slug nao deve ser descartado.
  const fullUrl="https://www.mercadolivre.com.br/parafusadeira-e-furadeira-impacto-the-black-tools-tb-21pw-38-cor-amarelo-frequencia-5060-hz/p/MLB38053317";
  const fullPage=await fixture("/afiliados/linkbuilder",`<html><body>
    <textarea aria-label="Insira 1 ou mais URLs de produtos"></textarea>
    <select aria-label="Etiqueta"><option value="tag" selected>Etiqueta existente</option></select>
    <button id="fullGerar" disabled>Gerar</button>
    <div id="fullResult"></div>
    <script>
      const target=document.querySelector("textarea");
      const button=document.querySelector("#fullGerar");
      target.addEventListener("input",()=>{
        button.disabled=!target.value.includes("/parafusadeira-e-furadeira-impacto-")
          || !target.value.endsWith("/p/MLB38053317");
      });
      button.addEventListener("click",()=>{
        document.querySelector("#fullResult").textContent="https://meli.la/FAKE_FULL_URL_TEST";
      });
    </script>
  </body></html>`,fullUrl);
  await fullPage.waitForFunction(()=>Boolean(window.__meliJobResult),null,{timeout:18000});
  const fullResult=await fullPage.evaluate(()=>window.__meliJobResult);
  assert.equal(fullResult.link,"https://meli.la/FAKE_FULL_URL_TEST");
  assert.equal(await fullPage.locator("textarea").inputValue(),fullUrl);
  await fullPage.close();

  // Etiqueta ja escolhida nao prova que o produto ou URL foi aceito.
  const disabledPage=await fixture("/afiliados/linkbuilder",`<html><body>
    <textarea aria-label="URL do produto" placeholder="Cole a URL do produto"></textarea>
    <select aria-label="Etiqueta"><option value="tag" selected>Etiqueta existente</option></select>
    <button disabled>Gerar</button>
  </body></html>`);
  await disabledPage.waitForFunction(()=>Boolean(window.__meliJobResult),null,{timeout:12000});
  const disabledResult=await disabledPage.evaluate(()=>window.__meliJobResult);
  assert.match(disabledResult.error,/etiqueta pode estar correta/i);
  assert.match(disabledResult.error,/URL_PRESERVADA/);
  assert.match(disabledResult.error,/ETIQUETA_SELECIONADA/);
  assert.match(disabledResult.error,/BOTAO_DISABLED/);
  assert.ok(!disabledResult.error.includes("https://"),"Diagnostico nao revela URL do usuario");
  assert.ok(!disabledResult.link);
  await disabledPage.close();

  // O proprio portal pode descartar o valor apos input e mostrar um erro.
  // Nunca copiar o texto do aviso nem a URL do produto para o diagnostico.
  const rejectedPage=await fixture("/afiliados/linkbuilder",`<html><body>
    <form><textarea aria-label="URL do produto"></textarea>
    <select aria-label="Etiqueta"><option value="tag" selected>Principal</option></select>
    <button disabled>Gerar</button>
    <span role="alert">AVISO PRIVADO: dado da conta 12345</span>
    </form>
    <script>document.querySelector("textarea").addEventListener("input",ev=>{
      ev.target.value="";
    });</script>
  </body></html>`);
  await rejectedPage.waitForFunction(()=>Boolean(window.__meliJobResult),null,{timeout:12000});
  const rejectedResult=await rejectedPage.evaluate(()=>window.__meliJobResult);
  assert.match(rejectedResult.error,/URL_DIVERGENTE/);
  assert.match(rejectedResult.error,/ALERTA_VISIVEL/);
  assert.match(rejectedResult.error,/ETIQUETA_SELECIONADA/);
  assert.ok(!rejectedResult.error.includes("12345"));
  assert.ok(!rejectedResult.error.includes("https://"));
  await rejectedPage.close();

  // Botao aria-disabled e diferente de atributo disabled nativo.
  const ariaPage=await fixture("/afiliados/linkbuilder",`<html><body>
    <input type="url" aria-label="URL do produto">
    <button aria-disabled="true">Gerar</button>
  </body></html>`);
  await ariaPage.waitForFunction(()=>Boolean(window.__meliJobResult),null,{timeout:12000});
  const ariaResult=await ariaPage.evaluate(()=>window.__meliJobResult);
  assert.match(ariaResult.error,/BOTAO_ARIA_DISABLED/);
  assert.match(ariaResult.error,/ETIQUETA_NAO_DETECTADA/);
  assert.ok(!ariaResult.error.includes("https://"));
  await ariaPage.close();

  const page3=await fixture("/p/MLBTEST123",`<html><body><input type="text" placeholder="Buscar produtos">
    <button>Comprar agora</button></body></html>`);
  await page3.waitForTimeout(2200);
  assert.equal(await page3.evaluate(()=>window.__meliGetJobCalls),0);
  assert.equal(await page3.evaluate(()=>window.__meliJobResult),null);
  await page3.close();
  console.log("mercadolivre-extensao: links oficiais simulados, etiqueta unica e aba segura OK");
}finally{await browser.close();}
