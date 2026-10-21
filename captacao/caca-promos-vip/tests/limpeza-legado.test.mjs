import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarServidor } from '../src/server.mjs';

test('tela de captacao aposentada; a mesma URL abre o envio guiado local sem chave', async t => {
  const temp=mkdtempSync(join(tmpdir(),'cpv-limpeza-'));
  t.after(()=>rmSync(temp,{recursive:true,force:true}));
  const app=await iniciarServidor({dataDir:temp,port:0,metaAmbiente:{}});
  t.after(()=>new Promise(ok=>app.servidor.close(ok)));
  const base=app.base;
  for(const caminho of ['/','/painel']){
    const response=await fetch(base+caminho,{redirect:'manual'});
    assert.equal(response.status,302,caminho);
    assert.equal(response.headers.get('location'),'/enviar');
  }
  const response=await fetch(base+'/painel');
  assert.equal(response.url,base+'/enviar');
  const content=await response.text();
  assert.match(content,/id="quickPhone"/);
  assert.match(content,/id="quickLookup"/);
  assert.match(content,/id="quickCreate"/);
  assert.match(content,/href="\/campanhas"/);
  const advanced=await (await fetch(base+'/campanhas')).text();
  assert.match(advanced,/id="singleText"/);
  assert.match(advanced,/id="simulateSingle"/);
  assert.match(advanced,/id="importFile"/);
  assert.doesNotMatch(content,/id="startGuide"|id="groupCard"|id="manualLegacy"/);
  assert.doesNotMatch(content,/href="\/painel"/);
  assert.doesNotMatch(content,/id="adminKey"/);
  assert.equal((await fetch(base+'/assets/campanhas.js')).status,200);
  assert.equal((await fetch(base+'/assets/painel.js')).status,404);
  assert.equal((await fetch(base+'/assets/importacao.js')).status,404);
});

test('cadastros autorizados e descadastro continuam funcionais após remover UI antiga',async t=>{
  const temp=mkdtempSync(join(tmpdir(),'cpv-consentimento-preservado-'));
  t.after(()=>rmSync(temp,{recursive:true,force:true}));
  const app=await iniciarServidor({dataDir:temp,port:0,metaAmbiente:{}});
  t.after(()=>new Promise(ok=>app.servidor.close(ok)));
  const base=app.base;
  assert.equal((await fetch(base+'/api/admin/contatos')).status,401);
  const convite=await fetch(base+'/c/instagram');
  assert.equal(convite.status,200,'landing voluntaria de opt-in permanece separada');
  const cancelar=await fetch(base+'/sair?token=exemplo');
  assert.equal(cancelar.status,200);
  assert.match(await cancelar.text(),/unsubscribeButton/);
  assert.equal((await fetch(base+'/assets/descadastro.js')).status,200);
  const cadastro=await fetch(base+'/api/cadastro',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({nome:'Pessoa Ficticia',telefone:'11988887777',
      consentimento:true,origem:'teste'}),
  });
  assert.equal(cadastro.status,200);
  const dados=await cadastro.json();
  assert.equal(dados.ok,true);
  assert.ok(existsSync(join(temp,'contatos-autorizados.json')),'Dados persistidos');
  const token=JSON.parse(readFileSync(join(temp,'contatos-autorizados.json'),'utf8'))
    .contatos[0].tokenDescadastro;
  const remover=await fetch(base+'/api/descadastro',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({token}),
  });
  assert.equal(remover.status,200);
  assert.equal((await remover.json()).ok,true);
});
