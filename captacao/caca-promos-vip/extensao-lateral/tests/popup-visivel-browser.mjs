import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:\\projeto01\\package.json');
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
});
let page;
try {
  page = await browser.newPage({ viewport:{ width:1120, height:720 } });
  const fixture = `<!doctype html><html><head><style>
    body{margin:0;background:#f4f4f4;font:14px Arial}
    .outside{position:absolute;left:790px;top:50px}
    .dialog,[role=dialog]{position:absolute;left:220px;top:27px;width:410px;
      height:560px;background:white;box-sizing:border-box;padding:16px}
    .head{height:44px;font-size:18px}
    input{width:95%;height:38px}
    .list{height:412px;overflow-y:auto;margin-top:10px}
    .member{height:90px;border-bottom:1px solid #eee;
      display:flex;flex-direction:column;gap:10px;justify-content:center}
    .phone{font-size:12px;color:#555;padding-left:110px}
  </style></head><body>
    <div class=outside><span>Mensagem fora +55 11 90000-0000</span></div>
    <div role=dialog class=dialog>
      <div class=head><span>Pesquisar membros</span></div>
      <input placeholder="Pesquisar contatos">
      <div class=list>
        <div class=member><b>~ Pessoa A</b><span class=phone>+55 11 98888-7777</span></div>
        <div class=member><b>~ Pessoa B</b><span class=phone>+55 21 99999-7777</span></div>
        <div class=member><b>~ Pessoa C</b><span class=phone>+55 31 98888-7777</span></div>
        <div class=member><b>~ Pessoa D</b><span class=phone>+55 41 99999-7777</span></div>
        <div class=member><b>~ Pessoa E</b><span class=phone>+55 51 98888-7777</span></div>
        <div class=member><b>~ Pessoa F</b><span class=phone>+55 61 99999-7777</span></div>
        <div class=member hidden><span class=phone>+55 81 97777-0000</span></div>
      </div>
    </div>
    </body></html>`;
  await page.route('https://web.whatsapp.com/prova-local', route =>
    route.fulfill({status:200,contentType:'text/html',body:fixture}));
  await page.goto('https://web.whatsapp.com/prova-local',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({path:join(root,'popup-visivel.js')});
  const primeira = await page.evaluate(() => globalThis.CPVPopup.lerTextoDoPopupVisivel());
  assert.equal(primeira.ok,true,primeira.mensagem);
  assert.match(primeira.texto,/Pessoa A/);
  assert.match(primeira.texto,/98888-7777/);
  assert.doesNotMatch(primeira.texto,/90000-0000/, 'Nunca ler conversa fora do popup');
  assert.doesNotMatch(primeira.texto,/97777-0000/, 'Nunca ler hidden');
  assert.doesNotMatch(primeira.texto,/Pessoa F/, 'Nao incluir elemento fora da lista visivel');
  await page.locator('.list').evaluate(el=>{el.scrollTop=el.scrollHeight;});
  const segunda = await page.evaluate(() => globalThis.CPVPopup.lerTextoDoPopupVisivel());
  assert.equal(segunda.ok,true);
  assert.match(segunda.texto,/Pessoa F/);
  assert.doesNotMatch(segunda.texto,/90000-0000/);
  assert.doesNotMatch(segunda.texto,/97777-0000/);
  await page.locator('[role="dialog"]').evaluate(el=>el.removeAttribute('role'));
  const semRole = await page.evaluate(() => globalThis.CPVPopup.lerTextoDoPopupVisivel());
  assert.equal(semRole.ok,true,semRole.mensagem);
  assert.match(semRole.texto,/Pessoa F/);
  console.log(JSON.stringify({
    ok:true,primeiraLinhas:primeira.quantidadeLinhas,
    segundaLinhas:segunda.quantidadeLinhas,
    chatExcluido:true,ocultosExcluidos:true,rolagemManual:true,
  }));
} finally {
  if(page) await page.close();
  await browser.close();
}
