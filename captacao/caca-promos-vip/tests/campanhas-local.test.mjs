import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { iniciarServidor } from '../src/server.mjs';

test('campanhas abrem sem chave apenas no localhost, com protecao de origem',async t=>{
  const dados=mkdtempSync(join(tmpdir(),'cpv-campanhas-sem-chave-'));
  t.after(()=>rmSync(dados,{recursive:true,force:true}));
  const app=await iniciarServidor({dataDir:dados,host:'127.0.0.1',port:0});
  t.after(()=>new Promise(done=>app.servidor.close(done)));
  const base=app.base;
  const origin=base;
  async function req(path,{method='GET',data,headers={}}={}){
    const init={method,headers:{...headers}};
    if(data!==undefined){
      init.headers['content-type']='application/json';
      init.body=JSON.stringify(data);
    }
    const response=await fetch(base+path,init);
    const contentType=response.headers.get('content-type') || '';
    const body=contentType.includes('json')
      ? await response.json() : await response.text();
    return {status:response.status,body,headers:response.headers};
  }
  function post(path,data,headers={}){
    return req(path,{method:'POST',data,
      headers:{origin,'x-cpv-local':'1',...headers}});
  }
  const initial=await req('/campanhas');
  assert.equal(initial.status,200);
  assert.doesNotMatch(initial.body,/id="loginForm"|id="adminKey"/);
  assert.match(initial.body,/id="importFile"/);
  assert.match(initial.body,/id="senderPhone"/);
  const endpoint=await req('/api/local/campanhas');
  assert.equal(endpoint.status,200);
  assert.deepEqual(endpoint.body.campanhas,[]);
  assert.match(endpoint.headers.get('cache-control'),/no-store/);
  assert.equal((await req('/api/admin/campanhas')).status,401);
  assert.equal((await req('/api/admin/contatos')).status,401);
  // Node fetch sempre usa o Host da URL. O socket HTTP cru permite
  // verificar a rejeição de um Host falsificado (proteção contra DNS rebinding).
  async function hostFalso(caminho){
    return new Promise((resolve,reject)=>{
      const url=new URL(base);
      const chamada=httpRequest({
        hostname:'127.0.0.1',port:Number(url.port),method:'GET',path:caminho,
        headers:{host:'evil.example'},
      },res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
      chamada.on('error',reject);
      chamada.end();
    });
  }
  assert.equal(await hostFalso('/api/local/campanhas'),403);
  assert.equal((await req('/api/local/campanhas',{
    headers:{'sec-fetch-site':'cross-site'}})).status,403);
  assert.equal(await hostFalso('/campanhas'),403);
  assert.equal((await req('/api/local/campanhas/remetente',{
    method:'POST',data:{telefone:'11999998888'},
    headers:{origin:'http://outro.site','x-cpv-local':'1'},
  })).status,403);
  assert.equal((await req('/api/local/campanhas/remetente',{
    method:'POST',data:{telefone:'11999998888'},
    headers:{origin},
  })).status,403);
  assert.equal((await req('/api/local/campanhas/remetente',{
    method:'POST',data:{telefone:'11999998888'},
    headers:{'x-cpv-local':'1'},
  })).status,403);
  assert.equal((await req('/api/local/campanhas/remetente',{
    method:'POST',data:{telefone:'11999998888'},
    headers:{origin,'x-cpv-local':'1','sec-fetch-site':'cross-site'},
  })).status,403);

  const autorizar=app.contatos.cadastrar({
    nome:'Ana Pessoa Fictícia',telefone:'11988887777',origem:'teste-local',consentimento:true
  });
  const pessoa=app.contatos.listar().find(c=>c.telefone==='5511988887777');
  assert.equal((await req('/api/local/campanhas/destinatarios')).body.destinatarios.length,0);
  const config=await post('/api/local/campanhas/remetente',{telefone:'11999998888'});
  assert.equal(config.status,200);
  assert.equal(config.body.remetente,'5511999998888');
  const leituraConfig=await req('/api/local/campanhas/configuracao');
  assert.equal(leituraConfig.status,200);
  assert.equal(leituraConfig.body.remetenteConfigurado,true);
  app.contatos.confirmar({id:pessoa.id,codigo:autorizar.codigo,evidencia:'mensagem-recebida'});
  const elegiveis=await req('/api/local/campanhas/destinatarios');
  assert.equal(elegiveis.body.destinatarios.length,1);
  assert.equal(elegiveis.body.destinatarios[0].telefone,'5511988887777');
  assert.equal(elegiveis.body.destinatarios[0].tokenDescadastro,undefined);
  const campanha=await post('/api/local/campanhas',{
    nome:'Ofertas da semana',grupo:'Comunidade fictícia',
    modelo:'Olá {nome}, ofertas de {grupo}',contatoIds:[pessoa.id],
  });
  assert.equal(campanha.status,200,JSON.stringify(campanha.body));
  const id=campanha.body.campanha.id;
  const preparada=await post('/api/local/campanhas/preparar',{
    campanhaId:id,contatoId:pessoa.id,
  });
  assert.equal(preparada.status,200);
  assert.match(preparada.body.mensagem.url,/^https:\/\/wa\.me\/5511988887777\?text=/);
  const registrado=await post('/api/local/campanhas/registrar',{
    campanhaId:id,contatoId:pessoa.id,enviado:true,
  });
  assert.equal(registrado.status,200);
  assert.equal((await req('/api/local/campanhas')).body.campanhas[0].enviados,1);
  assert.equal((await req('/api/admin/campanhas')).status,401);
});

test('acesso sem chave não é disponibilizado pelo servidor em IPv6 loopback',async t=>{
  const dados=mkdtempSync(join(tmpdir(),'cpv-campanhas-ipv6-'));
  t.after(()=>rmSync(dados,{recursive:true,force:true}));
  let app;
  try {
    app=await iniciarServidor({dataDir:dados,host:'::1',port:0});
  } catch(e) {
    if(['EADDRNOTAVAIL','EAFNOSUPPORT'].includes(e.code)) return;
    throw e;
  }
  t.after(()=>new Promise(done=>app.servidor.close(done)));
  const res=await fetch(app.base.replace('http://::1:','http://[::1]:')+'/campanhas');
  assert.equal(res.status,403);
});
