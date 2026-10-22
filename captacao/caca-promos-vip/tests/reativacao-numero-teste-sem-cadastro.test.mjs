import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarServidor } from '../src/server.mjs';
import { iniciarDenuncias } from '../src/denuncias.mjs';
import { contatoComConsentimento } from '../src/contatos.mjs';
import { iniciarRespostasBotoes } from '../src/respostas-botoes.mjs';

const TELEFONE='5511988887777';
const DIA=new Date().toISOString().slice(0,10);
const AUTORIZACAO={
  telefone:TELEFONE,nome:'Titular fictício de teste',
  origemAutorizacao:'Confirmação do próprio titular nesta nova etapa',
  referenciaAutorizacao:'Reautorização fictícia documentada para validar o formulário',
  dataAutorizacao:DIA,confirmado:true,novaAutorizacao:true,souTitular:true,
};
const route='/api/local/gestao/numero/reativar-teste';
async function create(t,{motivo='saida-solicitada',cadastrado=false}={}) {
  const dataDir=mkdtempSync(join(tmpdir(),'cpv-reativacao-anonima-'));
  t.after(()=>rmSync(dataDir,{recursive:true,force:true}));
  const app=await iniciarServidor({port:0,dataDir,metaAmbiente:{}});
  t.after(()=>new Promise(resolve=>app.servidor.close(resolve)));
  if(cadastrado){
    app.contatos.importarConsentimentosExternos({
      pessoas:[{telefone:TELEFONE,nome:'Titular já cadastrado'}],
      origemAutorizacao:'Autorização prévia documentada',
      referenciaAutorizacao:'Autorização fictícia original do cadastro',
      dataAutorizacao:DIA,declaracao:true,
    });
  }
  const denuncias=iniciarDenuncias(dataDir,app.contatos);
  denuncias.registrar({
    telefone:TELEFONE,mensagemId:'CLIQUE_DE_TESTE_NAO_INTERESSE_987',motivo,
    origem:'clique-botao-whatygo-validado',
  });
  return {app,denuncias,dataDir};
}
function post(base,body,headers={}) {
  return fetch(base+route,{
    method:'POST',headers:{origin:base,'x-cpv-local':'1',
      'content-type':'application/json',...headers},
    body:JSON.stringify(body),
  });
}
test('anon opt-out: new documented authorization creates contact and releases hash without erasing history',async t=>{
  const {app,denuncias}=await create(t);
  assert.equal(app.contatos.listar().length,0);
  assert.equal(denuncias.estaBloqueado(TELEFONE),true);
  const r=await post(app.base,AUTORIZACAO);
  const body=await r.json();
  assert.equal(r.status,200,JSON.stringify(body));
  assert.equal(body.resultado.desbloqueado,true);
  assert.equal(body.resultado.cadastroCriado,true);
  assert.equal(denuncias.estaBloqueado(TELEFONE),false);
  const contacts=app.contatos.listar();
  assert.equal(contacts.length,1);
  assert.equal(contatoComConsentimento(contacts[0]),true);
  assert.equal(contacts[0].registroAutorizacao.tipo,'nova-autorizacao-apos-bloqueio');
  assert.equal(contacts[0].registroAutorizacao.referencia,AUTORIZACAO.referenciaAutorizacao);
  const historic=denuncias.listar();
  assert.equal(historic[0].motivo,'reativacao-autorizada');
  assert.equal(historic[1].motivo,'saida-solicitada');
  const list=await (await fetch(app.base+'/api/local/gestao/contatos')).json();
  assert.equal(list.resumo.autorizado,1);
  assert.equal(list.resumo.bloqueiosPersistentes,0);
  assert.doesNotMatch(JSON.stringify(body),new RegExp(TELEFONE));
  assert.doesNotMatch(JSON.stringify(list),new RegExp(TELEFONE));
  const again=await post(app.base,AUTORIZACAO);
  assert.equal(again.status,400);
  assert.equal(app.contatos.listar().length,1);
});
test('a new refusal after reactivation blocks again and existing-contact route remains separate',async t=>{
  const {app,denuncias}=await create(t);
  assert.equal((await post(app.base,AUTORIZACAO)).status,200);
  denuncias.registrar({telefone:TELEFONE,mensagemId:'NOVO_CLIQUE_RECUSA_REAUTOR_001',
    motivo:'saida-solicitada',origem:'clique-botao-whatygo-validado'});
  assert.equal(denuncias.estaBloqueado(TELEFONE),true);
  assert.equal(app.contatos.listar()[0].status,'descadastrado');
  assert.equal((await post(app.base,AUTORIZACAO)).status,400);
  assert.equal(denuncias.estaBloqueado(TELEFONE),true);
});
test('no new explicit consent or false evidence cannot release anonymous blocked number',async t=>{
  const cases=[
    {...AUTORIZACAO,souTitular:false},
    {...AUTORIZACAO,confirmado:false},
    {...AUTORIZACAO,novaAutorizacao:false},
    {...AUTORIZACAO,dataAutorizacao:'2020-01-01'},
    {...AUTORIZACAO,dataAutorizacao:'2099-01-01'},
    {...AUTORIZACAO,referenciaAutorizacao:'sim'},
    {...AUTORIZACAO,telefone:'9911'},
    {...AUTORIZACAO,nome:''},
  ];
  for(const invalid of cases){
    // Each case has a fresh isolated server so the 6-attempts/hour
    // protection remains enabled and is not exhausted by the test.
    const {app,denuncias}=await create(t);
    const r=await post(app.base,invalid);
    assert.equal(r.status,400,JSON.stringify(invalid));
    assert.equal(app.contatos.listar().length,0);
    assert.equal(denuncias.estaBloqueado(TELEFONE),true);
  }
});
test('cross-origin and missing CSRF header cannot release anonymous blocked number',async t=>{
  const {app,denuncias}=await create(t);
  assert.equal((await post(app.base,AUTORIZACAO,{origin:'https://attacker.invalid'})).status,403);
  assert.equal((await post(app.base,AUTORIZACAO,{'x-cpv-local':''})).status,403);
  assert.equal(denuncias.estaBloqueado(TELEFONE),true);
});
test('administrative blocks and existing registered contacts are not eligible for the no-contact flow',async t=>{
  const admin=await create(t,{motivo:'bloqueio-administrativo'});
  assert.equal((await post(admin.app.base,AUTORIZACAO)).status,400);
  assert.equal(admin.denuncias.estaBloqueado(TELEFONE),true);
});
test('existing registered contact must use existing unlock by contact ID',async t=>{
  const {app,denuncias}=await create(t,{cadastrado:true});
  assert.equal((await post(app.base,AUTORIZACAO)).status,400);
  assert.equal(denuncias.estaBloqueado(TELEFONE),true);
});
test('contacts UI exposes guided own-number reactivation with all mandatory fields',async t=>{
  const {app}=await create(t);
  const doc=await (await fetch(app.base+'/contatos#reativar-teste')).text();
  assert.match(doc,/Reativar meu número de testes sem cadastro/);
  for(const key of ['reactivateTestPhone','reactivateTestName','reactivateTestOrigin',
    'reactivateTestReference','reactivateTestDate','reactivateTestOwner','reactivateTestConfirmed']){
    assert.match(doc,new RegExp(key));
  }
  const js=await (await fetch(app.base+'/assets/gestao.js')).text();
  assert.match(js,/iniciarReativacaoMeuTeste/);
  assert.match(js,/api\/local\/gestao\/numero\/reativar-teste/);
});

test('headless Chrome can submit the form and never triggers WhatsApp sends',async t=>{
  const { createRequire }=await import('node:module');
  const require=createRequire(import.meta.url);
  const { chromium }=require('../../../node_modules/playwright');
  const {app,denuncias}=await create(t);
  const browser=await chromium.launch({headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(app.base+'/contatos#reativar-teste');
  await page.locator('#reactivateTestPhone').fill(TELEFONE);
  await page.locator('#reactivateTestName').fill(AUTORIZACAO.nome);
  await page.locator('#reactivateTestOrigin').fill(AUTORIZACAO.origemAutorizacao);
  await page.locator('#reactivateTestReference').fill(AUTORIZACAO.referenciaAutorizacao);
  await page.locator('#reactivateTestDate').fill(AUTORIZACAO.dataAutorizacao);
  await page.locator('#reactivateTestOwner').check();
  await page.locator('#reactivateTestConfirmed').check();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#reactivateTestSubmit').click();
  await page.waitForFunction(()=>document.querySelector('#reactivateTestFeedback')?.textContent?.includes('Número reativado'));
  assert.equal(denuncias.estaBloqueado(TELEFONE),false);
  assert.equal(app.contatos.listar().length,1);
  assert.deepEqual(errors,[]);
  const overflow=await page.evaluate(()=>({client:document.documentElement.clientWidth,
    scroll:document.documentElement.scrollWidth}));
  assert.ok(overflow.scroll<=overflow.client+2,JSON.stringify(overflow));
});

test('historic denied button click is shown as reactivated, but never replayed after the unblock',async t=>{
  const {app,denuncias,dataDir}=await create(t);
  const clicks=iniciarRespostasBotoes({
    dataDir,contatos:app.contatos,denuncias,
    convites:{configuracao:()=>({grupoUrl:'https://chat.whatsapp.com/abcdefghijklmnopqrstuv'})},
  });
  const event={
    event:'ButtonClick',instanceName:'cpv-lab-remetente-4306',
    data:{
      buttonId:'aceitar_grupo',messageId:'REACTIVATEDOLDCLICK001',
      phone:TELEFONE+'@s.whatsapp.net',jid:TELEFONE+'@s.whatsapp.net',
      chat:TELEFONE+'@s.whatsapp.net',fromMe:false,
      timestamp:Math.floor(Date.now()/1000),
    },
  };
  assert.equal(clicks.receive(event).status,'impedido-bloqueado');
  assert.equal(clicks.list().registros[0].status,'impedido-bloqueado');
  assert.equal((await post(app.base,AUTORIZACAO)).status,200);
  assert.equal(clicks.list().registros[0].status,'aceite-antigo-reativado');
  assert.equal(clicks.list().total.respostasAutomaticas,0);
  assert.equal(clicks.receive(event).duplicate,true);
  assert.equal(clicks.list().total.recebido,1);
});
