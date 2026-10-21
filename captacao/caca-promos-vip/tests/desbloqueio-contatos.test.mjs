import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {iniciarServidor} from '../src/server.mjs';
import {iniciarDenuncias} from '../src/denuncias.mjs';
import {iniciarGestaoContatos} from '../src/gestao-contatos.mjs';
import {iniciarConvitesUnicos} from '../src/convites-unicos.mjs';
import {obterConfigMeta} from '../src/meta-cloud.mjs';

const require=createRequire(new URL('../../../package.json',import.meta.url));
const {chromium}=require('playwright');
const hoje=()=>new Date().toISOString().slice(0,10);
const valid={
  origemAutorizacao:'Conversa nova com o titular após o teste',
  referenciaAutorizacao:'Confirmação voluntária individual documentada para o teste',
  dataAutorizacao:hoje(),confirmado:true,novaAutorizacao:true,
};
async function fixture(t,{withQueues=false,withIncerto=false}={}){
  const dir=mkdtempSync(join(tmpdir(),'cpv-desbloqueio-ficticio-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const app=await iniciarServidor({port:0,dataDir:dir,metaAmbiente:{}});
  t.after(()=>new Promise(resolve=>app.servidor.close(resolve)));
  app.contatos.importarConsentimentosExternos({
    pessoas:[
      {nome:'Teste do próprio titular',telefone:'11988887777'},
      {nome:'Outro contato autorizado',telefone:'21988886666'},
    ],
    origemAutorizacao:'Conversa individual',
    referenciaAutorizacao:'Registro fictício de consentimento inicial',
    dataAutorizacao:hoje(),declaracao:true,
  });
  const target=app.contatos.listar().find(c=>c.nome==='Teste do próprio titular');
  const outro=app.contatos.listar().find(c=>c.nome==='Outro contato autorizado');
  const denuncias=iniciarDenuncias(dir,app.contatos);
  let filaId=null;
  if(withQueues){
    const modelo=await post(app.base,'/api/local/campanhas/convite/modelo',{
      mensagem:'Olá, você autorizou convites do Caça Promos VIP. Responda SAIR se não quiser mais.',
      grupoUrl:'https://chat.whatsapp.com/GrupoFicticioOriginal555',
      nomeModelo:'convite_ofertas_v1',
    });
    assert.equal(modelo.status,200);
    const create=await post(app.base,'/api/local/campanhas/convite/fila',{
      nome:'Campanha de teste sem mensagens reais',modo:'web',
      contatoIds:[target.id,outro.id],
    });
    assert.equal(create.status,200);
    filaId=(await create.json()).fila.id;
    if(withIncerto){
      const prep=await post(app.base,'/api/local/campanhas/convite/manual/preparar',{
        campanhaId:filaId,contatoId:target.id,
      });
      assert.equal(prep.status,200);
      const convites=iniciarConvitesUnicos({
        dataDir:dir,contatos:app.contatos,bloqueios:denuncias,
        configMeta:obterConfigMeta({}),grupoInicial:'',
      });
      assert.equal(convites.marcarTentativaIncerta({
        campanhaId:filaId,contatoId:target.id,
      }).status,'incerto');
    }
  }
  denuncias.registrar({
    telefone:target.telefone,mensagemId:'click-inicial-teste-empresa-1',
    motivo:'saida-solicitada',origem:'clique-nao-tenho-interesse-netlify',
  });
  return {app,dir,denuncias,target,outro,filaId};
}
function post(base,path,body,headers={}){
  return fetch(base+path,{method:'POST',
    headers:{origin:base,'x-cpv-local':'1','content-type':'application/json',
      ...headers},
    body:JSON.stringify(body)});
}
async function api(base,path){
  const r=await fetch(base+path);
  assert.equal(r.status,200);
  return r.json();
}

test('desbloqueio exige consentimento novo, data válida e autorização explícita',async t=>{
  const {app,target,outro,denuncias}=await fixture(t);
  const path='/api/local/gestao/contato/desbloquear';
  const base=app.base;
  const fail=async(body,pattern)=>{
    const r=await post(base,path,{id:target.id,...body});
    const data=await r.json();
    assert.equal(r.status,400,JSON.stringify(data));
    if(pattern)assert.match(data.mensagem,pattern);
  };
  await fail({...valid,confirmado:false},/confirmar/i);
  await fail({...valid,novaAutorizacao:false},/autorização/i);
  await fail({...valid,referenciaAutorizacao:'sim'},/referência/i);
  await fail({...valid,dataAutorizacao:'2020-01-01'},/posterior/i);
  await fail({...valid,dataAutorizacao:'2099-01-01'},/futura/i);
  const wrong=await post(base,path,{id:outro.id,...valid});
  assert.equal(wrong.status,400);
  const invalid=await post(base,path,{id:'nao-e-uuid',...valid});
  assert.equal(invalid.status,400);
  const cross=await post(base,path,{id:target.id,...valid},
    {origin:'https://site-malicioso.invalid'});
  assert.equal(cross.status,403);
  const lack=await fetch(base+path,{method:'POST',headers:{
    origin:base,'content-type':'application/json'},
    body:JSON.stringify({id:target.id,...valid})});
  assert.equal(lack.status,403);
  assert.equal(denuncias.resumo().bloqueados,1);
  assert.equal(app.contatos.listar().find(c=>c.id===target.id).status,'descadastrado');
});

test('nova autorização libera o cadastro, mantém o evento antigo e encerra filas antigas',async t=>{
  const {app,target,denuncias,filaId}=await fixture(t,{withQueues:true});
  assert.equal(denuncias.estaBloqueado(target.telefone),true);
  const before=(await api(app.base,'/api/local/campanhas/convite/fila?id='+filaId)).fila;
  assert.equal(before.itens.find(x=>x.contatoId===target.id).status,'bloqueado');
  const done=await post(app.base,'/api/local/gestao/contato/desbloquear',{
    id:target.id,...valid,
  });
  const result=await done.json();
  assert.equal(done.status,200,JSON.stringify(result));
  assert.equal(result?.resultado?.desbloqueado,true);
  assert.equal(result.resultado.filasAnterioresEncerradas,1);
  assert.equal(denuncias.estaBloqueado(target.telefone),false);
  const record=app.contatos.listar().find(c=>c.id===target.id);
  assert.equal(record.status,'ativo');
  assert.equal(record.descadastroEm,null);
  assert.equal(record.registroAutorizacao.tipo,'nova-autorizacao-apos-bloqueio');
  assert.equal(record.registroAutorizacao.origem,valid.origemAutorizacao);
  assert.equal(record.registroAutorizacao.dataAutorizacao,valid.dataAutorizacao);
  assert.ok(record.reativadoEm);
  const c=await api(app.base,'/api/local/gestao/contatos');
  assert.equal(c.resumo.autorizado,2);
  assert.equal(c.resumo.bloqueado,0);
  const ficha=await api(app.base,'/api/local/gestao/contato?id='+target.id);
  assert.equal(ficha.contato.status,'autorizado');
  assert.equal(ficha.contato.eventos[0].motivo,'reativacao-autorizada');
  assert.equal(ficha.contato.eventos[1].motivo,'saida-solicitada');
  assert.doesNotMatch(JSON.stringify(ficha),/5511988877777|numeroHash|tokenDescadastro/);
  const fila=(await api(app.base,'/api/local/campanhas/convite/fila?id='+filaId)).fila;
  assert.equal(fila.itens.find(x=>x.contatoId===target.id).status,'ignorado');
  assert.equal(fila.itens.find(x=>x.contatoId===target.id).confirmadoEm,null);
  assert.equal(fila.pendentes,1,'somente o outro contato permanece pendente');
  const report=await api(app.base,'/api/local/gestao/denuncias');
  assert.equal(report.resumo.saidas,1);
  assert.equal(report.resumo.reativacoes,1);
  assert.equal(report.resumo.bloqueados,0);
  assert.equal(report.ocorrencias[0].motivo,'reativacao-autorizada');
  assert.equal(report.ocorrencias[1].motivo,'saida-solicitada');
  const duplicate=await post(app.base,'/api/local/gestao/contato/desbloquear',{
    id:target.id,...valid,
  });
  assert.equal(duplicate.status,400,'não permite liberar o mesmo contato duas vezes');
});

test('pedido de saída repetido após reativação bloqueia novamente o contato',async t=>{
  const {app,target,denuncias}=await fixture(t);
  const r=await post(app.base,'/api/local/gestao/contato/desbloquear',{
    id:target.id,...valid,
  });
  assert.equal(r.status,200,await r.text());
  assert.equal(denuncias.estaBloqueado(target.telefone),false);
  const repeat=denuncias.registrar({
    telefone:target.telefone,mensagemId:'click-inicial-teste-empresa-1',
    motivo:'saida-solicitada',origem:'clique-nao-tenho-interesse-netlify',
  });
  assert.equal(repeat.bloqueado,true);
  assert.equal(repeat.duplicada,false,'nova recusa depois de reativação precisa ser respeitada');
  assert.equal(denuncias.resumo().bloqueados,1);
  assert.equal(denuncias.resumo().saidas,2);
  assert.equal(app.contatos.listar().find(c=>c.id===target.id).status,'descadastrado');
  const repeatAgain=denuncias.registrar({
    telefone:target.telefone,mensagemId:'click-inicial-teste-empresa-1',
    motivo:'saida-solicitada',origem:'clique-nao-tenho-interesse-netlify',
  });
  assert.equal(repeatAgain.duplicada,true);
  assert.equal(denuncias.resumo().saidas,2);
});

test('Chrome desktop/celular mostra botão e formulário; nova autorização é obrigatória',async t=>{
  const {app,target}=await fixture(t);
  const browser=await chromium.launch({headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(app.base+'/contatos?filtro=bloqueado');
  await page.waitForFunction(()=>document.querySelector('#ctBlocked')?.textContent==='1');
  await page.getByRole('button',{name:'Ver ficha'}).click();
  assert.equal(await page.locator('#unlockContact').isVisible(),true);
  assert.equal(await page.locator('#blockContact').isHidden(),true);
  await page.locator('#unlockContact').click();
  assert.equal(await page.locator('#unlockForm').isVisible(),true);
  await page.locator('#unlockOrigin').fill(valid.origemAutorizacao);
  await page.locator('#unlockReference').fill(valid.referenciaAutorizacao);
  await page.locator('#unlockDate').fill(valid.dataAutorizacao);
  assert.equal(await page.locator('#unlockConsent').isChecked(),false);
  assert.equal(await page.locator('#unlockForm').evaluate(e=>e.checkValidity()),false);
  await page.locator('#unlockConsent').check();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#confirmUnlock').click();
  await page.waitForFunction(()=>document.querySelector('#ctBlocked')?.textContent==='0');
  assert.equal(await page.locator('#contactDialog').isVisible(),false);
  const phone=await page.evaluate(()=>({client:document.documentElement.clientWidth,
    scroll:document.documentElement.scrollWidth}));
  assert.ok(phone.scroll<=phone.client+2,JSON.stringify(phone));
  const ficha=await api(app.base,'/api/local/gestao/contato?id='+target.id);
  assert.equal(ficha.contato.status,'autorizado');
  assert.equal(ficha.contato.eventos[0].motivo,'reativacao-autorizada');
  assert.deepEqual(errors,[]);
});

test('tentativa incerta antiga não volta à fila após desbloqueio',async t=>{
  const {app,target,denuncias,filaId}=await fixture(t,{
    withQueues:true,withIncerto:true,
  });
  const orig=(await api(app.base,'/api/local/campanhas/convite/fila?id='+filaId)).fila;
  assert.equal(orig.itens.find(x=>x.contatoId===target.id).status,'incerto');
  const unlock=await post(app.base,'/api/local/gestao/contato/desbloquear',{
    id:target.id,...valid,
  });
  const data=await unlock.json();
  assert.equal(unlock.status,200,JSON.stringify(data));
  assert.equal(data.resultado.filasAnterioresEncerradas,1);
  assert.equal(denuncias.estaBloqueado(target.telefone),false);
  const conciliar=await post(app.base,'/api/local/campanhas/convite/whatsapp/conciliar',{
    campanhaId:filaId,contatoId:target.id,resultado:'nao-enviado',confirmado:true,
  });
  assert.equal(conciliar.status,200,await conciliar.text());
  const final=(await api(app.base,'/api/local/campanhas/convite/fila?id='+filaId)).fila;
  assert.equal(final.itens.find(x=>x.contatoId===target.id).status,'ignorado');
});

test('falha na conferência de pendências Netlify preserva bloqueio e não reativa',async t=>{
  const {app,denuncias,target}=await fixture(t);
  let touchingQueues=0;
  const svc=iniciarGestaoContatos({
    contatos:app.contatos,denuncias,
    convitesUnicos:{encerrarPendenciasContato:()=>{touchingQueues++;return {encerrados:1};}},
    campanhas:{encerrarPendenciasContato:()=>{touchingQueues++;return {encerrados:1};}},
    sincronizacaoNetlify:{
      estado:()=>({configurada:true}),
      sincronizar:async()=>({ok:false,mensagem:'Falha de rede simulada'}),
    },
  });
  await assert.rejects(
    ()=>svc.desbloquear({id:target.id,...valid}),
    /Netlify/i,
  );
  assert.equal(touchingQueues,0);
  assert.equal(denuncias.resumo().bloqueados,1);
  assert.equal(app.contatos.listar().find(c=>c.id===target.id).status,'descadastrado');
});
