import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {iniciarServidor} from '../src/server.mjs';
const require=createRequire('C:\\projeto01\\package.json');
const {chromium}=require('playwright');

test('Chrome fictício: resultado incerto exige conciliação e nunca reenviará sozinho',async t=>{
  process.env.CPV_WHATSAPP_MOCK_FAIL_AFTER_CLICK='true';
  t.after(()=>delete process.env.CPV_WHATSAPP_MOCK_FAIL_AFTER_CLICK);
  const dir=mkdtempSync(join(tmpdir(),'cpv-ui-incerto-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const app=await iniciarServidor({port:0,dataDir:dir,metaAmbiente:{},
    whatsappWorkerTeste:true});
  t.after(()=>new Promise(resolve=>app.servidor.close(resolve)));
  app.contatos.configurarRemetente('11999998888');
  const c=app.contatos.cadastrar({
    nome:'Teste Autorizado',telefone:'11988887777',
    origem:'teste',consentimento:true,
  });
  const contato=app.contatos.listar()[0];
  app.contatos.confirmar({id:contato.id,codigo:c.codigo,
    evidencia:'mensagem-recebida'});
  const browser=await chromium.launch({headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1100,height:830}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>{
    if(d.type()==='prompt')d.accept('NÃO ENVIEI');
    else d.accept();
  });
  await page.goto(app.base+'/campanhas',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#singleText')?.value.length>40);
  await page.locator('#groupLink').fill('https://chat.whatsapp.com/GrupoSimulado009');
  await page.locator('#saveSingle').click();
  await page.locator('#importFile').setInputFiles({
    name:'teste.csv',mimeType:'text/csv',
    buffer:Buffer.from('nome;telefone\nTeste Autorizado;11988887777'),
  });
  await page.waitForFunction(()=>document.querySelector('#cloudEligible').textContent.startsWith('1'));
  await page.locator('#createManualQueue').click();
  await page.locator('#manualQueueDetail').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Preparar conversa'}).click();
  await page.waitForFunction(()=>!document.querySelector('#chromeSend').disabled,
    {timeout:25000});
  await page.locator('#chromeSend').click();
  await page.getByRole('button',{name:'Conferi: foi enviado'}).waitFor({
    state:'visible',timeout:25000,
  });
  assert.equal(await page.locator('#manualComposer').isHidden(),true);
  assert.match(await page.locator('#manualQueueSummary').innerText(),
    /1 resultados incertos/);
  const listas=await (await fetch(app.base+
    '/api/local/campanhas/convite/filas')).json();
  assert.equal(listas.filas[0].incertos,1);
  assert.equal(listas.filas[0].manuais,0);
  await page.getByRole('button',{name:'Conferi: foi enviado'}).click();
  await page.waitForFunction(()=>document.querySelector('#manualQueueSummary')
    .textContent.includes('1 confirmados'));
  assert.equal(await page.getByRole('button',{name:'Preparar conversa'}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Conferi: foi enviado'}).count(),0);
  const final=await (await fetch(app.base+
    '/api/local/campanhas/convite/filas')).json();
  assert.equal(final.filas[0].incertos,0);
  assert.equal(final.filas[0].manuais,1);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,mock:true,realMessages:0,
    reviewRequired:true,noAutoRetry:true}));
});
