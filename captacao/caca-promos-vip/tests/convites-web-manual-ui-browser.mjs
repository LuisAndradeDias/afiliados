import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {iniciarServidor} from '../src/server.mjs';

const require=createRequire('C:\\projeto01\\package.json');
const {chromium}=require('playwright');
test('Chrome: fila grátis abre wa.me sem enviar, confirma um e bloqueia outro',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cpv-web-ui-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const app=await iniciarServidor({port:0,dataDir:dir,metaAmbiente:{}});
  t.after(()=>new Promise(resolve=>app.servidor.close(resolve)));
  app.contatos.configurarRemetente('11999998888');
  function confirmado(nome,telefone){
    const c=app.contatos.cadastrar({nome,telefone,origem:'teste',consentimento:true});
    const item=app.contatos.listar().find(x=>x.telefone.endsWith(telefone));
    app.contatos.confirmar({id:item.id,codigo:c.codigo,evidencia:'mensagem-recebida'});
    return item;
  }
  const pessoaA=confirmado('Pessoa Fictícia A','11988887777');
  const pessoaB=confirmado('Pessoa Fictícia B','21999997777');
  app.contatos.cadastrar({nome:'Sem Autorização',telefone:'31988887777',
    origem:'teste',consentimento:true});
  const browser=await chromium.launch({headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  const jsErrors=[],external=[];
  page.on('pageerror',error=>jsErrors.push(error.message));
  page.on('request',req=>{if(!req.url().startsWith(app.base))external.push(req.url())});
  page.on('dialog',dialog=>dialog.accept());
  await page.goto(app.base+'/campanhas',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#singleText')?.value.length>40);
  assert.equal(await page.locator('#loginForm').count(),0);
  assert.match(await page.locator('#manualTitle').innerText(),/WhatsApp Web/);
  assert.match(await page.locator('#manualDaily').innerText(),/50/);
  await page.locator('#groupLink').fill('https://chat.whatsapp.com/GrupoFicticio789');
  await page.locator('#saveSingle').click();
  await page.waitForFunction(()=>document.querySelector('#singleSaveStatus').textContent.includes('salvo'));
  await page.locator('#importFile').setInputFiles({
    name:'autorizados.csv',mimeType:'text/csv',
    buffer:Buffer.from('\ufeffnome;telefone\nPessoa Fictícia A;11988887777\nPessoa Fictícia B;21999997777\nSem Autorização;31988887777'),
  });
  await page.waitForFunction(()=>document.querySelector('#cloudEligible').textContent.startsWith('2'));
  assert.match(await page.locator('#cloudBlocked').textContent(),/1 fora/);
  // Modo manual está nas opções recolhidas da interface simplificada.
  await page.locator('#sendOptions > summary').click();
  await page.locator('#useChrome').uncheck();
  await page.locator('#createManualQueue').click();
  await page.locator('#manualQueueDetail').waitFor({state:'visible',timeout:10000});
  assert.match(await page.locator('#manualQueueSummary').innerText(),/2 pendentes/);
  assert.equal(await page.locator('#manualPeopleDisclosure').getAttribute('open'),null);
  await page.locator('#manualPeopleDisclosure > summary').click();
  assert.equal(await page.locator('#manualQueuePeople .list-row').count(),2);
  assert.equal(await page.locator('#sendCloudBatch').isDisabled(),true);

  await page.getByRole('button',{name:'Preparar conversa'}).first().click();
  await page.locator('#manualComposer').waitFor({state:'visible',timeout:10000});
  const href=await page.locator('#manualOpenWa').getAttribute('href');
  assert.match(href,/^https:\/\/wa\.me\/5511988887777\?text=/);
  const msg=new URL(href).searchParams.get('text');
  assert.match(msg,/chat\.whatsapp\.com\/GrupoFicticio789/);
  assert.match(msg,/responda SAIR/);
  assert.doesNotMatch(msg,/DENUNCIAR|Denunciar mensagem/);
  assert.equal(msg,await page.locator('#manualMessageReady').inputValue());
  assert.equal(await page.locator('#manualMarkSent').isDisabled(),true);
  // Nao clica no link real do WhatsApp: nenhuma mensagem deve sair neste teste.
  await page.locator('#manualSentConfirm').check();
  await page.locator('#manualMarkSent').click();
  await page.waitForFunction(()=>document.querySelector('#manualDaily')
    .textContent.startsWith('1 /'));
  assert.match(await page.locator('#manualConfirmed').innerText(),/1 envio/);
  assert.equal(await page.locator('#manualQueuePeople .list-row').count(),2);

  await page.getByRole('button',{name:'Preparar conversa'}).click();
  await page.locator('#manualComposer').waitFor({state:'visible'});
  await page.locator('#manualComplaint').click();
  await page.waitForFunction(()=>document.querySelector('#manualQueueSummary').textContent
    .includes('1 bloqueados'));
  assert.equal(app.contatos.listar().find(c=>c.id===pessoaB.id).status,'descadastrado');
  assert.equal(app.contatos.listar().find(c=>c.id===pessoaA.id).status,'ativo');
  assert.match(await page.locator('#metaBloqueios').textContent(),/1 bloqueados/);
  await page.getByRole('button',{name:'Registrar "Não tenho interesse"'}).click();
  await page.waitForFunction(()=>document.querySelector('#manualQueueSummary')
    .textContent.includes('2 bloqueados'));
  assert.equal(app.contatos.listar().find(c=>c.id===pessoaA.id).status,'descadastrado');
  assert.match(await page.locator('#metaBloqueios').textContent(),/2 bloqueados/);

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#manualQueueList')
    .textContent.includes('envios confirmados'));
  assert.match(await page.locator('#manualQueueList').innerText(),/1 envios confirmados/);
  await page.setViewportSize({width:390,height:844});
  const size=await page.evaluate(()=>({
    client:document.documentElement.clientWidth,
    scroll:document.documentElement.scrollWidth,
  }));
  assert.ok(size.scroll<=size.client+2,JSON.stringify(size));
  assert.deepEqual(jsErrors,[]);
  assert.deepEqual(external,[],'Nenhuma chamada ao WhatsApp ou Meta durante QA');
  console.log(JSON.stringify({ok:true,modo:'wa.me',whatsappOpened:false,
    optin:2,blocked:1,manualConfirmed:1,reloadPersists:true,screen:size,
    externalRequests:external.length}));
});
