import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { iniciarServidor } from '../src/server.mjs';
import { iniciarDenuncias } from '../src/denuncias.mjs';
import { iniciarRespostasBotoes } from '../src/respostas-botoes.mjs';

const NUMERO_CLIQUE='5528999976789';
const NUMERO_DIGITADO='5522999976789';
const NOW=new Date('2026-10-22T19:50:00.000Z');
const route='/api/local/gestao/numero/diagnostico';
const require=createRequire(import.meta.url);

async function setup(t) {
  const dataDir=mkdtempSync(join(tmpdir(),'cpv-diagnostico-local-'));
  const app=await iniciarServidor({
    port:0,host:'127.0.0.1',dataDir,
    whatsappWorkerTeste:true,agora:()=>NOW,
  });
  t.after(async()=>{
    app.servidor.closeAllConnections();
    await new Promise(resolve=>app.servidor.close(resolve));
    rmSync(dataDir,{recursive:true,force:true});
  });
  const denuncias=iniciarDenuncias(dataDir,app.contatos,()=>NOW);
  denuncias.registrar({
    telefone:NUMERO_CLIQUE,mensagemId:'OPTOUT_CLIQUE_98765',
    motivo:'saida-solicitada',origem:'clique-botao-whatygo-validado',
  });
  const listener=iniciarRespostasBotoes({
    dataDir,contatos:app.contatos,denuncias,agora:()=>NOW,
    convites:{configuracao:()=>({grupoUrl:'https://chat.whatsapp.com/abcdefghijklmnopqrstuv'})},
    enviarLink:()=>{throw Error('No WhatsApp sends in diagnostics');},
  });
  assert.equal(listener.receive({
    event:'ButtonClick',instanceName:'cpv-lab-remetente-4306',
    data:{
      buttonId:'aceitar_grupo',messageId:'DIAGNOSTICO_12345',
      phone:NUMERO_CLIQUE+'@s.whatsapp.net',
      jid:NUMERO_CLIQUE+'@s.whatsapp.net',
      chat:NUMERO_CLIQUE+'@s.whatsapp.net',
      fromMe:false,timestamp:Math.floor(NOW.getTime()/1000),
    },
  }).status,'impedido-bloqueado');
  const post=(phone,headers={})=>fetch(app.base+route,{
    method:'POST',
    headers:{origin:app.base,'x-cpv-local':'1','content-type':'application/json',...headers},
    body:JSON.stringify({telefone:phone}),
  });
  return {app,post,denuncias};
}

test('different DDD with same last four digits explains blocked click vs unblocked typed number',async t=>{
  const {app,post,denuncias}=await setup(t);
  const wrong=await post(NUMERO_DIGITADO);
  assert.equal(wrong.status,200);
  const d=(await wrong.json());
  assert.equal(d.ok,true);
  assert.equal(d.numero.bloqueado,false);
  assert.equal(d.numero.cadastrado,false);
  assert.equal(d.numero.autorizado,false);
  assert.equal(d.numero.situacao,'sem-cadastro');
  assert.equal(d.cliques.cliqueDesteNumero,null);
  assert.equal(d.cliques.numeroDiferenteNoClique,true);
  assert.equal(d.cliques.dddDiferenteNoClique,true);
  assert.equal(d.cliques.cliqueComMesmoFinal.status,'impedido-bloqueado');
  assert.match(d.cliques.cliqueComMesmoFinal.telefoneMascarado,/\+5528/);
  const correct=await post(NUMERO_CLIQUE);
  assert.equal(correct.status,200);
  const c=await correct.json();
  assert.equal(c.numero.bloqueado,true);
  assert.equal(c.numero.cadastrado,false);
  assert.equal(c.numero.podeReativarSemCadastro,true);
  assert.equal(c.cliques.numeroDiferenteNoClique,false);
  assert.equal(c.cliques.cliqueDesteNumero.status,'impedido-bloqueado');
  const serialized=JSON.stringify([d,c]);
  assert.doesNotMatch(serialized,new RegExp(NUMERO_CLIQUE));
  assert.doesNotMatch(serialized,new RegExp(NUMERO_DIGITADO));
  assert.equal(denuncias.estaBloqueado(NUMERO_CLIQUE),true);
  assert.equal(denuncias.estaBloqueado(NUMERO_DIGITADO),false);
  assert.equal(app.contatos.listar().length,0);
});

test('diagnostic is local and authenticated, invalid numbers do not affect blocked database',async t=>{
  const {app,post,denuncias}=await setup(t);
  assert.equal((await post('número qualquer')).status,400);
  assert.equal((await post(NUMERO_CLIQUE,{'x-cpv-local':''})).status,403);
  assert.equal((await post(NUMERO_CLIQUE,{origin:'https://outside.invalid'})).status,403);
  assert.equal((await fetch(app.base+route)).status,404);
  assert.equal(denuncias.estaBloqueado(NUMERO_CLIQUE),true);
  assert.equal(app.contatos.listar().length,0);
});

test('Chrome shows readable diagnostic, DDD mismatch, and expands proof fields only for blocked owner',async t=>{
  const {app,denuncias}=await setup(t);
  const { chromium }=require('../../../node_modules/playwright');
  const browser=await chromium.launch({
    headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(app.base+'/contatos#reativar-teste');
  const field=page.locator('#reactivateTestPhone');
  const proof=page.locator('#reactivateProofFields');
  assert.equal(await proof.isVisible(),false);
  await field.fill(NUMERO_DIGITADO);
  await page.locator('#reactivateCheckStatus').click();
  await page.waitForFunction(()=>document.querySelector('#reactivateNumberDiagnosis')?.textContent?.includes('O DDD é diferente'));
  assert.equal(await proof.isVisible(),false);
  assert.match(await page.locator('#reactivateNumberDiagnosis').innerText(),/não está bloqueado/);
  const statusCss=await page.locator('#reactivateNumberDiagnosis').evaluate(el=>({
    fontSize:parseFloat(getComputedStyle(el).fontSize),
    lineHeight:parseFloat(getComputedStyle(el).lineHeight),
  }));
  assert.ok(statusCss.fontSize>=14,statusCss.fontSize.toString());
  assert.ok(statusCss.lineHeight>=21);
  await field.fill(NUMERO_CLIQUE);
  await page.locator('#reactivateCheckStatus').click();
  await proof.waitFor({state:'visible'});
  assert.match(await page.locator('#reactivateNumberDiagnosis').innerText(),/está bloqueado/);
  const sizes=await page.locator('#reactivateTestPhone').evaluate(el=>({
    h:el.getBoundingClientRect().height,
    font:parseFloat(getComputedStyle(el).fontSize),
  }));
  assert.ok(sizes.h>=48,JSON.stringify(sizes));
  assert.ok(sizes.font>=15,JSON.stringify(sizes));
  assert.equal(await page.locator('#reactivateTestSubmit').isVisible(),true);
  assert.equal(denuncias.estaBloqueado(NUMERO_CLIQUE),true);
  assert.deepEqual(errors,[]);
  const overflow=await page.evaluate(()=>({
    scroll:document.documentElement.scrollWidth,
    client:document.documentElement.clientWidth,
  }));
  assert.ok(overflow.scroll<=overflow.client+2,JSON.stringify(overflow));
});
