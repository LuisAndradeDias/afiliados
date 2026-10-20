import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {iniciarServidor} from '../src/server.mjs';

const require=createRequire('C:\\projeto01\\package.json');
const {chromium}=require('playwright');
const csv='Telefone;Grupo;Coletado em;Autorizado para envio\\n'+
  '21900000000;Grupo WhatsApp;16/10/2026 16:58;SIM - consentimento declarado pelo responsavel\\n'+
  '11988887777;Grupo WhatsApp;16/10/2026 16:58;\\n'+
  '31999997777;Grupo WhatsApp;16/10/2026 16:58;NAO';

test('planilha com coluna de autorizacao usa somente SIM e exige confirmacao do operador',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cpv-csv-sim-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const app=await iniciarServidor({port:0,dataDir:dir,metaAmbiente:{}});
  t.after(()=>new Promise(resolve=>app.servidor.close(resolve)));
  const browser=await chromium.launch({headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1170,height:860}});
  const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!r.url().startsWith(app.base))external.push(r.url())});
  await page.goto(app.base+'/campanhas',{waitUntil:'domcontentloaded'});
  await page.locator('#importFile').setInputFiles({
    name:'autorizacoes.csv',mimeType:'text/csv',buffer:Buffer.from(csv.replaceAll('\\n','\n')),
  });
  await page.waitForFunction(()=>document.querySelector('#metricImported')?.textContent==='1');
  assert.equal(await page.locator('#metricEligible').innerText(),'0');
  assert.match(await page.locator('#feedback').innerText(),/2 sem SIM excluídos/);
  assert.match(await page.locator('#consentImportResult').innerText(),/O arquivo declara SIM para 1 contato/);
  assert.equal(await page.locator('#createManualQueue').isDisabled(),true);
  assert.equal(await page.locator('#confirmConsentImport').isDisabled(),true);
  await page.locator('#consentOrigin').fill('Conversa individual com o titular');
  await page.locator('#consentDate').fill('2026-10-10');
  await page.locator('#consentReference').fill('Declaracao documentada de consentimento ficticio');
  await page.locator('#consentDeclaration').check();
  await page.locator('#confirmConsentImport').click();
  await page.waitForFunction(()=>document.querySelector('#metricEligible')?.textContent==='1');
  const autorizados=(await (await fetch(app.base+
    '/api/local/campanhas/destinatarios')).json()).destinatarios;
  assert.equal(autorizados.length,1);
  assert.equal(autorizados[0].telefone,'5521900000000');
  assert.equal(await page.locator('#createManualQueue').isEnabled(),true);
  await page.locator('#importFile').setInputFiles({
    name:'reimportada.csv',mimeType:'text/csv',buffer:Buffer.from(csv.replaceAll('\\n','\n')),
  });
  await page.waitForFunction(()=>document.querySelector('#consentImportResult')
    ?.textContent.includes('já estão autorizados'));
  assert.equal(await page.locator('#metricEligible').innerText(),'1');
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
});
