import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarServidor } from '../src/server.mjs';

const require=createRequire('C:\\projeto01\\package.json');
const {chromium}=require('playwright');

test('painel abre conexão, reconhece QR/conversas e fecha sem mensagens reais',async t=>{
  const dataDir=mkdtempSync(join(tmpdir(),'cpv-conexao-browser-'));
  t.after(()=>rmSync(dataDir,{recursive:true,force:true}));
  const app=await iniciarServidor({
    port:0,dataDir,metaAmbiente:{},whatsappWorkerTeste:true,
  });
  const base=app.base;
  t.after(async()=>{
    const status=await fetch(base+'/api/local/campanhas/convite/whatsapp/conexao/estado')
      .then(r=>r.json()).catch(()=>null);
    if(status?.estado?.ocupado){
      await fetch(base+'/api/local/campanhas/convite/whatsapp/conexao/fechar',{
        method:'POST',headers:{origin:base,'content-type':'application/json',
          'x-cpv-local':'1'},body:'{}',
      }).catch(()=>null);
    }
    await new Promise(done=>app.servidor.close(done));
  });
  const browser=await chromium.launch({headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1180,height:830}});
  const errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',req=>{
    if(!req.url().startsWith(base))external.push(req.url());
  });
  page.on('dialog',dialog=>dialog.accept());
  await page.goto(base+'/campanhas',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#whatsappConnectionBadge')
    ?.textContent.includes('Aguardando conexão'),{timeout:12000});
  assert.equal(await page.locator('#createManualQueue').isDisabled(),true);
  assert.match(await page.locator('#manualQueueRequirement').innerText(),
    /faltam contatos com opt-in confirmado/);
  await page.locator('#importFile').setInputFiles({
    name:'participantes-nao-autorizados.csv',mimeType:'text/csv',
    buffer:Buffer.from('nome;telefone\\nContato Fictício;11988887777'.replace('\\n','\n')),
  });
  await page.waitForFunction(()=>document.querySelector('#metricImported')
    ?.textContent==='1');
  assert.equal(await page.locator('#createManualQueue').isDisabled(),true);
  assert.match(await page.locator('#manualQueueRequirement').innerText(),
    /nenhum contato com autorização confirmada/);
  assert.equal(await page.locator('#whatsappConnectClose').isDisabled(),true);
  assert.equal(await page.locator('#whatsappConnectOpen').isEnabled(),true);
  await page.locator('#whatsappConnectOpen').click();
  await page.waitForFunction(()=>{
    const badge=document.querySelector('#whatsappConnectionBadge')?.textContent||'';
    return badge.includes('Escaneie o QR')||badge.includes('Conectado');
  },{timeout:22000});
  await page.waitForFunction(()=>document.querySelector('#whatsappConnectionBadge')
    ?.textContent.includes('Conectado'),{timeout:22000});
  assert.equal(await page.locator('#whatsappConnectOpen').isDisabled(),true);
  assert.equal(await page.locator('#whatsappConnectClose').isEnabled(),true);
  assert.match(await page.locator('#whatsappConnectionStatus').innerText(),/Conversas|conversas/);
  const estado=await (await fetch(base+
    '/api/local/campanhas/convite/whatsapp/conexao/estado')).json();
  assert.equal(estado.estado.fase,'conectado');
  assert.equal(estado.estado.envioHabilitado,false);
  await page.locator('#whatsappConnectClose').click();
  await page.waitForFunction(()=>document.querySelector('#whatsappConnectionBadge')
    ?.textContent.includes('Sessão preservada'),{timeout:17000});
  assert.equal(await page.locator('#whatsappConnectOpen').isEnabled(),true);
  assert.equal(await page.locator('#whatsappConnectClose').isDisabled(),true);
  const fim=await (await fetch(base+
    '/api/local/campanhas/convite/whatsapp/conexao/estado')).json();
  assert.equal(fim.estado.ocupado,false);

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#whatsappConnectionBadge')
    ?.textContent.includes('Sessão preservada'),{timeout:12000});
  await page.setViewportSize({width:390,height:844});
  const size=await page.evaluate(()=>({
    viewport:document.documentElement.clientWidth,
    scroll:document.documentElement.scrollWidth,
  }));
  assert.ok(size.scroll<=size.viewport+2,JSON.stringify(size));
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[],'Nada navega externamente durante o teste de UI');
  console.log(JSON.stringify({
    ok:true,qrMock:true,connectedMock:true,close:true,realMessages:0,
    width:size,errors:errors.length,
  }));
});
