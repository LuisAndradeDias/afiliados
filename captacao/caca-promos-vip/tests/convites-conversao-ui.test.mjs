import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {iniciarServidor} from '../src/server.mjs';

const require=createRequire('C:\\projeto01\\package.json');
const {chromium}=require('playwright');

test('painel converte fila Meta para WhatsApp Web com clique e sem enviar',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cpv-migracao-web-ui-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const app=await iniciarServidor({dataDir:dir,port:0,metaAmbiente:{}});
  t.after(()=>new Promise(resolve=>app.servidor.close(resolve)));
  app.contatos.importarConsentimentosExternos({
    pessoas:[{telefone:'22988887777',nome:''}],
    origemAutorizacao:'Conversa individual documentada',
    referenciaAutorizacao:'Mensagem de autorizacao arquivada pelo operador',
    dataAutorizacao:'2026-10-10',declaracao:true,
  });
  const autorizados=(await (await fetch(app.base+
    '/api/local/campanhas/destinatarios')).json()).destinatarios;
  const resp=await fetch(app.base+'/api/local/campanhas/convite/fila',{
    method:'POST',headers:{origin:app.base,'x-cpv-local':'1',
      'content-type':'application/json'},
    body:JSON.stringify({
      nome:'Fila oficial equivocada',
      contatoIds:autorizados.map(c=>c.id),
    }),
  });
  assert.equal(resp.status,200);
  const fila=(await resp.json()).fila;
  assert.equal(fila.modo,'meta');
  const browser=await chromium.launch({
    headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1180,height:850}});
  const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{
    if(!r.url().startsWith(app.base))external.push(r.url());
  });
  await page.goto(app.base+'/campanhas',{waitUntil:'domcontentloaded'});
  await page.locator('#advancedMeta > summary').click();
  await page.locator('#cloudQueueList button').waitFor({state:'visible'});
  await page.locator('#cloudQueueList button').click();
  const botao=page.locator('#convertCloudToWeb');
  assert.equal(await botao.isVisible(),true);
  assert.match(await page.locator('#cloudQueuePeople').innerText(),/Contato sem nome/);
  page.on('dialog',dialog=>dialog.accept());
  await botao.click();
  await page.locator('#manualQueueDetail').waitFor({state:'visible',timeout:12000});
  assert.match(await page.locator('#manualQueueSummary').innerText(),/1 pendentes/);
  await page.locator('#manualPeopleDisclosure > summary').click();
  assert.match(await page.locator('#manualQueuePeople').innerText(),/Contato sem nome/);
  assert.equal(await page.locator('#chromeSend').isDisabled(),true);
  const atualizado=(await (await fetch(app.base+
    '/api/local/campanhas/convite/fila?id='+fila.id)).json()).fila;
  assert.equal(atualizado.modo,'web');
  assert.equal(atualizado.manuais,0);
  assert.equal(atualizado.pendentes,1);
  await page.setViewportSize({width:390,height:844});
  const largura=await page.evaluate(()=>({
    viewport:document.documentElement.clientWidth,
    scroll:document.documentElement.scrollWidth,
  }));
  assert.ok(largura.scroll<=largura.viewport+2,JSON.stringify(largura));
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
});
