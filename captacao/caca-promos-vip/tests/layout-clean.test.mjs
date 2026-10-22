import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { iniciarServidor } from '../src/server.mjs';
const require=createRequire(import.meta.url);
const { chromium }=require('../../../node_modules/playwright');

test('all six local screens share the same accessible sidebar and keep their controls',async t=>{
  const dataDir=mkdtempSync(join(tmpdir(),'cpv-layout-clean-'));
  t.after(()=>rmSync(dataDir,{recursive:true,force:true}));
  const app=await iniciarServidor({port:0,host:'127.0.0.1',dataDir,whatsappWorkerTeste:true});
  t.after(()=>new Promise(resolve=>app.servidor.close(resolve)));
  const screens=[
    ['/inicio','Início','cleanAuthorized'],
    ['/enviar','Enviar convite','quickChooseSelf'],
    ['/respostas-botoes','Respostas','rbAutoEnable'],
    ['/contatos','Contatos','reactivateTestForm'],
    ['/campanhas','Filas e envios','appView'],
    ['/denuncias','Segurança','reportFilters'],
  ];
  for(const [route,title,key] of screens){
    const response=await fetch(app.base+route);
    assert.equal(response.status,200,route);
    const html=await response.text();
    assert.match(html,/data-layout="clean"/,route);
    assert.match(html,/id="cleanSidebar"/,route);
    assert.match(html,/id="cleanMenuButton"/,route);
    assert.match(html,/layout-clean\.css/,route);
    assert.match(html,/layout-clean\.js/,route);
    assert.match(html,/Local \(ACER\)/,route);
    assert.match(html,new RegExp('id="'+key+'"'),route);
    assert.match(html,new RegExp('aria-current="page"[^>]*>'),route);
    assert.match(html,new RegExp(title,'i'),route);
    assert.match(html,/href="\/contatos#reativar-teste"/,route);
  }
  for(const asset of ['/assets/layout-clean.css','/assets/layout-clean.js']){
    const response=await fetch(app.base+asset);
    assert.equal(response.status,200,asset);
    assert.ok((await response.text()).length>800);
  }
});
test('clean dashboard is light, side menu is usable, no desktop/mobile overflow',{timeout:65000},async t=>{
  const dataDir=mkdtempSync(join(tmpdir(),'cpv-layout-browser-'));
  const app=await iniciarServidor({port:0,host:'127.0.0.1',dataDir,whatsappWorkerTeste:true});
  let browser;
  t.after(async()=>{
    try{await browser?.close();}catch{}
    app.servidor.closeAllConnections();
    await new Promise(resolve=>app.servidor.close(resolve));
    rmSync(dataDir,{recursive:true,force:true});
  });
  browser=await chromium.launch({
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless:true,
  });
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(app.base+'/inicio',{waitUntil:'domcontentloaded'});
  await page.locator('.clean-action').first().waitFor();
  await page.waitForFunction(()=>document.querySelector('#cleanAuthorized')?.textContent !== '—');
  assert.equal(await page.locator('#cleanReplies').innerText(),'0');
  const desktop=await page.evaluate(()=>({
    scroll:document.documentElement.scrollWidth,
    client:document.documentElement.clientWidth,
    bg:getComputedStyle(document.body).backgroundColor,
    panel:getComputedStyle(document.querySelector('.clean-home-panel')).backgroundColor,
    side:getComputedStyle(document.querySelector('.clean-sidebar')).backgroundColor,
    sidebarWidth:document.querySelector('.clean-sidebar').getBoundingClientRect().width,
    hiddenOriginal:getComputedStyle(document.querySelector('.site-header')).display,
    navCount:document.querySelectorAll('.clean-sidebar .clean-nav-link').length,
  }));
  assert.ok(desktop.scroll<=desktop.client+2,JSON.stringify(desktop));
  assert.equal(desktop.bg,'rgb(246, 248, 251)');
  assert.equal(desktop.panel,'rgb(255, 255, 255)');
  assert.ok(desktop.sidebarWidth>=220);
  assert.equal(desktop.hiddenOriginal,'none');
  assert.equal(desktop.navCount,6);
  await page.locator('.clean-sidebar a[href="/enviar"]').click();
  await page.locator('#quickChooseSelf').waitFor();
  const readable=await page.evaluate(()=>{
    const font=selector=>parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    return {
      choice:font('.quick-choice strong'),
      choiceHelp:font('.quick-choice small'),
      step:font('.quick-progress-item b'),
      label:font('.quick-field-label'),
      intro:font('.quick-intro p'),
      breadcrumb:font('.clean-topbar-breadcrumb'),
      input:font('#quickPhone'),
      height:document.querySelector('#quickPhone').getBoundingClientRect().height,
      chosenText:getComputedStyle(document.querySelector('.quick-choice.is-chosen strong')).color,
    };
  });
  assert.ok(readable.choice>=16&&readable.choiceHelp>=13,JSON.stringify(readable));
  assert.ok(readable.step>=13&&readable.label>=14&&readable.intro>=15,JSON.stringify(readable));
  assert.ok(readable.input>=16&&readable.height>=50,JSON.stringify(readable));
  assert.ok(readable.breadcrumb>=14,JSON.stringify(readable));
  assert.notEqual(readable.chosenText,'rgb(241, 249, 252)',JSON.stringify(readable));
  assert.equal(await page.locator('.clean-sidebar .clean-nav-link[aria-current="page"]').innerText(),'Enviar convite');
  assert.equal(await page.locator('.quick-aside').isVisible(),false);
  assert.equal(await page.locator('.quick-panel').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
  await page.goto(app.base+'/campanhas');
  await page.locator('#appView').waitFor();
  assert.equal(await page.locator('.surface').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
  await page.goto(app.base+'/respostas-botoes');
  await page.locator('#rbAutoEnable').waitFor();
  await page.goto(app.base+'/contatos#reativar-teste');
  await page.locator('#reactivateTestPhone').waitFor();
  assert.equal(await page.locator('.clean-sidebar .clean-subnav').isVisible(),true);
  assert.deepEqual(errors,[]);
  await page.setViewportSize({width:390,height:844});
  await page.goto(app.base+'/inicio');
  await page.locator('#cleanMenuButton').waitFor();
  assert.equal(await page.locator('#cleanMenuButton').isVisible(),true);
  assert.equal(await page.locator('#cleanMenuButton').getAttribute('aria-expanded'),'false');
  await page.locator('#cleanMenuButton').click();
  assert.equal(await page.locator('#cleanMenuButton').getAttribute('aria-expanded'),'true');
  await page.waitForFunction(() => document.querySelector('.clean-sidebar').getBoundingClientRect().left >= -2);
  assert.equal(await page.locator('.clean-sidebar .clean-nav-link').first().isVisible(),true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#cleanMenuButton').getAttribute('aria-expanded'),'false');
  await page.locator('#cleanMenuButton').click();
  await page.locator('.clean-sidebar .clean-nav-link[href="/contatos"]').click();
  await page.locator('#contactsBody').waitFor();
  assert.equal(await page.locator('#cleanMenuButton').getAttribute('aria-expanded'),'false');
  const mobile=await page.evaluate(()=>({
    scroll:document.documentElement.scrollWidth,
    client:document.documentElement.clientWidth,
    main:document.querySelector('.main-area').getBoundingClientRect().left,
  }));
  assert.ok(mobile.scroll<=mobile.client+2,JSON.stringify(mobile));
  assert.ok(mobile.main>=0);
});
