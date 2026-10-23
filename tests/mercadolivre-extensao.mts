import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const source=await readFile("browser-extension/mercadolivre-affiliate/content.js","utf8");
const browser=await chromium.launch({channel:"chrome",headless:true});
async function fixture(path,html){
  const page=await browser.newPage();
  await page.route("https://www.mercadolivre.com.br"+path,route=>route.fulfill({
    status:200,contentType:"text/html; charset=utf-8",body:html
  }));
  await page.addInitScript(()=>{
    window.__meliJobResult=null;
    window.__meliGetJobCalls=0;
    const job={id:"TEST-JOB-123",urlProduto:"https://www.mercadolivre.com.br/p/MLBTEST123",status:"pending"};
    Object.defineProperty(window,"chrome",{configurable:true,value:{runtime:{
      lastError:null,
      sendMessage(message,callback){
        if(message.type==="getJob"){window.__meliGetJobCalls++;queueMicrotask(()=>callback({ok:true,job}));return;}
        if(message.type==="result"){window.__meliJobResult=message;queueMicrotask(()=>callback({ok:true}));return;}
        queueMicrotask(()=>callback({ok:true}));
      }
    }}});
  });
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
  assert.equal(await page.locator("textarea").inputValue(),"https://www.mercadolivre.com.br/p/MLBTEST123");
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

  const page3=await fixture("/p/MLBTEST123",`<html><body><input type="text" placeholder="Buscar produtos">
    <button>Comprar agora</button></body></html>`);
  await page3.waitForTimeout(2200);
  assert.equal(await page3.evaluate(()=>window.__meliGetJobCalls),0);
  assert.equal(await page3.evaluate(()=>window.__meliJobResult),null);
  await page3.close();
  console.log("mercadolivre-extensao: links oficiais simulados, etiqueta unica e aba segura OK");
}finally{await browser.close();}
