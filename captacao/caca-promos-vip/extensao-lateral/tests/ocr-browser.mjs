import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:\\projeto01\\package.json');
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chromeExe = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function staticServer() {
  return createServer((req, res) => {
    const relative = decodeURIComponent((req.url || '/').split('?')[0])
      .replace(/^\/+/, '') || 'sidepanel.html';
    const file = normalize(join(root, relative));
    if (!file.startsWith(root + sep) || !existsSync(file)) {
      res.writeHead(404);res.end('Not found');return;
    }
    const mime = {
      '.html':'text/html; charset=utf-8',
      '.js':'application/javascript',
      '.css':'text/css',
      '.gz':'application/gzip',
      '.wasm':'application/wasm',
      '.png':'image/png',
    }[extname(file)] || 'application/octet-stream';
    res.setHeader('Content-Security-Policy',
      "default-src 'self' data: blob:; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; img-src 'self' data: blob:");
    res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});
    res.end(readFileSync(file));
  });
}

const server = staticServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const local = 'http://127.0.0.1:' + server.address().port;
let browser;
try {
  browser = await chromium.launch({
    headless:true,executablePath:chromeExe,
    args:['--no-first-run','--no-default-browser-check'],
  });
  const page = await browser.newPage({ viewport:{width:410,height:900} });
  const errors=[];
  const urls=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',req=>urls.push(req.url()));
  await page.goto(local+'/sidepanel.html',{waitUntil:'domcontentloaded'});
  await page.locator('#consent').check();
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width=1200;canvas.height=440;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1200,440);
    ctx.fillStyle='#131313';ctx.font='bold 38px Arial';
    ctx.fillText('Pesquisar membros',36,68);
    ctx.font='36px Arial';
    ctx.fillText('Pessoa Exemplo A',36,165);
    ctx.fillText('+55 11 98888-7777',620,165);
    ctx.fillText('Pessoa Exemplo B',36,260);
    ctx.fillText('+55 21 99999-7777',620,260);
    ctx.fillText('Pessoa Exemplo C',36,355);
    ctx.fillText('+55 31 98888-7777',620,355);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#imageFile').setInputFiles({
    name:'imagem-teste.png',mimeType:'image/png',
    buffer:Buffer.from(base64,'base64'),
  });
  await page.locator('#previewPanel').waitFor({state:'visible'});
  const rect=await page.locator('#screenshot').boundingBox();
  assert.ok(rect && rect.width>200);
  await page.mouse.move(rect.x+12,rect.y+10);
  await page.mouse.down();
  await page.mouse.move(rect.x+rect.width-12,rect.y+rect.height-12,{steps:7});
  await page.mouse.up();
  assert.equal(await page.locator('#read').isEnabled(),true);
  await page.locator('#read').click();
  await page.waitForFunction(() => document.getElementById('recognized').value.length > 18,
    {timeout:85000});
  const text=await page.locator('#recognized').inputValue();
  console.log('OCR RESULT PREVIEW:',JSON.stringify(text.slice(0,800)));
  assert.match(text,/[89]888/);
  assert.match(text,/Exemplo/i);
  await page.locator('#analyze').click();
  const count = await page.locator('#count').innerText();
  const bounds=await page.evaluate(()=>({
    viewport:document.documentElement.clientWidth,
    scroll:document.documentElement.scrollWidth,
  }));
  assert.ok(bounds.scroll <= bounds.viewport+2,JSON.stringify(bounds));
  assert.equal(errors.length,0,JSON.stringify(errors));
  assert.ok(urls.every(url=>url.startsWith(local)), 'No outside network calls');
  console.log(JSON.stringify({ocr:true,ocrChars:text.length,detectedNumbers:count,
    bounds,requests:urls.length,errors:errors.length}));
} finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
