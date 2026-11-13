import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, normalize, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:\\projeto01\\package.json');
const {chromium} = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const server = createServer((req,res)=>{
  const path = normalize(join(root,decodeURIComponent((req.url||'/').split('?')[0]).replace(/^\/+/,'')));
  if(!path.startsWith(root+sep)||!existsSync(path)){res.writeHead(404);res.end();return;}
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css',
    '.wasm':'application/wasm','.gz':'application/gzip'}[extname(path)]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});
  res.end(readFileSync(path));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
let browser;
try {
  browser=await chromium.launch({headless:true,executablePath:chrome});
  const page=await browser.newPage({viewport:{width:360,height:900},acceptDownloads:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.__scripts=0;
    window.__fixtureText='Pesquisar membros\n~ Pessoa Exemplo A\n+55 11 98888-7777';
    window.chrome={
      runtime:{getURL:path=>'http://127.0.0.1/test/'+path},
      tabs:{query:async()=>[{id:101,url:'https://web.whatsapp.com',windowId:1}]},
      scripting:{executeScript:async query=>{
        window.__scripts++;
        if(query.files) return [{result:null}];
        return [{result:{ok:true,texto:window.__fixtureText,quantidadeLinhas:3}}];
      }}
    };
  });
  await page.goto('http://127.0.0.1:'+port+'/sidepanel.html',{waitUntil:'domcontentloaded'});
  await page.locator('#readPopup').click();
  assert.match(await page.locator('#statusText').textContent(),/Confirme/);
  assert.equal(await page.evaluate(()=>window.__scripts),0);
  await page.locator('#consent').check();
  await page.locator('#readPopup').click();
  assert.match(await page.locator('#recognized').inputValue(),/Pessoa Exemplo A/);
  assert.match(await page.locator('#recognized').inputValue(),/98888-7777/);
  assert.equal(await page.evaluate(()=>window.__scripts),2);
  await page.evaluate(()=>{
    window.__fixtureText='Pesquisar membros\n~ Pessoa Exemplo B\n+55 21 99999-7777';
  });
  await page.locator('#readPopup').click();
  await page.locator('#analyze').click();
  assert.equal(await page.locator('#count').textContent(),'2');
  const downloadEvent=page.waitForEvent('download',{timeout:6000}).catch(()=>null);
  await page.locator('#export').click();
  const download=await downloadEvent;
  if (!download) throw new Error('CSV download missing: errors='+JSON.stringify(errors)+' status='+await page.locator('#statusText').textContent());
  const csv=readFileSync(await download.path(),'utf8');
  assert.match(csv,/nome;telefone/);
  assert.match(csv,/5511988887777/);
  assert.match(csv,/5521999997777/);
  assert.equal(csv.split(/\r?\n/).filter(Boolean).length,3);
  const width=await page.evaluate(()=>({
    viewport:document.documentElement.clientWidth,
    page:document.documentElement.scrollWidth,
  }));
  assert.ok(width.page<=width.viewport+2,JSON.stringify(width));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,button:'readPopup',clipboard:false,
    snippets:2,uniquePhones:2,csv:true,responsive:width,jsErrors:errors.length}));
} finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
