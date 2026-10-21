import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {iniciarServidor} from '../src/server.mjs';
import {iniciarDenuncias} from '../src/denuncias.mjs';
import {iniciarConvitesUnicos} from '../src/convites-unicos.mjs';
import {obterConfigMeta} from '../src/meta-cloud.mjs';

const require=createRequire(new URL('../../../package.json',import.meta.url));
const {chromium}=require('playwright');
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const group='https://chat.whatsapp.com/GrupoFicticioParaTeste4444';
const now=()=>new Date('2026-10-21T16:15:00.000Z');
async function setup(t,{blocked=false}={}){
  const dir=mkdtempSync(join(tmpdir(),'cpv-envio-rapido-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const clock={time:new Date('2026-10-21T16:15:00.000Z')};
  const agora=()=>clock.time;
  const app=await iniciarServidor({
    port:0,dataDir:dir,metaAmbiente:{},agora,
    whatsappWorkerTeste:true,
  });
  t.after(()=>new Promise(resolve=>app.servidor.close(resolve)));
  const registry=app.contatos.importarConsentimentosExternos({
    pessoas:[{nome:'Titular de teste',telefone:'31988887777'},
      {nome:'Outro autorizado',telefone:'21977776666'}],
    origemAutorizacao:'Conversa individual real ficticia',
    referenciaAutorizacao:'Aceite da pessoa no atendimento ficticio',
    dataAutorizacao:'2026-10-20',declaracao:true,
  });
  assert.equal(registry.autorizadosNovos,2);
  const c=app.contatos.listar().find(c=>c.nome==='Titular de teste');
  const other=app.contatos.listar().find(c=>c.nome==='Outro autorizado');
  if(blocked){
    iniciarDenuncias(dir,app.contatos,agora).registrar({
      telefone:c.telefone,mensagemId:'teste-saida-previa',
      motivo:'saida-solicitada',origem:'simulado',
    });
  }
  return {...app,dir,contact:c,other,clock,agora};
}
function post(base,endpoint,body,headers={}){
  return fetch(base+endpoint,{
    method:'POST',headers:{
      origin:base,'x-cpv-local':'1','content-type':'application/json',...headers,
    },body:JSON.stringify(body),
  });
}
async function get(base,path){
  const r=await fetch(base+path);
  assert.equal(r.status,200,r.status+' '+path);
  return r.json();
}

test('a tela é local, clara e isolada de filas avançadas',async t=>{
  const f=await setup(t);
  const r=await fetch(f.base+'/enviar');
  assert.equal(r.status,200);
  const html=await r.text();
  assert.match(html,/Enviar para mim/);
  assert.match(html,/Verificar número/);
  assert.match(html,/Abrir conversa no Chrome/);
  assert.match(html,/id="quickCopyText"/);
  assert.match(html,/Campo vazio não significa que foi enviada/);
  assert.match(html,/Listas e filas/);
  assert.doesNotMatch(html,/CPV_DENUNCIA_NETLIFY_SECRET|contatos-autorizados\.json/);
  const redirect=await fetch(f.base+'/painel',{redirect:'manual'});
  assert.equal(redirect.status,302);
  assert.equal(redirect.headers.get('location'),'/enviar');
  for(const asset of ['/assets/envio-rapido.js','/assets/envio-rapido.css']){
    const file=await fetch(f.base+asset);
    assert.equal(file.status,200,asset);
    assert.ok((await file.text()).length>1000);
  }
  const invalidOrigin=await fetch(f.base+'/enviar',{
    headers:{'sec-fetch-site':'cross-site'},
  });
  assert.equal(invalidOrigin.status,403);
});

test('número autorizado é encontrado; bloqueados nunca entram no envio',async t=>{
  const f=await setup(t,{blocked:true});
  const allowed=await post(f.base,'/api/local/campanhas/rapido/consultar',{
    telefone:'(21) 97777-6666',
  });
  assert.equal(allowed.status,200);
  assert.equal((await allowed.json()).contato.situacao,'autorizado');
  const blocked=await post(f.base,'/api/local/campanhas/rapido/consultar',{
    telefone:'(31) 98888-7777',
  });
  assert.equal(blocked.status,200);
  const b=(await blocked.json()).contato;
  assert.equal(b.situacao,'bloqueado');
  assert.equal(b.contatoId,f.contact.id);
  const search=await get(f.base,
    '/api/local/campanhas/rapido/contatos?busca=Outro');
  assert.equal(search.contatos.length,1);
  assert.equal(search.contatos[0].id,f.other.id);
  assert.equal(search.contatos[0].status,'autorizado');
  assert.doesNotMatch(JSON.stringify(search),/31988887777|21977776666/);
  const tryCreate=await post(f.base,'/api/local/campanhas/rapido/criar',{
    contatoId:f.contact.id,confirmado:true,
  });
  assert.equal(tryCreate.status,409);
  const tryRegister=await post(f.base,'/api/local/campanhas/rapido/cadastrar',{
    telefone:'31988887777',nome:'Sim',souTitular:true,autorizado:true,confirmado:true,
  });
  assert.equal(tryRegister.status,409);
  assert.equal((await get(f.base,'/api/local/campanhas/convite/filas')).filas.length,0);
});

test('cadastro próprio exige declaração e nunca dispara WhatsApp',async t=>{
  const f=await setup(t);
  const phone='31999998888';
  const getStatus=async()=>{
    const r=await post(f.base,'/api/local/campanhas/rapido/consultar',{telefone:phone});
    assert.equal(r.status,200);return (await r.json()).contato;
  };
  assert.equal((await getStatus()).situacao,'novo');
  const denied=await post(f.base,'/api/local/campanhas/rapido/cadastrar',{
    telefone:phone,nome:'Meu número',souTitular:false,autorizado:true,confirmado:true,
  });
  assert.equal(denied.status,409);
  const registered=await post(f.base,'/api/local/campanhas/rapido/cadastrar',{
    telefone:phone,nome:'Meu número',souTitular:true,autorizado:true,confirmado:true,
  });
  const data=await registered.json();
  assert.equal(registered.status,200,JSON.stringify(data));
  assert.equal(data.contato.situacao,'autorizado');
  assert.equal(data.jaCadastrado,false);
  const record=f.contatos.listar().find(x=>x.id===data.contato.contatoId);
  assert.equal(record.registroAutorizacao.dataAutorizacao,'2026-10-21');
  assert.match(record.registroAutorizacao.referencia,/Declaração individual/);
  const again=await post(f.base,'/api/local/campanhas/rapido/cadastrar',{
    telefone:phone,nome:'Meu número',souTitular:true,autorizado:true,confirmado:true,
  });
  assert.equal((await again.json()).jaCadastrado,true);
  assert.equal((await get(f.base,'/api/local/campanhas/convite/whatsapp/estado')).estado.fase,'inativo');
});

test('1 pessoa: cria o registro, apresenta WhatsApp e nunca envia por preparar',async t=>{
  const f=await setup(t);
  const saved=await post(f.base,'/api/local/campanhas/convite/modelo',{
    mensagem:'Olá! Esse convite é um teste autorizado e opcional. Responda SAIR.',
    grupoUrl:group,nomeModelo:'convite_ofertas_v1',
  });
  assert.equal(saved.status,200,await saved.text());
  const first=await post(f.base,'/api/local/campanhas/rapido/criar',{
    contatoId:f.contact.id,confirmado:true,proprio:true,
  });
  const data=await first.json();
  assert.equal(first.status,200,JSON.stringify(data));
  assert.equal(data.reutilizada,false);
  assert.match(data.fila.nome,/Meu teste de WhatsApp/);
  assert.ok(uuid.test(data.fila.id));
  assert.equal(data.fila.total,1);
  assert.equal((await get(f.base,'/api/local/campanhas/convite/filas')).filas.length,1);
  const reuse=await post(f.base,'/api/local/campanhas/rapido/criar',{
    contatoId:f.contact.id,confirmado:true,proprio:true,
  });
  assert.equal((await reuse.json()).reutilizada,true);
  assert.equal((await get(f.base,'/api/local/campanhas/convite/filas')).filas.length,1);
  const prepare=await post(f.base,'/api/local/campanhas/convite/manual/preparar',{
    campanhaId:data.fila.id,contatoId:f.contact.id,
  });
  const conv=(await prepare.json()).conversa;
  assert.equal(prepare.status,200);
  assert.match(conv.mensagem,/Não tenho interesse|SAIR/);
  assert.match(conv.url,/^https:\/\/wa\.me\/55/);
  const q=(await get(f.base,'/api/local/campanhas/convite/fila?id='+data.fila.id)).fila;
  assert.equal(q.itens[0].status,'aberto');
  assert.equal(q.itens[0].confirmadoEm,null);
  assert.equal((await get(f.base,'/api/local/campanhas/convite/whatsapp/estado')).estado.fase,'inativo');
  const wrongOrigin=await post(f.base,'/api/local/campanhas/rapido/consultar',{
    telefone:'31988887777',
  },{origin:'https://site-falso.invalid'});
  assert.equal(wrongOrigin.status,403);
});

test('Chrome desktop/mobile: processo para seu número é compreensível e não envia sozinho',async t=>{
  const f=await setup(t);
  const browser=await chromium.launch({headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  t.after(()=>browser.close());
  for(const width of [1280,390]){
    const page=await browser.newPage({viewport:{width,height:850}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(f.base+'/enviar');
    await page.waitForFunction(()=>document.querySelector('#quickAllowed')?.textContent==='2');
    if(process.env.CPV_VISUAL_PROOF==='1'){
      const dir='C:\\projeto01\\captacao\\caca-promos-vip\\Publicacoes\\2026-10-21-Envio-Guiado-QA';
      mkdirSync(dir,{recursive:true});
      await page.screenshot({path:join(dir,'inicio-'+width+'.png'),fullPage:true});
    }
    await page.locator('#quickPhone').fill('31988887777');
    await page.locator('#quickLookup').click();
    await page.locator('#quickGoMessage').waitFor({state:'visible'});
    assert.equal(await page.locator('#quickGoMessage').isEnabled(),true);
    await page.locator('#quickGoMessage').click();
    assert.equal(await page.locator('#quickStage2').isVisible(),true);
    await page.locator('#quickGroup').fill(group);
    await page.locator('#quickCreate').click();
    await page.locator('#quickStage3').waitFor({state:'visible'});
    if(process.env.CPV_VISUAL_PROOF==='1'){
      const dir='C:\\projeto01\\captacao\\caca-promos-vip\\Publicacoes\\2026-10-21-Envio-Guiado-QA';
      await page.screenshot({path:join(dir,'conversa-'+width+'.png'),fullPage:true});
    }
    assert.equal(await page.locator('#quickPrepareChrome').isEnabled(),true);
    assert.equal(await page.locator('#quickConfirmChrome').isDisabled(),true);
    assert.match(await page.locator('#quickFinalText').innerText(),/Entrar no grupo/);
    assert.match(await page.locator('#quickManualLink').getAttribute('href'),
      /^https:\/\/wa\.me\//);
    const dimension=await page.evaluate(()=>({
      client:document.documentElement.clientWidth,
      scroll:document.documentElement.scrollWidth,
    }));
    assert.ok(dimension.scroll<=dimension.client+2,
      'Largura '+width+'; '+JSON.stringify(dimension));
    assert.deepEqual(errors,[]);
    await page.reload();
    await page.locator('#quickStage3').waitFor({state:'visible'});
    assert.equal(await page.locator('#quickConfirmChrome').isDisabled(),true);
    await page.close();
  }
  assert.equal((await get(f.base,'/api/local/campanhas/convite/whatsapp/estado')).estado.fase,'inativo');
  assert.equal((await get(f.base,'/api/local/campanhas/convite/filas')).filas.length,1,
    'segundo navegador reutilizou a mesma fila');
});

test('nova autorização posterior ao envio permite testar novamente sem repetir fila antiga',async t=>{
  const f=await setup(t);
  const bloqueios=iniciarDenuncias(f.dir,f.contatos,f.agora);
  const convites=iniciarConvitesUnicos({
    dataDir:f.dir,contatos:f.contatos,bloqueios,
    configMeta:obterConfigMeta({}),agora:f.agora,grupoInicial:group,
  });
  const primeira=convites.criarFila({
    nome:'Convite inicialmente autorizado',contatoIds:[f.contact.id],modo:'web',
  });
  convites.prepararManual({campanhaId:primeira.id,contatoId:f.contact.id});
  convites.marcarManual({campanhaId:primeira.id,contatoId:f.contact.id,
    acao:'enviado',confirmado:true});
  assert.equal(convites.detalhesFila(primeira.id).manuais,1);
  const repetido=await post(f.base,'/api/local/campanhas/rapido/criar',{
    contatoId:f.contact.id,confirmado:true,
  });
  assert.equal(repetido.status,409,'não permitir repetir sem autorização nova');
  f.clock.time=new Date('2026-10-21T17:15:00.000Z');
  bloqueios.registrar({
    telefone:f.contact.telefone,mensagemId:'novo-sair-ficticio',
    motivo:'saida-solicitada',origem:'confirmacao-teste',
  });
  assert.equal((await get(f.base,'/api/local/gestao/contato?id='+f.contact.id))
    .contato.status,'bloqueado');
  f.clock.time=new Date('2026-10-21T18:15:00.000Z');
  const reativar=await post(f.base,'/api/local/gestao/contato/desbloquear',{
    id:f.contact.id,origemAutorizacao:'Nova conversa voluntária com o próprio titular',
    referenciaAutorizacao:'Confirmação posterior ao primeiro envio, registrada em teste',
    dataAutorizacao:'2026-10-21',novaAutorizacao:true,confirmado:true,
  });
  assert.equal(reativar.status,200,await reativar.text());
  const c=f.contatos.listar().find(c=>c.id===f.contact.id);
  assert.equal(c.status,'ativo');
  assert.ok(new Date(c.reativadoEm)>new Date('2026-10-21T17:15:00.000Z'));
  const novo=await post(f.base,'/api/local/campanhas/rapido/criar',{
    contatoId:f.contact.id,confirmado:true,proprio:true,
  });
  const resultado=await novo.json();
  assert.equal(novo.status,200,JSON.stringify(resultado));
  assert.notEqual(resultado.fila.id,primeira.id);
  assert.equal(convites.detalhesFila(primeira.id).manuais,1);
  assert.equal(convites.detalhesFila(resultado.fila.id).pendentes,1);
  assert.equal((await get(f.base,'/api/local/campanhas/convite/whatsapp/estado')).estado.fase,'inativo');
});

test('página avisa quando o próprio número está bloqueado e orienta a reautorizar',async t=>{
  const f=await setup(t,{blocked:true});
  const browser=await chromium.launch({headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:430,height:850}});
  await page.goto(f.base+'/enviar');
  await page.waitForFunction(()=>document.querySelector('#quickAllowed')?.textContent==='1');
  await page.locator('#quickPhone').fill('31988887777');
  await page.locator('#quickLookup').click();
  await page.locator('#quickBlocked').waitFor({state:'visible'});
  assert.equal(await page.locator('#quickGoMessage').isDisabled(),true);
  assert.equal(await page.locator('#quickNewContact').isHidden(),true);
  assert.match(await page.locator('#quickBlocked').innerText(),/nova autorização/);
  assert.equal(await page.locator('#quickBlocked a').getAttribute('href'),
    '/contatos?filtro=bloqueado');
});

test('caminho guiado cadastra apenas o próprio número com confirmação explícita',async t=>{
  const f=await setup(t);
  const browser=await chromium.launch({headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1000,height:860}});
  await page.goto(f.base+'/enviar');
  await page.locator('#quickPhone').fill('31999997777');
  await page.locator('#quickLookup').click();
  await page.locator('#quickNewContact').waitFor({state:'visible'});
  assert.equal(await page.locator('#quickGoMessage').isDisabled(),true);
  await page.locator('#quickNewName').fill('Meu WhatsApp de teste');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#quickOwnerConsent').check();
  await page.locator('#quickRegister').click();
  await page.waitForFunction(()=>!document.querySelector('#quickGoMessage').disabled);
  assert.equal(await page.locator('#quickNewContact').isHidden(),true);
  const c=f.contatos.listar().find(c=>c.nome==='Meu WhatsApp de teste');
  assert.ok(c&&c.status==='ativo');
  await page.locator('#quickGoMessage').click();
  assert.equal(await page.locator('#quickStage2').isVisible(),true);
  assert.equal((await get(f.base,'/api/local/campanhas/convite/filas')).filas.length,0);
});

test('busca de outro contato seleciona apenas registros autorizados',async t=>{
  const f=await setup(t);
  const browser=await chromium.launch({headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1180,height:850}});
  await page.goto(f.base+'/enviar');
  await page.locator('#quickChooseOther').click();
  await page.locator('#quickSearch').fill('Outro');
  await page.locator('#quickSearchButton').click();
  await page.locator('.quick-result-row').first().click();
  assert.equal(await page.locator('#quickGoMessage').isEnabled(),true);
  assert.match(await page.locator('#quickSelected').innerText(),/Outro autorizado/);
  assert.doesNotMatch(await page.locator('#quickSelected').innerText(),/21977776666/);
  await page.locator('#quickGoMessage').click();
  assert.match(await page.locator('#quickMessageTarget').innerText(),/Outro autorizado/);
});

test('WhatsApp ficticio apaga o texto: painel mantém cópia e proíbe novo envio',async t=>{
  process.env.CPV_WHATSAPP_MOCK_DROP_DRAFT='true';
  process.env.CPV_WHATSAPP_MOCK_SEND_IN_BROWSER='true';
  t.after(()=>{
    delete process.env.CPV_WHATSAPP_MOCK_DROP_DRAFT;
    delete process.env.CPV_WHATSAPP_MOCK_SEND_IN_BROWSER;
  });
  const f=await setup(t);
  const browser=await chromium.launch({headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:390,height:850}});
  await page.goto(f.base+'/enviar');
  await page.waitForFunction(()=>document.querySelector('#quickAllowed')?.textContent==='2');
  await page.locator('#quickPhone').fill('31988887777');
  await page.locator('#quickLookup').click();
  await page.locator('#quickGoMessage').click();
  await page.locator('#quickGroup').fill(group);
  await page.locator('#quickCreate').click();
  await page.locator('#quickStage3').waitFor({state:'visible'});
  const copia=await page.locator('#quickFinalText').innerText();
  assert.match(copia,/Entrar no grupo de ofertas/);
  await page.locator('#quickCopyText').click();
  assert.match(await page.locator('#quickToast').innerText(),/copiada|Selecione o texto/i);
  await page.locator('#quickPrepareChrome').click();
  await page.locator('#quickResult.is-warning').waitFor({state:'visible',timeout:45000});
  assert.match(await page.locator('#quickResult').innerText(),/sem|confirm|concilie/i);
  assert.equal(await page.locator('#quickConfirmChrome').isDisabled(),true);
  assert.equal(await page.locator('#quickPrepareChrome').isDisabled(),true);
  assert.equal(await page.locator('#quickFinalText').innerText(),copia,
    'O painel preserva a mensagem integral para o usuário');
  const filas=(await get(f.base,'/api/local/campanhas/convite/filas')).filas;
  assert.equal(filas.length,1);
  assert.equal(filas[0].incertos,1);
  assert.equal(filas[0].manuais,0);
  assert.equal(await page.evaluate(()=>
    document.documentElement.scrollWidth<=document.documentElement.clientWidth+2),true);
});
