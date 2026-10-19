import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarServidor } from '../src/server.mjs';

test('painel de campanhas requer administrador e só permite fila com opt-in', async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cpv-campanhas-http-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const app=await iniciarServidor({port:0,dataDir:dir});
  t.after(()=>new Promise(resolve=>app.servidor.close(resolve)));
  const url=app.base;
  const req=async(path,body,cookie='',headers={})=>{
    const method=body===undefined?'GET':'POST';
    const options={method,headers:cookie?{cookie,...headers}:{...headers}};
    if(body!==undefined){
      options.headers['content-type']='application/json';
      options.body=JSON.stringify(body);
    }
    const resposta=await fetch(url+path,options);
    const dados=await resposta.json().catch(()=>({}));
    return {status:resposta.status,dados,cookie:resposta.headers.get('set-cookie')};
  };
  const painel=await fetch(url+'/campanhas');
  assert.equal(painel.status,200);
  const html=await painel.text();
  assert.match(html,/Central de campanhas|CENTRAL DE CAMPANHAS/);
  assert.match(html,/id="importFile"/);
  assert.match(html,/id="createCampaign"/);
  const javascript=await fetch(url+'/assets/campanhas.js');
  assert.equal(javascript.status,200);
  assert.match(await javascript.text(),/api\/local\/campanhas\/preparar/);

  assert.equal((await req('/api/admin/campanhas')).status,401);
  assert.equal((await req('/api/admin/campanhas',{nome:'Nao permitido'})).status,401);
  const login=await req('/api/admin/login',{chave:app.chave});
  assert.equal(login.status,200);
  const cookie=login.cookie.split(';')[0];
  assert.equal((await req('/api/admin/campanhas',{nome:'Sem protecao'},cookie)).status,403);
  const adm={'x-cpv-admin':'1'};
  const aguardando=app.contatos.cadastrar({nome:'Pessoa aguardando',telefone:'11988887777',
    origem:'teste-campanhas',consentimento:true});
  const candidato=app.contatos.listar().find(x=>x.telefone==='5511988887777');
  const campanha={
    nome:'Campanha autorizada',grupo:'Grupo de exemplo',
    modelo:'Olá {nome}, novidades do {grupo}',contatoIds:[candidato.id],
  };
  assert.equal((await req('/api/admin/campanhas',campanha,cookie,adm)).status,409);
  app.contatos.configurarRemetente('11999998888');
  app.contatos.confirmar({id:candidato.id,codigo:aguardando.codigo,evidencia:'mensagem-recebida'});
  const destinatarios=await req('/api/admin/campanhas/destinatarios',undefined,cookie);
  assert.equal(destinatarios.status,200);
  assert.equal(destinatarios.dados.destinatarios.length,1);
  assert.equal(destinatarios.dados.destinatarios[0].telefone,'5511988887777');
  assert.equal(destinatarios.dados.destinatarios[0].codigoConfirmacao,undefined);
  const criada=await req('/api/admin/campanhas',campanha,cookie,adm);
  assert.equal(criada.status,200,JSON.stringify(criada.dados));
  const id=criada.dados.campanha.id;
  const resumo=await req('/api/admin/campanhas',undefined,cookie);
  assert.equal(resumo.dados.campanhas[0].pendentes,1);
  const detalhe=await req('/api/admin/campanhas/detalhe?id='+id,undefined,cookie);
  assert.equal(detalhe.dados.campanha.itens.length,1);
  const previa=await req('/api/admin/campanhas/preparar',
    {campanhaId:id,contatoId:candidato.id},cookie,adm);
  assert.equal(previa.status,200);
  assert.ok(previa.dados.mensagem.url.startsWith('https://wa.me/5511988887777'));
  assert.match(previa.dados.mensagem.mensagem,/responda SAIR/);
  assert.equal((await req('/api/admin/campanhas/registrar',
    {campanhaId:id,contatoId:candidato.id,enviado:false},cookie,adm)).status,409);
  const marcado=await req('/api/admin/campanhas/registrar',
    {campanhaId:id,contatoId:candidato.id,enviado:true},cookie,adm);
  assert.equal(marcado.status,200);
  assert.equal((await req('/api/admin/campanhas/registrar',
    {campanhaId:id,contatoId:candidato.id,enviado:true},cookie,adm)).status,409);
  const final=await req('/api/admin/campanhas',undefined,cookie);
  assert.equal(final.dados.campanhas[0].enviados,1);
});
