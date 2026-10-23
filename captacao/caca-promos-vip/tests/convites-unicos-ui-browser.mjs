import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarServidor } from '../src/server.mjs';

const require=createRequire('C:\\projeto01\\package.json');
const {chromium}=require('playwright');
const msg=[
  '🎁 Convite especial de promoções!',
  'Olá! Você autorizou receber nossos convites no WhatsApp.',
  'Venha conhecer um grupo gratuito de ofertas com descontos e cupons.',
  'Para não receber mais convites, responda SAIR.',
].join('\n');

test('painel: uma mensagem para todos, dois botões, rascunho e fila sem número',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cpv-ui-meta-unico-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const app=await iniciarServidor({port:0,dataDir:dir,metaAmbiente:{}});
  t.after(()=>new Promise(done=>app.servidor.close(done)));
  app.contatos.configurarRemetente('11999998888');
  const cadastro=app.contatos.cadastrar({
    nome:'Pessoa Autorizada',telefone:'11988887777',
    origem:'teste',consentimento:true,
  });
  const c=app.contatos.listar().find(c=>c.telefone==='5511988887777');
  app.contatos.confirmar({
    id:c.id,codigo:cadastro.codigo,evidencia:'mensagem-recebida',
  });
  app.contatos.cadastrar({
    nome:'Pessoa Sem Optin',telefone:'21999997777',
    origem:'teste',consentimento:true,
  });

  const browser=await chromium.launch({
    headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1200,height:860},acceptDownloads:true});
  const errors=[];
  const external=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',req=>{
    if(!req.url().startsWith(app.base))external.push(req.url());
  });
  await page.goto(app.base+'/campanhas',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#loginForm').count(),0);
  await page.waitForFunction(()=>document.querySelector('#singleText').value.length>40,
    {timeout:9000});
  assert.equal(await page.locator('#sendCloudBatch').isDisabled(),true);
  assert.equal(await page.locator('#metaConnectionBadge').textContent(),'Aguardando número');
  assert.equal(await page.locator('.phone-choice').count(),2);

  await page.locator('#singleText').fill(msg);
  await page.locator('#groupLink').fill('https://chat.whatsapp.com/GrupoFicticio456');
  assert.equal(await page.locator('#templateName').inputValue(),'convite_ofertas_v1');
  await page.locator('#messagePreview > summary').click();
  assert.equal(await page.locator('#singlePreview').innerText(),msg);
  await page.locator('#saveSingle').click();
  await page.waitForFunction(()=>document.querySelector('#singleSaveStatus')
    .textContent.includes('salvo em'));
  await page.locator('#advancedMeta > summary').click();
  const request=page.waitForEvent('download');
  await page.locator('#downloadModel').click();
  const download=await request;
  const content=JSON.parse(readFileSync(await download.path(),'utf8'));
  assert.equal(content.category,'MARKETING');
  assert.equal(content.components[0].text,msg);
  assert.deepEqual(content.components[1].buttons.map(b=>b.text),[
    'Entrar no grupo','Não tenho interesse',
  ]);
  assert.equal(content.components[0].text.includes('{{'),false);

  await page.locator('#importFile').setInputFiles({
    name:'lista.csv',mimeType:'text/csv',
    buffer:Buffer.from('\ufeffnome;telefone\nPessoa Autorizada;11988887777\nPessoa Sem Optin;+55 (21) 99999-7777\nDUPLICADO;+55 11 98888-7777'),
  });
  await page.waitForFunction(()=>document.querySelector('#cloudEligible').textContent.startsWith('1'));
  assert.equal(await page.locator('#cloudBlocked').textContent(),'1 fora da fila');
  await page.locator('#simulateSingle').click();
  await page.waitForFunction(()=>document.querySelector('#cloudPreviewNotice').textContent.includes('SIMULAÇÃO'));
  assert.match(await page.locator('#cloudPreviewNotice').innerText(),/Nenhum envio realizado/);
  await page.locator('#createCloudQueue').click();
  await page.locator('#cloudQueueDetail').waitFor({state:'visible',timeout:11000});
  assert.equal(await page.locator('#sendCloudBatch').isDisabled(),true);
  assert.match(await page.locator('#cloudQueueSummary').innerText(),/1 pendentes/);
  assert.equal(await page.locator('#cloudQueuePeople .list-row').count(),1);
  const queue=await (await fetch(app.base+'/api/local/campanhas/convite/filas')).json();
  assert.equal(queue.filas.length,1);
  assert.equal(queue.filas[0].total,1);

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(expected=>document.querySelector('#singleText').value===expected,
    msg);
  assert.equal(await page.locator('#singleText').inputValue(),msg);
  await page.locator('#advancedMeta > summary').click();
  assert.match(await page.locator('#cloudQueueList').innerText(),/1 pendentes/);
  await page.screenshot({path:'C:\\projeto01\\captacao\\caca-promos-vip\\dados\\previa-acer\\convite-unico-ui-qa.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  const bounds=await page.evaluate(()=>({
    viewport:document.documentElement.clientWidth,
    scroll:document.documentElement.scrollWidth,
  }));
  assert.ok(bounds.scroll<=bounds.viewport+2,JSON.stringify(bounds));
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[],'Sem conexões à Meta ou WhatsApp durante a simulação');
  console.log(JSON.stringify({
    ok:true,messageSameForAll:true,buttons:2,optin:1,blocked:1,
    saved:true,reloadPersists:true,queue:true,apiEnabled:false,
    width:bounds,errors:errors.length,externalRequests:external.length,
  }));
});
