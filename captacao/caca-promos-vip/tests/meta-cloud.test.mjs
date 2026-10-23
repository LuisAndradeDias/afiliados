import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  obterConfigMeta, resumoMeta, verificarAssinaturaMeta, verificarDesafioMeta,
  lerEventosMeta, montarConviteMeta,
} from '../src/meta-cloud.mjs';
import { iniciarContatos } from '../src/contatos.mjs';
import { iniciarCampanhas } from '../src/campanhas.mjs';
import { iniciarDenuncias } from '../src/denuncias.mjs';
import { iniciarServidor } from '../src/server.mjs';

const ambiente={
  WA_META_GRAPH_VERSION:'v25.0',
  WA_META_PHONE_NUMBER_ID:'123456789012345',
  WA_META_WABA_ID:'987654321987654',
  WA_META_ACCESS_TOKEN:'EAA_TEST_TOKEN_'.repeat(4),
  WA_META_APP_SECRET:'app-secret-super-forte-para-teste',
  WA_META_WEBHOOK_VERIFY_TOKEN:'verificacao-teste-com-mais-de-24-caracteres',
  WA_META_TEMPLATE_NAME:'convite_ofertas_v1',
};
const config=obterConfigMeta(ambiente);
const rawPayload = (mensagem,phoneId=config.telefoneId) => ({
  object:'whatsapp_business_account',
  entry:[{id:config.wabaId,changes:[{
    field:'messages',
    value:{messaging_product:'whatsapp',
      metadata:{phone_number_id:phoneId},
      messages:[mensagem],
    },
  }]}],
});
function msg({id='wamid.TESTE_123456',from='5511988887777',payload='CPV_DENUNCIAR'}={}){
  return {id,from,type:'button',button:{text:'Denunciar convite',payload}};
}

test('Meta Cloud: configuração sem segredos expostos e envio desligado',()=>{
  assert.equal(config.configuracaoValida,true);
  const publicInfo=resumoMeta(config);
  assert.equal(publicInfo.configuracaoPreenchida,true);
  assert.equal(publicInfo.contaConectada,false);
  assert.equal(publicInfo.envioAtivo,false);
  assert.equal(JSON.stringify(publicInfo).includes(ambiente.WA_META_ACCESS_TOKEN),false);
  assert.equal(resumoMeta(obterConfigMeta({})).configuracaoPreenchida,false);
});
test('modelo com duas respostas rápidas, sem envio externo',()=>{
  const body=montarConviteMeta({
    para:'5511988887777',nome:'Ana',grupo:'Grupo de ofertas',
  });
  assert.equal(body.messaging_product,'whatsapp');
  assert.equal(body.template.name,'convite_ofertas_v1');
  assert.equal(body.template.components[0].parameters[0].payload,'CPV_ENTRAR');
  assert.equal(body.template.components[1].parameters[0].payload,'CPV_NAO_INTERESSE');
  assert.equal(body.template.components.length,2,'Mensagem identica para todos, sem variaveis');
  assert.throws(()=>montarConviteMeta({para:'inválido'}),/inválido/);
});
test('validação de desafio e assinatura HMAC em tempo constante',()=>{
  const query=new URLSearchParams({
    'hub.mode':'subscribe','hub.verify_token':config.webhookToken,'hub.challenge':'7392394',
  });
  assert.equal(verificarDesafioMeta(query,config.webhookToken),'7392394');
  query.set('hub.verify_token','errado');
  assert.equal(verificarDesafioMeta(query,config.webhookToken),null);
  const raw=Buffer.from(JSON.stringify(rawPayload(msg())));
  const ass='sha256='+createHmac('sha256',config.appSecret).update(raw).digest('hex');
  assert.equal(verificarAssinaturaMeta(raw,ass,config.appSecret),true);
  assert.equal(verificarAssinaturaMeta(Buffer.from('alterado'),ass,config.appSecret),false);
  assert.equal(verificarAssinaturaMeta(raw,'sha256=1234',config.appSecret),false);
});
test('eventos limitados ao identificador do telefone Meta configurado',()=>{
  const payload=rawPayload(msg());
  const eventos=lerEventosMeta(payload,config.telefoneId);
  assert.equal(eventos.length,1);
  assert.equal(eventos[0].tipo,'denuncia');
  assert.deepEqual(lerEventosMeta(rawPayload(msg(),'111222333444555'),config.telefoneId),[]);
  const entrar=lerEventosMeta(rawPayload(msg({payload:'CPV_ENTRAR'})),config.telefoneId);
  assert.equal(entrar[0].tipo,'entrar');
  const saida=lerEventosMeta(rawPayload({
    id:'wamid.TESTE_SAIR',from:'5511988887777',type:'text',text:{body:'SAIR'},
  }),config.telefoneId);
  assert.equal(saida[0].tipo,'sair');
});
test('denúncia bloqueia contato no CRM e em campanhas, mesmo após nova importação',t=>{
  const dir=mkdtempSync(join(tmpdir(),'cpv-meta-bloqueio-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const contatos=iniciarContatos(dir);
  contatos.configurarRemetente('11999998888');
  const c=contatos.cadastrar({nome:'Ana Teste',telefone:'11988887777',
    origem:'teste',consentimento:true});
  const contato=contatos.listar()[0];
  contatos.confirmar({id:contato.id,codigo:c.codigo,evidencia:'mensagem-recebida'});
  const bloqueios=iniciarDenuncias(dir,contatos);
  const campanhas=iniciarCampanhas(dir,contatos,undefined,bloqueios);
  const envio=campanhas.criar({
    nome:'Ofertas de teste',grupo:'Grupo fictício',
    modelo:'Olá {nome}, novidades de {grupo}',contatoIds:[contato.id],
  });
  assert.equal(campanhas.obter(envio.id).pendentes,1);
  const primeiro=bloqueios.registrar({telefone:contato.telefone,mensagemId:'wamid.TESTE_123456'});
  assert.equal(primeiro.duplicada,false);
  assert.equal(bloqueios.estaBloqueado(contato.telefone),true);
  assert.equal(contatos.listar()[0].status,'descadastrado');
  assert.equal(campanhas.obter(envio.id).bloqueados,1);
  assert.equal(campanhas.destinatarios().length,0);
  assert.throws(()=>campanhas.prepararMensagem({
    campanhaId:envio.id,contatoId:contato.id,
  }),/bloqueado|sem autorização/);
  assert.equal(bloqueios.registrar({
    telefone:contato.telefone,mensagemId:'wamid.TESTE_123456',
  }).duplicada,true);
  assert.equal(bloqueios.resumo().denuncias,1);
  contatos.cadastrar({nome:'Ana Teste',telefone:'11988887777',
    origem:'teste',consentimento:true});
  assert.equal(campanhas.destinatarios().length,0);
  const novo=iniciarDenuncias(dir,contatos);
  assert.equal(novo.estaBloqueado(contato.telefone),true);
  assert.equal(novo.listar()[0].telefoneMascarado.includes('7777'),true);
});

test('Webhook local verifica assinatura e bloqueia somente ao receber clique válido',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cpv-meta-webhook-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const app=await iniciarServidor({dataDir:dir,port:0,metaAmbiente:ambiente});
  t.after(()=>new Promise(done=>app.servidor.close(done)));
  app.contatos.configurarRemetente('11999998888');
  const cadastro=app.contatos.cadastrar({nome:'Ana Fictícia',telefone:'11988887777',
    origem:'teste',consentimento:true});
  const contato=app.contatos.listar()[0];
  app.contatos.confirmar({id:contato.id,codigo:cadastro.codigo,evidencia:'mensagem-recebida'});
  const base=app.base;
  const verify=new URLSearchParams({
    'hub.mode':'subscribe','hub.verify_token':config.webhookToken,'hub.challenge':'7392394',
  });
  assert.equal((await fetch(base+'/webhooks/whatsapp?'+verify)).status,200);
  verify.set('hub.verify_token','incorreto');
  assert.equal((await fetch(base+'/webhooks/whatsapp?'+verify)).status,403);
  const body=JSON.stringify(rawPayload(msg()));
  assert.equal((await fetch(base+'/webhooks/whatsapp',{
    method:'POST',body,headers:{'content-type':'application/json',
      'x-hub-signature-256':'sha256='+'0'.repeat(64)},
  })).status,403);
  assert.equal(app.contatos.listar()[0].status,'ativo');
  const sig='sha256='+createHmac('sha256',config.appSecret).update(body).digest('hex');
  const req=()=>fetch(base+'/webhooks/whatsapp',{
    method:'POST',body,headers:{'content-type':'application/json',
      'x-hub-signature-256':sig},
  });
  assert.equal((await req()).status,200);
  assert.equal((await req()).status,200);
  assert.equal(app.contatos.listar()[0].status,'descadastrado');
  const detalhes=await (await fetch(base+'/api/local/campanhas/meta')).json();
  assert.equal(detalhes.denuncias.bloqueados,1);
  assert.equal(detalhes.denuncias.denuncias,1);
  assert.equal(JSON.stringify(detalhes).includes(ambiente.WA_META_ACCESS_TOKEN),false);
});

test('sem credenciais Meta, webhook não recebe eventos',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cpv-meta-desligado-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const app=await iniciarServidor({dataDir:dir,port:0,metaAmbiente:{}});
  t.after(()=>new Promise(done=>app.servidor.close(done)));
  assert.equal((await fetch(app.base+'/webhooks/whatsapp')).status,503);
  assert.equal((await fetch(app.base+'/webhooks/whatsapp',{
    method:'POST',body:'{}',
  })).status,503);
  const configPublica=await (await fetch(app.base+'/api/local/campanhas/meta')).json();
  assert.equal(configPublica.integracao.envioAtivo,false);
});
