import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {iniciarServidor} from '../src/server.mjs';
const require=createRequire('C:\\projeto01\\package.json');
const {chromium}=require('playwright');

test('painel abre WhatsApp mock com sessão de promoções e envia após confirmar',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cpv-auto-ui-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const app=await iniciarServidor({
    port:0,dataDir:dir,metaAmbiente:{},whatsappWorkerTeste:true,
  });
  t.after(()=>new Promise(done=>app.servidor.close(done)));
  app.contatos.configurarRemetente('11999998888');
  const cadastro=app.contatos.cadastrar({nome:'Cliente Fictício',
    telefone:'11988887777',origem:'teste',consentimento:true});
  const contato=app.contatos.listar()[0];
  app.contatos.confirmar({
    id:contato.id,codigo:cadastro.codigo,evidencia:'mensagem-recebida',
  });
  const browser=await chromium.launch({headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1100,height:850}});
  const errors=[];
  const external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{
    if(!r.url().startsWith(app.base))external.push(r.url());
  });
  page.on('dialog',d=>d.accept());
  await page.goto(app.base+'/campanhas',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#singleText')?.value.length>40);
  assert.equal(await page.locator('#useChrome').isChecked(),true);
  await page.locator('#groupLink').fill('https://chat.whatsapp.com/GrupoMock789');
  await page.locator('#saveSingle').click();
  await page.locator('#importFile').setInputFiles({
    name:'autorizados.csv',mimeType:'text/csv',
    buffer:Buffer.from('nome;telefone\nCliente Fictício;11988887777'),
  });
  await page.waitForFunction(()=>document.querySelector('#cloudEligible').textContent.startsWith('1'));
  await page.locator('#createManualQueue').click();
  await page.locator('#manualQueueDetail').waitFor({state:'visible'});
  await page.locator('#prepareNextContact').click();
  await page.locator('#manualComposer').waitFor({state:'visible'});
  await page.locator('#chromeSend').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#chromeSend').disabled,
    {timeout:25000});
  assert.equal(await page.locator('#manualMarkSent').isDisabled(),true);
  assert.match(await page.locator('#chromeStatus').innerText(),/CONFIRA/);
  // Esse clique aciona APENAS o Chrome fictício de teste.
  await page.locator('#chromeSend').click();
  await page.waitForFunction(()=>document.querySelector('#manualConfirmed').textContent
    .includes('1 envios confirmados'),{timeout:25000});
  const filas=await (await fetch(app.base+'/api/local/campanhas/convite/filas')).json();
  assert.equal(filas.filas.find(x=>x.modo==='web').manuais,1);
  assert.equal(await page.locator('#manualComposer').isHidden(),true);
  assert.equal((await (await fetch(app.base+
    '/api/local/campanhas/convite/whatsapp/estado')).json()).estado.fase,'confirmado');
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
  console.log(JSON.stringify({mock:true,confirmed:1,realMessages:0,uiErrors:0}));
});
