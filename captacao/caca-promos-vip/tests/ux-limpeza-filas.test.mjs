import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {iniciarServidor} from '../src/server.mjs';

const require=createRequire(new URL('../../../package.json',import.meta.url));
const {chromium}=require('playwright');
const grupo='https://chat.whatsapp.com/GrupoFicticio12345';
const fakePessoas=Array.from({length:30},(_,i)=>({
  nome:'Contato ficticio '+String(i+1).padStart(2,'0'),
  telefone:'1192000'+String(i).padStart(4,'0'),
}));
function autorizar(app,pessoas){
  app.contatos.importarConsentimentosExternos({
    pessoas,origemAutorizacao:'Conversa individual de teste',
    referenciaAutorizacao:'Aceite ficticio registrado no teste',
    dataAutorizacao:'2026-10-10',declaracao:true,
  });
}
function post(base,rota,data,extra={}){
  return fetch(base+rota,{method:'POST',headers:{
    origin:base,'content-type':'application/json','x-cpv-local':'1',...extra,
  },body:JSON.stringify(data)});
}
async function novoApp(t){
  const dir=mkdtempSync(join(tmpdir(),'cpv-ux-limpeza-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const app=await iniciarServidor({port:0,dataDir:dir,metaAmbiente:{}});
  t.after(()=>new Promise(done=>app.servidor.close(done)));
  return {app,dir};
}

test('limpar filas somente com confirmacao e backup, mantendo cadastro',async t=>{
  const {app,dir}=await novoApp(t);
  autorizar(app,[fakePessoas[0]]);
  const pessoa=(await (await fetch(app.base+
    '/api/local/campanhas/destinatarios')).json()).destinatarios[0];
  assert.equal((await post(app.base,'/api/local/campanhas/convite/modelo',{
    mensagem:'Olá, convite ficticio autorizado para entrar em um grupo de ofertas. Responda SAIR para não receber novas mensagens.',
    grupoUrl:grupo,nomeModelo:'convite_ofertas_v1',
  })).status,200);
  const fila=(await (await post(app.base,'/api/local/campanhas/convite/fila',{
    nome:'Fila de teste',modo:'web',contatoIds:[pessoa.id],
  })).json()).fila;
  const rota='/api/local/campanhas/convite/filas/limpar';
  assert.equal((await post(app.base,rota,{})).status,409);
  assert.equal((await post(app.base,rota,{confirmado:true},{
    origin:'https://site-nao-local.invalid'})).status,403);
  assert.equal((await (await fetch(app.base+
    '/api/local/campanhas/convite/filas')).json()).filas.length,1);
  const resposta=await post(app.base,rota,{confirmado:true});
  assert.equal(resposta.status,200);
  const r=(await resposta.json()).resultado;
  assert.equal(r.limpas,1);
  assert.equal(r.backupCriado,true);
  assert.equal((await (await fetch(app.base+
    '/api/local/campanhas/convite/filas')).json()).filas.length,0);
  const backups=readdirSync(join(dir,'backups-privados'));
  assert.equal(backups.length,1);
  const historico=JSON.parse(readFileSync(join(dir,'backups-privados',backups[0]),'utf8'));
  assert.equal(historico.filas[0].id,fila.id);
  assert.equal(app.contatos.listar().length,1);
  assert.equal((await (await fetch(app.base+
    '/api/local/campanhas/destinatarios')).json()).destinatarios.length,1);
});

test('UX mostra 12 de 30 contatos e limpa somente filas via painel',async t=>{
  const {app,dir}=await novoApp(t);
  autorizar(app,fakePessoas);
  const browser=await chromium.launch({headless:true,
    executablePath:String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  const jsErrors=[],external=[];
  page.on('pageerror',e=>jsErrors.push(e.message));
  page.on('request',r=>{if(!r.url().startsWith(app.base))external.push(r.url())});
  page.on('dialog',dia=>dia.accept(dia.type()==='prompt'?'LIMPAR':undefined));
  await page.goto(app.base+'/campanhas',{waitUntil:'domcontentloaded'});
  const a=await page.locator('#importStage').boundingBox();
  const b=await page.locator('#metaStage').boundingBox();
  const c=await page.locator('#manualStage').boundingBox();
  assert.ok(a.y<b.y && b.y<c.y,'Fluxo deve seguir Contatos, Mensagem, Enviar');
  assert.equal(await page.locator('#advancedMeta').getAttribute('open'),null);
  assert.equal(await page.locator('#consentDisclosure').getAttribute('open'),null);
  await page.locator('#importFile').setInputFiles({
    name:'autorizados.csv',mimeType:'text/csv',
    buffer:Buffer.from('nome;telefone\n'+fakePessoas.map(x=>x.nome+';'+x.telefone).join('\n')),
  });
  await page.waitForFunction(()=>document.querySelector('#metricEligible')?.textContent==='30');
  assert.equal(await page.locator('#consentDisclosure').getAttribute('open'),null);
  await page.locator('#groupLink').fill(grupo);
  await page.locator('#createManualQueue').click();
  await page.locator('#manualQueueDetail').waitFor({state:'visible',timeout:12000});
  assert.equal(await page.locator('#manualPeopleDisclosure').getAttribute('open'),null);
  await page.locator('#manualPeopleDisclosure > summary').click();
  assert.equal(await page.locator('#manualQueuePeople .list-row').count(),12);
  await page.getByRole('button',{name:'Mostrar mais contatos'}).click();
  await page.waitForFunction(()=>document.querySelectorAll('#manualQueuePeople .list-row').length===24);
  await page.locator('#manualSearch').fill('ficticio 29');
  await page.waitForFunction(()=>document.querySelectorAll('#manualQueuePeople .list-row').length===1);
  assert.equal(await page.locator('#prepareNextContact').isEnabled(),true);
  await page.locator('#queueTools summary').click();
  await page.locator('#clearAllQueues').click();
  await page.waitForTimeout(1100);
  const diagnostico={mensagem:await page.locator('#feedback').textContent(),
    metric:await page.locator('#metricQueues').textContent()};
  assert.equal(diagnostico.metric,'0',diagnostico.mensagem);
  assert.equal((await (await fetch(app.base+
    '/api/local/campanhas/convite/filas')).json()).filas.length,0);
  assert.equal(app.contatos.listar().length,30);
  assert.equal(readdirSync(join(dir,'backups-privados')).length,1);
  assert.equal(await page.locator('#manualQueueDetail').isHidden(),true);
  await page.setViewportSize({width:390,height:844});
  const sz=await page.evaluate(()=>({
    client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
  }));
  assert.ok(sz.scroll<=sz.client+2,JSON.stringify(sz));
  assert.deepEqual(jsErrors,[]);
  assert.deepEqual(external,[]);
});

test('limpeza de uma fila preserva outras e recusa envio registrado',async t=>{
  const {app,dir}=await novoApp(t);
  autorizar(app,fakePessoas.slice(0,3));
  const contatos=(await (await fetch(app.base+
    '/api/local/campanhas/destinatarios')).json()).destinatarios;
  assert.equal((await post(app.base,'/api/local/campanhas/convite/modelo',{
    mensagem:'Convite fictício com autorização. Você aceita participar do grupo gratuito? Para sair, responda SAIR.',
    grupoUrl:grupo,nomeModelo:'convite_ofertas_v1',
  })).status,200);
  const filaWeb=(await (await post(app.base,'/api/local/campanhas/convite/fila',{
    nome:'Fila gratuita',modo:'web',contatoIds:[contatos[0].id],
  })).json()).fila;
  const filaMeta=(await (await post(app.base,'/api/local/campanhas/convite/fila',{
    nome:'Fila Meta que deve ficar',modo:'meta',contatoIds:[contatos[1].id],
  })).json()).fila;
  const url='/api/local/campanhas/convite/fila/limpar';
  assert.equal((await post(app.base,url,{campanhaId:filaWeb.id})).status,409);
  assert.equal((await post(app.base,url,{campanhaId:filaWeb.id,confirmado:true},
    {origin:'https://externo.invalid'})).status,403);
  assert.equal((await post(app.base,url,{campanhaId:'id-invalido',confirmado:true})).status,409);
  const limpa=await post(app.base,url,{campanhaId:filaWeb.id,confirmado:true});
  assert.equal(limpa.status,200,JSON.stringify(await limpa.clone().json()));
  const resultado=(await limpa.json()).resultado;
  assert.equal(resultado.limpas,1);
  assert.equal(resultado.backupCriado,true);
  const restante=(await (await fetch(app.base+
    '/api/local/campanhas/convite/filas')).json()).filas;
  assert.deepEqual(restante.map(x=>x.id),[filaMeta.id]);
  const files=readdirSync(join(dir,'backups-privados'));
  assert.equal(files.length,1);
  const salvaguarda=JSON.parse(readFileSync(join(dir,'backups-privados',files[0]),'utf8'));
  assert.equal(salvaguarda.filas.length,2);
  assert.equal(app.contatos.listar().length,3);
  // Simula somente um REGISTRO LOCAL de envio em dados fictícios; nenhum WhatsApp real.
  const tentativa=(await (await post(app.base,'/api/local/campanhas/convite/fila',{
    nome:'Fila com envio registrado',modo:'web',contatoIds:[contatos[2].id],
  })).json()).fila;
  const preparado=await post(app.base,'/api/local/campanhas/convite/manual/preparar',{
    campanhaId:tentativa.id,contatoId:contatos[2].id,
  });
  assert.equal(preparado.status,200);
  const registro=await post(app.base,'/api/local/campanhas/convite/manual/registrar',{
    campanhaId:tentativa.id,contatoId:contatos[2].id,
    acao:'enviado',confirmado:true,
  });
  assert.equal(registro.status,200);
  const rejeitado=await post(app.base,url,{campanhaId:tentativa.id,confirmado:true});
  assert.equal(rejeitado.status,409);
  assert.match((await rejeitado.json()).mensagem,/tentativas ou envios/i);
  assert.equal((await (await fetch(app.base+
    '/api/local/campanhas/convite/filas')).json()).filas.length,2);
});

test('botão visível limpa somente a fila aberta, com lista recolhida',async t=>{
  const {app,dir}=await novoApp(t);
  autorizar(app,fakePessoas.slice(0,3));
  const contatos=(await (await fetch(app.base+
    '/api/local/campanhas/destinatarios')).json()).destinatarios;
  assert.equal((await post(app.base,'/api/local/campanhas/convite/modelo',{
    mensagem:'Convite de demonstração para participar do grupo de ofertas. Para não receber, responda SAIR.',
    grupoUrl:grupo,nomeModelo:'convite_ofertas_v1',
  })).status,200);
  const filaWeb=(await (await post(app.base,'/api/local/campanhas/convite/fila',{
    nome:'Fila gratuita para limpar',modo:'web',contatoIds:[contatos[0].id,contatos[1].id],
  })).json()).fila;
  const filaMeta=(await (await post(app.base,'/api/local/campanhas/convite/fila',{
    nome:'Fila Meta preservada',modo:'meta',contatoIds:[contatos[2].id],
  })).json()).fila;
  const browser=await chromium.launch({headless:true,
    executablePath:String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1170,height:840}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let confirmar=false;
  page.on('dialog',dlg=>dlg.accept(dlg.type()==='prompt'
    ? confirmar?'LIMPAR':'CANCELAR' : undefined));
  await page.goto(app.base+'/campanhas',{waitUntil:'domcontentloaded'});
  await page.locator('#manualQueueList button').click();
  await page.locator('#manualQueueDetail').waitFor({state:'visible',timeout:12000});
  assert.equal(await page.locator('#clearCurrentQueue').isVisible(),true);
  await page.waitForFunction(()=>!document.querySelector('#prepareNextContact').disabled,
    null,{timeout:10000});
  assert.equal(await page.locator('#manualPeopleDisclosure').getAttribute('open'),null);
  assert.equal(await page.locator('#manualPeopleCount').textContent(),'(2)');
  assert.equal(await page.getByRole('button',{name:'Preparar conversa'}).count(),0);
  await page.locator('#clearCurrentQueue').click();
  assert.equal((await (await fetch(app.base+
    '/api/local/campanhas/convite/filas')).json()).filas.length,2);
  confirmar=true;
  await page.locator('#clearCurrentQueue').click();
  await page.locator('#manualQueueDetail').waitFor({state:'hidden'});
  const restantes=(await (await fetch(app.base+
    '/api/local/campanhas/convite/filas')).json()).filas;
  assert.deepEqual(restantes.map(x=>x.id),[filaMeta.id]);
  assert.equal(app.contatos.listar().length,3);
  assert.equal(readdirSync(join(dir,'backups-privados')).length,1);
  assert.match(await page.locator('#feedback').textContent(),/preservados/);
  await page.setViewportSize({width:390,height:844});
  const sz=await page.evaluate(()=>({
    client:document.documentElement.clientWidth,
    scroll:document.documentElement.scrollWidth,
  }));
  assert.ok(sz.scroll<=sz.client+2,JSON.stringify(sz));
  assert.deepEqual(errors,[]);
});
