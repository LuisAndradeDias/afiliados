import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {request as httpRequest} from 'node:http';
import {iniciarServidor} from '../src/server.mjs';
import {iniciarDenuncias} from '../src/denuncias.mjs';

const require=createRequire(new URL('../../../package.json',import.meta.url));
const {chromium}=require('playwright');

async function fixture(t){
  const dir=mkdtempSync(join(tmpdir(),'cpv-ux-contacts-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const app=await iniciarServidor({port:0,dataDir:dir,metaAmbiente:{}});
  t.after(()=>new Promise(resolve=>app.servidor.close(resolve)));
  const pessoa=(telefone,nome)=>({telefone,nome});
  const pessoas=[
    pessoa('21988887777','Pessoa Autorizada'),
    pessoa('22977776666','Pessoa que reclamou'),
    pessoa('31966665555','Pessoa descadastrada'),
    pessoa('41955554444','Pessoa para bloqueio manual'),
  ];
  app.contatos.importarConsentimentosExternos({
    pessoas,origemAutorizacao:'Conversa individual',
    referenciaAutorizacao:'Aceite fictício armazenado para validar interface',
    dataAutorizacao:'2026-10-10',declaracao:true,
  });
  app.contatos.cadastrar({nome:'Pessoa pendente',
    telefone:'11933332222',origem:'formulario-ficticio',consentimento:true});
  const registros=app.contatos.listar();
  const descadastrada=registros.find(c=>c.nome==='Pessoa descadastrada');
  app.contatos.descadastrarPorId(descadastrada.id);
  const queReclamou=registros.find(c=>c.nome==='Pessoa que reclamou');
  const denuncias=iniciarDenuncias(dir,app.contatos);
  denuncias.registrar({
    telefone:queReclamou.telefone,mensagemId:'mensagem-denunciada-ficticia-12345',
    motivo:'denuncia-convite',origem:'clique-confirmado-netlify',
  });
  return {app,registros,denuncias,dir};
}
function post(base,path,body,headers={}){
  return fetch(base+path,{
    method:'POST',
    headers:{origin:base,'x-cpv-local':'1','content-type':'application/json',...headers},
    body:JSON.stringify(body),
  });
}
function getWithHost(base,path,host){
  return new Promise((resolve,reject)=>{
    const req=httpRequest(base+path,{headers:{host}},res=>{
      res.resume();res.on('end',()=>resolve(res.statusCode));
    });
    req.on('error',reject);req.end();
  });
}
async function json(base,route){
  const r=await fetch(base+route);
  assert.equal(r.status,200,route);
  return r.json();
}

test('API gestao classifica cada contato sem confundir bloqueio e descadastro',async t=>{
  const {app}=await fixture(t);
  const r=await json(app.base,'/api/local/gestao/contatos');
  assert.equal(r.resumo.total,5);
  assert.equal(r.resumo.autorizado,2);
  assert.equal(r.resumo.bloqueado,1);
  assert.equal(r.resumo.descadastrado,1);
  assert.equal(r.resumo.pendente,1);
  assert.equal(r.resumo.denuncias,1);
  assert.equal(r.contatos.length,5);
  const fila=r.contatos.find(c=>c.nome==='Pessoa que reclamou');
  assert.equal(fila.status,'bloqueado');
  assert.equal(fila.motivoBloqueio,'Denúncia interna confirmada');
  assert.match(fila.telefoneMascarado,/\*|•/);
  const txt=JSON.stringify(r);
  assert.doesNotMatch(txt,/5522977776666|codigoConfirmacao|tokenDescadastro|numeroHash|_numeroIndex/);
  const alvo=r.contatos.find(c=>c.nome==='Pessoa Autorizada');
  const detail=await json(app.base,'/api/local/gestao/contato?id='+alvo.id);
  assert.equal(detail.contato.status,'autorizado');
  assert.equal(detail.contato.evidencia,'Autorização declarada pelo responsável');
  assert.equal(detail.contato.registroAutorizacao.origem,'Conversa individual');
  assert.doesNotMatch(JSON.stringify(detail),/5521988877777|codigoConfirmacao|tokenDescadastro/);
  const dash=await json(app.base,'/api/local/gestao/resumo');
  assert.equal(dash.contatos.bloqueado,1);
  assert.equal(dash.denuncias.length,1);
  assert.equal(dash.filas.total,0);
  const events=await json(app.base,'/api/local/gestao/denuncias');
  assert.equal(events.ocorrencias.length,1);
  assert.equal(events.ocorrencias[0].motivo,'denuncia-convite');
});

test('busca por nome, numero completo, filtros e paginacao sem vazamento',async t=>{
  const {app}=await fixture(t);
  const target=await json(app.base,'/api/local/gestao/contatos?filtro=bloqueado&pagina=1');
  assert.equal(target.totalFiltrado,1);
  assert.equal(target.contatos[0].status,'bloqueado');
  const byName=await json(app.base,'/api/local/gestao/contatos?busca=pendente');
  assert.equal(byName.contatos.length,1);
  const byNumber=await json(app.base,'/api/local/gestao/contatos?busca=5521977776666');
  assert.equal(byNumber.contatos.length,0);
  const byExact=await json(app.base,'/api/local/gestao/contatos?busca=5521988887777');
  assert.equal(byExact.contatos.length,1);
  const byLastFour=await json(app.base,'/api/local/gestao/contatos?busca=7777');
  assert.equal(byLastFour.contatos.length,1);
  const empty=await json(app.base,'/api/local/gestao/contatos?filtro=sem-autorizacao');
  assert.equal(empty.totalFiltrado,0);
  const notFound=await fetch(app.base+'/api/local/gestao/contatos?filtro=inexistente');
  assert.equal(notFound.status,400);
  assert.equal((await fetch(app.base+'/api/local/gestao/contatos?pagina=-5')).status,400);
  assert.equal((await fetch(app.base+'/api/local/gestao/contato?id=bad')).status,400);
});

test('bloqueio pelo painel e administrativo, não inventa denúncia nem libera reimportações',async t=>{
  const {app,registros,denuncias}=await fixture(t);
  const target=registros.find(c=>c.nome==='Pessoa para bloqueio manual');
  const path='/api/local/gestao/contato/bloquear';
  const noConfirm=await post(app.base,path,{id:target.id});
  assert.equal(noConfirm.status,400);
  const foreign=await post(app.base,path,{id:target.id,confirmado:true},
    {origin:'https://outro-site.invalid'});
  assert.equal(foreign.status,403);
  const forbidden=await fetch(app.base+path,{method:'POST',
    headers:{origin:app.base,'content-type':'application/json'},
    body:JSON.stringify({id:target.id,confirmado:true})});
  assert.equal(forbidden.status,403);
  const success=await post(app.base,path,{id:target.id,confirmado:true});
  assert.equal(success.status,200,await success.text());
  const again=await post(app.base,path,{id:target.id,confirmado:true});
  assert.equal(again.status,200);
  const list=await json(app.base,'/api/local/gestao/contatos?filtro=bloqueado');
  assert.equal(list.totalFiltrado,2);
  const manual=list.contatos.find(c=>c.id===target.id);
  assert.equal(manual.motivoBloqueio,'Bloqueio administrativo');
  const r=await json(app.base,'/api/local/gestao/denuncias');
  assert.equal(r.resumo.denuncias,1,'administrativo não altera contagem de denúncias');
  assert.equal(r.ocorrencias.filter(c=>c.motivo==='bloqueio-administrativo').length,1);
  assert.equal(denuncias.estaBloqueado(target.telefone),true);
  assert.equal(app.contatos.listar().find(c=>c.id===target.id).status,'descadastrado');
  const importAgain=await post(app.base,'/api/local/campanhas/importar-autorizados',{
    pessoas:[{telefone:target.telefone,nome:'Tentativa ficticia'}],
    origemAutorizacao:'Conversa individual',
    referenciaAutorizacao:'Prova ficticia informada para teste',
    dataAutorizacao:'2026-10-10',declaracao:true,
  });
  assert.equal(importAgain.status,200);
  assert.equal((await importAgain.json()).resultado.bloqueados,1);
});

test('áreas de gestão não ficam acessíveis por host externo',async t=>{
  const {app}=await fixture(t);
  for(const path of ['/inicio','/contatos','/denuncias']){
    const r=await fetch(app.base+path);
    assert.equal(r.status,200);
    assert.match(await r.text(),/Navegação principal/);
    assert.equal(await getWithHost(app.base,path,'outro.exemplo.com'),403);
  }
  assert.equal(await getWithHost(app.base,'/api/local/gestao/contatos',
    'outro.exemplo.com'),403);
  const asset=await fetch(app.base+'/assets/painel-theme.css');
  assert.equal(asset.status,200);
  assert.match(await asset.text(),/status-pill/);
});

test('interface no Chrome: cartões, filtro, ficha, denúncia e uso móvel',async t=>{
  const {app}=await fixture(t);
  const browser=await chromium.launch({headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1240,height:850}});
  const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!r.url().startsWith(app.base))external.push(r.url());});
  await page.goto(app.base+'/contatos',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#ctTotal')?.textContent==='5');
  assert.equal(await page.locator('#ctBlocked').innerText(),'1');
  assert.equal(await page.locator('#contactsBody tr').count(),5);
  await page.locator('[data-filter=bloqueado]').click();
  await page.waitForFunction(()=>document.querySelector('#contactResults')?.textContent.includes('1 contato'));
  assert.equal(await page.locator('#contactsBody tr').count(),1);
  await page.locator('#contactsBody button').click();
  assert.equal(await page.locator('#contactDialog').isVisible(),true);
  assert.match(await page.locator('#detailStatus').innerText(),/Bloqueado/);
  assert.equal(await page.locator('#blockContact').isHidden(),true);
  await page.locator('#detailDone').click();
  await page.locator('[data-filter=autorizado]').click();
  await page.waitForFunction(()=>document.querySelector('#contactResults')?.textContent.includes('2 contato'));
  await page.locator('#contactSearch').fill('Pessoa Autorizada');
  await page.waitForFunction(()=>document.querySelector('#contactResults')?.textContent.includes('1 contato'));
  await page.locator('#contactsBody button').click();
  assert.equal(await page.locator('#blockContact').isVisible(),true);
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#blockContact').click();
  await page.waitForFunction(()=>document.querySelector('#ctBlocked')?.textContent==='2');
  await page.locator('#contactSearch').fill('');
  await page.locator('[data-filter=todos]').click();
  await page.waitForFunction(()=>document.querySelector('#contactResults')?.textContent.includes('5 contato'));
  await page.screenshot({path:'C:\\projeto01\\captacao\\caca-promos-vip\\dados\\previa-acer\\qa-gestao-contatos-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'C:\\projeto01\\captacao\\caca-promos-vip\\dados\\previa-acer\\qa-gestao-contatos-mobile.png',fullPage:true});
  const sz=await page.evaluate(()=>({
    view:document.documentElement.clientWidth,
    width:document.documentElement.scrollWidth,
  }));
  assert.ok(sz.width<=sz.view+2,JSON.stringify(sz));
  await page.setViewportSize({width:1240,height:850});
  await page.goto(app.base+'/inicio',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#homeTotal')?.textContent==='5');
  assert.equal(await page.locator('#homeComplaints').innerText(),'1');
  await page.screenshot({path:'C:\\projeto01\\captacao\\caca-promos-vip\\dados\\previa-acer\\qa-gestao-inicio-desktop.png',fullPage:true});
  await page.goto(app.base+'/denuncias',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#repBlocked')?.textContent==='2');
  assert.match(await page.locator('#reportList').innerText(),/Confirmada no Netlify/);
  await page.screenshot({path:'C:\\projeto01\\captacao\\caca-promos-vip\\dados\\previa-acer\\qa-gestao-denuncias-desktop.png',fullPage:true});
  await page.goto(app.base+'/campanhas',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('nav.top-actions [aria-current=page]').innerText(),'Listas e filas');
  assert.equal(await page.locator('.workflow-links a').count(),3);
  await page.screenshot({path:'C:\\projeto01\\captacao\\caca-promos-vip\\dados\\previa-acer\\qa-gestao-convites-desktop.png',fullPage:false});
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
});
