import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire('C:\\projeto01\\package.json');
const { chromium }=require('playwright');
const extPath=join(dirname(fileURLToPath(import.meta.url)),'..');
const profile=mkdtempSync(join(extPath,'..','dados','ocr-extension-smoke-'));
let context;
try{
  context=await chromium.launchPersistentContext(profile,{
    headless:true,
    executablePath:chromium.executablePath(),
    args:['--disable-extensions-except='+extPath,'--load-extension='+extPath],
    viewport:{width:400,height:850},
  });
  const worker=context.serviceWorkers()[0] ||
    await context.waitForEvent('serviceworker',{timeout:18000});
  const id=new URL(worker.url()).hostname;
  const page=await context.newPage();
  const errs=[];
  page.on('pageerror',e=>errs.push(e.message));
  await page.goto('chrome-extension://'+id+'/sidepanel.html',{
    waitUntil:'domcontentloaded',timeout:12000});
  await page.locator('#consent').check();
  const image=await page.evaluate(()=>{
    const c=document.createElement('canvas');
    c.width=950;c.height=250;
    const x=c.getContext('2d');
    x.fillStyle='white';x.fillRect(0,0,950,250);
    x.fillStyle='#111';x.font='bold 38px Arial';
    x.fillText('Pessoa Exemplo',25,85);
    x.fillText('+55 11 98888-7777',420,85);
    x.fillText('Outra Pessoa',25,175);
    x.fillText('+55 21 99999-7777',420,175);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#imageFile').setInputFiles({
    name:'teste-sintetico.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')
  });
  await page.locator('#previewPanel').waitFor({state:'visible'});
  const rect=await page.locator('#screenshot').boundingBox();
  await page.mouse.move(rect.x+5,rect.y+5);
  await page.mouse.down();
  await page.mouse.move(rect.x+rect.width-5,rect.y+rect.height-5,{steps:5});
  await page.mouse.up();
  await page.locator('#read').click();
  await page.waitForFunction(()=>
    document.getElementById('recognized').value.length>15,{timeout:60000});
  const texto=await page.locator('#recognized').inputValue();
  assert.match(texto,/Pessoa/i);
  assert.match(texto,/98888/);
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({
    pass:true,loadedFromExtension:true,idLength:id.length,
    ocrLength:texto.length,jsErrors:errs.length,ocrPreview:texto.slice(0,140),
  },null,2));
} finally {
  if(context) await context.close();
  rmSync(profile,{recursive:true,force:true});
}
