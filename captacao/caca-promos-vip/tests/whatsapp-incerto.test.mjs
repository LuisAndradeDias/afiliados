import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {iniciarServidor} from '../src/server.mjs';
import {iniciarContatos} from '../src/contatos.mjs';
import {iniciarDenuncias} from '../src/denuncias.mjs';
import {iniciarConvitesUnicos} from '../src/convites-unicos.mjs';
import {obterConfigMeta} from '../src/meta-cloud.mjs';

async function fixture(t){
  const dir=mkdtempSync(join(tmpdir(),'cpv-incerto-'));
  t.after(()=>rmSync(dir,{force:true,recursive:true}));
  const app=await iniciarServidor({dataDir:dir,port:0,
    whatsappWorkerTeste:true,metaAmbiente:{}});
  t.after(()=>new Promise(done=>app.servidor.close(done)));
  app.contatos.configurarRemetente('11999998888');
  const cadastro=app.contatos.cadastrar({nome:'Pessoa Teste',
    telefone:'11988887777',origem:'teste',consentimento:true});
  const contato=app.contatos.listar()[0];
  app.contatos.confirmar({id:contato.id,codigo:cadastro.codigo,
    evidencia:'mensagem-recebida'});
  const base=app.base;
  const post=(path,body)=>fetch(base+path,{
    method:'POST',
    headers:{origin:base,'content-type':'application/json','x-cpv-local':'1'},
    body:JSON.stringify(body),
  });
  assert.equal((await post('/api/local/campanhas/convite/modelo',{
    mensagem:'Olá! Você autorizou receber convites do Caça Promos VIP. Entre no grupo gratuito de ofertas se desejar, ou responda SAIR.',
    grupoUrl:'https://chat.whatsapp.com/FicticioGrupo987',
    nomeModelo:'convite_ofertas_v1',
  })).status,200);
  const criado=await post('/api/local/campanhas/convite/fila',{
    nome:'Teste de incerteza',modo:'web',contatoIds:[contato.id],
  });
  assert.equal(criado.status,200);
  const fila=(await criado.json()).fila;
  const ids={campanhaId:fila.id,contatoId:contato.id};
  const status=async()=>(
    await (await fetch(base+'/api/local/campanhas/convite/whatsapp/estado')).json()
  ).estado;
  const detalhe=async()=>(
    await (await fetch(base+'/api/local/campanhas/convite/fila?id='+fila.id)).json()
  ).fila;
  async function esperar(fase,timeout=25000){
    const inicio=Date.now();let ultimo;
    do{
      ultimo=await status();
      if(ultimo.fase===fase)return ultimo;
      if(['erro','incerto','cancelado','confirmado'].includes(ultimo.fase))
        throw new Error('Falha antes de '+fase+': '+JSON.stringify(ultimo));
      await new Promise(r=>setTimeout(r,75));
    }while(Date.now()-inicio<timeout);
    throw new Error('Timeout '+fase+': '+JSON.stringify(ultimo));
  }
  return {app,dir,post,status,detalhe,esperar,ids};
}

test('queda simulada após clique mantém tentativa incerta em disco e impede reenvio',async t=>{
  process.env.CPV_WHATSAPP_MOCK_FAIL_AFTER_CLICK='true';
  t.after(()=>delete process.env.CPV_WHATSAPP_MOCK_FAIL_AFTER_CLICK);
  const f=await fixture(t);
  assert.equal((await f.post('/api/local/campanhas/convite/whatsapp/preparar',
    f.ids)).status,202);
  await f.esperar('pronto');
  assert.equal((await f.post('/api/local/campanhas/convite/whatsapp/enviar',
    {...f.ids,confirmar:true})).status,202);
  const reservada=await f.detalhe();
  assert.equal(reservada.incertos,1,'Registro persistido antes do clique');
  assert.equal(reservada.manuais,0,'Não marca enviado sem confirmação');
  await f.esperar('incerto');
  assert.equal((await f.post('/api/local/campanhas/convite/whatsapp/preparar',
    f.ids)).status,409,'Sem reenvio automático/duplicado');

  const contatos=iniciarContatos(f.dir);
  const bloqueios=iniciarDenuncias(f.dir,contatos);
  const reiniciado=iniciarConvitesUnicos({dataDir:f.dir,contatos,bloqueios,
    configMeta:obterConfigMeta({}),
    grupoInicial:'https://chat.whatsapp.com/FicticioGrupo987'});
  assert.equal(reiniciado.detalhesFila(f.ids.campanhaId).incertos,1,
    'Após novo processo permanece incerto');
  assert.throws(()=>reiniciado.prepararManual(f.ids),
    /já foi tratado/);

  const semConfirmar=await f.post('/api/local/campanhas/convite/whatsapp/conciliar',{
    ...f.ids,resultado:'enviado',confirmado:false,
  });
  assert.equal(semConfirmar.status,409);
  assert.equal((await f.detalhe()).incertos,1);
  assert.equal((await f.post('/api/local/campanhas/convite/whatsapp/conciliar',{
    ...f.ids,resultado:'enviado',confirmado:true,
  })).status,200);
  const conciliada=await f.detalhe();
  assert.equal(conciliada.manuais,1);
  assert.equal(conciliada.incertos,0);
  assert.equal((await f.post('/api/local/campanhas/convite/whatsapp/preparar',
    f.ids)).status,409,'O contato não volta a receber outro convite');
});

test('não enviado só retorna à fila após confirmação explícita e mantém limite diário',async t=>{
  const f=await fixture(t);
  assert.equal((await f.post('/api/local/campanhas/convite/manual/preparar',f.ids)).status,200);
  const contatos=iniciarContatos(f.dir);
  const bloqueios=iniciarDenuncias(f.dir,contatos);
  const convites=iniciarConvitesUnicos({dataDir:f.dir,contatos,bloqueios,
    configMeta:obterConfigMeta({}),
    grupoInicial:'https://chat.whatsapp.com/FicticioGrupo987'});
  assert.equal(convites.marcarTentativaIncerta(f.ids).status,'incerto');
  const pendente=await f.post('/api/local/campanhas/convite/whatsapp/conciliar',{
    ...f.ids,resultado:'nao-enviado',confirmado:true,
  });
  assert.equal(pendente.status,200);
  assert.equal((await f.detalhe()).pendentes,1);
  const c=(await (await fetch(f.app.base+
    '/api/local/campanhas/convite/manual/estatisticas')).json()).controle;
  assert.equal(c.iniciadosHoje,1,
    'Preparação anterior continua contando no limite do dia');
});
