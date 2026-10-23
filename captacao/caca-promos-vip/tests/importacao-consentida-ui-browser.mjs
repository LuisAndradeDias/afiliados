import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {iniciarServidor} from '../src/server.mjs';
import {iniciarDenuncias} from '../src/denuncias.mjs';

const require=createRequire('C:\\projeto01\\package.json');
const {chromium}=require('playwright');

test('CSV declarado autorizado libera a fila sem recadastro, sem mensagens reais',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cpv-consent-csv-ui-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const app=await iniciarServidor({dataDir:dir,port:0,metaAmbiente:{}});
  t.after(()=>new Promise(done=>app.servidor.close(done)));
  const bloqueios=iniciarDenuncias(dir,app.contatos);
  bloqueios.registrar({telefone:'5531999997777',mensagemId:'bloqueio-externo-001',
    motivo:'saida-solicitada',origem:'teste'});
  const browser=await chromium.launch({headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1180,height:850}});
  const errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',req=>{
    if(!req.url().startsWith(app.base))external.push(req.url());
  });
  await page.goto(app.base+'/campanhas',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#manualQueueRequirement')
    ?.textContent.includes('faltam contatos com opt-in confirmado'),{timeout:12000});
  assert.equal(await page.locator('#createManualQueue').isDisabled(),true);
  await page.locator('#importFile').setInputFiles({
    name:'lista-consentida.csv',mimeType:'text/csv',
    buffer:Buffer.from('nome;telefone\nAutorizada A;11988887777\nAutorizada B;21999997777\nBloqueada;31999997777'),
  });
  await page.waitForFunction(()=>document.querySelector('#metricImported')?.textContent==='3');
  assert.equal(await page.locator('#createManualQueue').isDisabled(),true);
  assert.equal(await page.locator('#confirmConsentImport').isDisabled(),true);
  await page.locator('#consentOrigin').fill('Conversa individual no WhatsApp');
  await page.locator('#consentDate').fill('2026-10-10');
  await page.locator('#consentReference').fill('Mensagem de aceite arquivada no WhatsApp do operador');
  assert.equal(await page.locator('#confirmConsentImport').isDisabled(),true,
    'A declaração explícita é obrigatória para importar');
  await page.locator('#consentDeclaration').check();
  assert.equal(await page.locator('#confirmConsentImport').isEnabled(),true);
  await page.locator('#confirmConsentImport').click();
  await page.waitForFunction(()=>document.querySelector('#consentImportResult')
    ?.textContent.includes('Contatos liberados desta planilha: 2'),{timeout:12000});
  assert.match(await page.locator('#consentImportResult').innerText(),
    /Bloqueados\/descadastrados: 1/);
  assert.equal(await page.locator('#createManualQueue').isEnabled(),true);
  assert.equal(await page.locator('#metricEligible').innerText(),'2');
  assert.equal(await page.locator('#metricBlocked').innerText(),'1');
  await page.locator('#groupLink').fill('https://chat.whatsapp.com/GrupoExemplo789');
  await page.locator('#createManualQueue').click();
  await page.locator('#manualQueueDetail').waitFor({state:'visible',timeout:12000});
  assert.match(await page.locator('#manualQueueSummary').innerText(),/2 pendentes/);
  const filas=await (await fetch(app.base+'/api/local/campanhas/convite/filas')).json();
  assert.equal(filas.filas[0].modo,'web');
  assert.equal(filas.filas[0].total,2);
  assert.equal(filas.filas[0].manuais,0,'Nenhuma mensagem foi enviada');
  assert.equal(await page.locator('#chromeSend').isDisabled(),true);

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#manualQueueRequirement')
    ?.textContent.includes('nenhuma planilha foi importada'),{timeout:12000});
  await page.locator('#importFile').setInputFiles({
    name:'reimportada.csv',mimeType:'text/csv',
    buffer:Buffer.from('nome;telefone\nAutorizada A;11988887777\nAutorizada B;21999997777\nBloqueada;31999997777'),
  });
  await page.waitForFunction(()=>document.querySelector('#metricEligible')?.textContent==='2');
  assert.equal(await page.locator('#createManualQueue').isEnabled(),true,
    'A autorização permanece no backend, sem recadastro');
  await page.setViewportSize({width:390,height:844});
  const largura=await page.evaluate(()=>({
    viewport:document.documentElement.clientWidth,
    scroll:document.documentElement.scrollWidth,
  }));
  assert.ok(largura.scroll<=largura.viewport+2,JSON.stringify(largura));
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
  console.log(JSON.stringify({ok:true,autorizados:2,bloqueados:1,
    criados:2,nenhumaMensagemReal:true,largura}));
});
