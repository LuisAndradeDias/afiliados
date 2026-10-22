import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  enviarLinkSolicitado, FalhaLinkWhatyGo, diagnosticoSeguroEnvio,
} from '../src/whatygo-responder-link.mjs';
import { iniciarRespostasBotoes } from '../src/respostas-botoes.mjs';

const PHONE = '5511999990000';
const SENDER = '5522999930000';
const GROUP = 'https://chat.whatsapp.com/abcdefghijklmnopqrstuv';
const NOW = new Date('2026-10-22T20:25:00.000Z');
const PRIVATE = { token:'fake-test-instance-token', storedJid:SENDER+':4@s.whatsapp.net', adminKey:'fake-test-admin-key' };
const state={data:[{
  name:'cpv-lab-remetente-4306',connected:true,
  jid:SENDER+':8@s.whatsapp.net',token:PRIVATE.token,
}]};
const success={message:'success',data:{Info:{ID:'3EB0TESTCONFIRMED123456789'}}};

function stubFetch({ session = state, getStatus = 200, postStatus = 200, body = success, throwPost = null } = {}) {
  const requests=[];
  const fake=async (url, options)=>{
    const method=options.method || 'GET';
    requests.push({method,path:new URL(url).pathname});
    if(method==='GET'){
      return {ok:getStatus===200,status:getStatus,json:async()=>session};
    }
    if(method!=='POST')throw Error('Unexpected HTTP method');
    if(throwPost)throw throwPost;
    const payload=JSON.parse(options.body);
    assert.equal(payload.number,PHONE);
    assert.match(payload.text,/chat\.whatsapp\.com/);
    assert.ok(options.headers.apikey===PRIVATE.token);
    return {ok:postStatus===200,status:postStatus,json:async()=>body};
  };
  return {requests,fake};
}
const run=(fake)=>enviarLinkSolicitado({
  telefone:PHONE,urlGrupo:GROUP,fetchImpl:fake,credenciais:()=>PRIVATE,
});

test('valid sender and API ID report acknowledgement, not delivery',async ()=>{
  const {requests,fake}=stubFetch();
  assert.deepEqual(await run(fake),{aceitoPelaApi:true});
  assert.deepEqual(requests.map(x=>x.method),['GET','POST']);
});

test('session HTTP rejection stops BEFORE post, with safe classification',async ()=>{
  const {requests,fake}=stubFetch({getStatus:503});
  await assert.rejects(()=>run(fake),e=>{
    assert.ok(e instanceof FalhaLinkWhatyGo);
    assert.deepEqual([e.codigo,e.etapa,e.statusHttp],['sessao-http','preenvio',503]);
    const d=diagnosticoSeguroEnvio(e);
    assert.match(d.texto,/HTTP 503/);
    assert.match(d.texto,/Nenhuma mensagem/);
    return true;
  });
  assert.deepEqual(requests.map(x=>x.method),['GET']);
});

test('wrong sender or disconnected session never posts text',async ()=>{
  for(const session of [
    {data:[{...state.data[0],connected:false}]},
    {data:[{...state.data[0],jid:'5511888880000@s.whatsapp.net'}]},
    {data:[{...state.data[0],token:'wrong'}]},
  ]){
    const {requests,fake}=stubFetch({session});
    await assert.rejects(()=>run(fake),e=>e.codigo==='sessao-nao-verificada');
    assert.deepEqual(requests.map(x=>x.method),['GET']);
  }
});

test('WhatyGo HTTP rejection is recorded as uncertain after ONE POST',async ()=>{
  const {requests,fake}=stubFetch({postStatus:400});
  await assert.rejects(()=>run(fake),e=>{
    const d=diagnosticoSeguroEnvio(e);
    assert.equal(d.codigo,'envio-http');
    assert.equal(d.etapa,'apos-solicitacao');
    assert.equal(d.statusHttp,400);
    assert.match(d.texto,/HTTP 400/);
    assert.doesNotMatch(d.texto,new RegExp(PHONE));
    assert.doesNotMatch(d.texto,/token/);
    return true;
  });
  assert.deepEqual(requests.map(x=>x.method),['GET','POST']);
});

test('post timeout or invalid confirmation never causes an automatic retry',async ()=>{
  const timeout=new Error('private WhatsApp details should never leak');
  timeout.name='AbortError';
  const one=stubFetch({throwPost:timeout});
  await assert.rejects(()=>run(one.fake),e=>{
    assert.equal(e.codigo,'envio-timeout');
    assert.equal(e.etapa,'apos-solicitacao');
    assert.doesNotMatch(diagnosticoSeguroEnvio(e).texto,/private WhatsApp details/);
    return true;
  });
  assert.equal(one.requests.filter(x=>x.method==='POST').length,1);

  const two=stubFetch({body:{message:'success',data:{}}});
  await assert.rejects(()=>run(two.fake),e=>e.codigo==='envio-resposta-invalida');
  assert.equal(two.requests.filter(x=>x.method==='POST').length,1);
});

test('preflight failure is shown separately and cannot be used to bypass the 24h limit',async t=>{
  const dataDir=mkdtempSync(join(tmpdir(),'cpv-whatygo-stages-'));
  t.after(()=>rmSync(dataDir,{recursive:true,force:true}));
  const contact={
    id:'741acf0e-e956-49cc-9b27-bdef37e9f8df',telefone:PHONE,
    status:'ativo',consentimentoConfirmadoEm:NOW.toISOString(),
    evidencia:'autorizacao-externa-declarada-com-origem-e-data',
    registroAutorizacao:{origem:'autorizacao-declarada-pelo-titular',
      referencia:'registro-teste',dataAutorizacao:'2026-10-22',
      declaradoEm:NOW.toISOString()},
  };
  let calls=0;
  const service=iniciarRespostasBotoes({
    dataDir,agora:()=>NOW,contatos:{listar:()=>[contact]},
    denuncias:{estaBloqueado:()=>false,registrar:()=>({duplicada:false})},
    convites:{configuracao:()=>({grupoUrl:GROUP})},
    enviarLink:async()=>{
      calls++;
      throw new FalhaLinkWhatyGo('sessao-http','preenvio',503);
    },
  });
  const click=(id)=>({
    event:'ButtonClick',instanceName:'cpv-lab-remetente-4306',
    data:{buttonId:'aceitar_grupo',messageId:id,
      phone:PHONE+'@s.whatsapp.net',jid:PHONE+'@s.whatsapp.net',
      chat:PHONE+'@s.whatsapp.net',fromMe:false,
      timestamp:Math.floor(NOW.getTime()/1000)},
  });
  service.configurarAutomacao({habilitada:true,confirmado:true});
  assert.equal(service.receive(click('ONECLICKFORBASIC01')).status,'auto-na-fila');
  await new Promise(resolve=>setTimeout(resolve,50));
  assert.equal(service.list().registros[0].status,'auto-falha-preenvio');
  assert.equal(service.list().registros[0].diagnostico.etapa,'preenvio');
  assert.match(service.list().registros[0].detalhe,/HTTP 503/);
  assert.equal(service.list().registros[0].linkGrupo,GROUP);
  assert.equal(service.receive(click('TWOCLICKSAMEPHONE02')).status,'auto-limite-contato');
  assert.equal(calls,1);
  assert.equal(service.list().total.respostasAutomaticas,0);
});

test('HTTP failure after POST remains uncertain, records safe cause, offers only manual copy',async t=>{
  const dataDir=mkdtempSync(join(tmpdir(),'cpv-whatygo-http-'));
  t.after(()=>rmSync(dataDir,{recursive:true,force:true}));
  const contact={
    id:'741acf0e-e956-49cc-9b27-bdef37e9f8df',telefone:PHONE,
    status:'ativo',consentimentoConfirmadoEm:NOW.toISOString(),
    evidencia:'autorizacao-externa-declarada-com-origem-e-data',
    registroAutorizacao:{
      origem:'autorizado-explicitamente',
      referencia:'teste-laboratorio',
      dataAutorizacao:'2026-10-22',
      declaradoEm:NOW.toISOString(),
    },
  };
  let sendCalls=0;
  const service=iniciarRespostasBotoes({
    dataDir,agora:()=>NOW,
    contatos:{listar:()=>[contact]},
    denuncias:{estaBloqueado:()=>false,registrar:()=>({duplicada:false})},
    convites:{configuracao:()=>({grupoUrl:GROUP})},
    enviarLink:async()=>{sendCalls++;throw new FalhaLinkWhatyGo('envio-http','apos-solicitacao',502);},
  });
  const click=(id)=>({
    event:'ButtonClick',instanceName:'cpv-lab-remetente-4306',
    data:{
      buttonId:'aceitar_grupo',messageId:id,
      phone:PHONE+'@s.whatsapp.net',jid:PHONE+'@s.whatsapp.net',
      chat:PHONE+'@s.whatsapp.net',fromMe:false,
      timestamp:Math.floor(NOW.getTime()/1000),
    },
  });
  service.configurarAutomacao({habilitada:true,confirmado:true});
  assert.equal(service.receive(click('MOCKHTTPERROR001')).status,'auto-na-fila');
  await new Promise(resolve=>setTimeout(resolve,50));
  const row=service.list().registros[0];
  assert.equal(row.status,'auto-incerto');
  assert.equal(row.diagnostico.codigo,'envio-http');
  assert.equal(row.diagnostico.etapa,'apos-solicitacao');
  assert.match(row.detalhe,/HTTP 502/);
  assert.equal(row.linkGrupo,GROUP);
  assert.equal(service.receive(click('MOCKHTTPERROR002')).status,'auto-limite-contato');
  assert.equal(sendCalls,1);
  assert.doesNotMatch(JSON.stringify(service.list()),new RegExp(PHONE));
});
