import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {iniciarServidor} from '../src/server.mjs';
import {iniciarDenuncias} from '../src/denuncias.mjs';
import {contatoComConsentimento,EVIDENCIA_IMPORTADA} from '../src/contatos.mjs';

const contrato={
  origemAutorizacao:'Conversa individual no WhatsApp',
  referenciaAutorizacao:'Mensagem de aceite do titular arquivada pelo operador',
  dataAutorizacao:'2026-10-10',
  declaracao:true,
};
function pessoas(){
  return [
    {nome:'Pessoa Autorizada A',telefone:'11988887777'},
    {nome:'Pessoa Autorizada B',telefone:'21999997777'},
  ];
}
async function fixture(t){
  const dir=mkdtempSync(join(tmpdir(),'cpv-importacao-optin-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const app=await iniciarServidor({dataDir:dir,port:0,metaAmbiente:{}});
  t.after(()=>new Promise(done=>app.servidor.close(done)));
  const base=app.base;
  const post=(path,data,headers={})=>fetch(base+path,{
    method:'POST',
    headers:{origin:base,'x-cpv-local':'1',
      'content-type':'application/json',...headers},
    body:JSON.stringify(data),
  });
  const get=(path)=>fetch(base+path).then(x=>x.json());
  return {dir,app,base,post,get};
}

test('CSV de opt-ins prévios é registrado com proveniência e entra na fila sem QUERO VIP',async t=>{
  const {dir,app,post,get}=await fixture(t);
  assert.equal((await get('/api/local/campanhas/destinatarios')).destinatarios.length,0);
  const recebido=await post('/api/local/campanhas/importar-autorizados',{
    ...contrato,pessoas:pessoas(),
  });
  assert.equal(recebido.status,200);
  const body=await recebido.json();
  assert.deepEqual(body.resultado,{
    importados:2,atualizados:0,jaRegistrados:0,
    bloqueados:0,invalidos:0,duplicados:0,autorizadosNovos:2,
  });
  const naFila=(await get('/api/local/campanhas/destinatarios')).destinatarios;
  assert.equal(naFila.length,2);
  assert.deepEqual(naFila.map(x=>x.telefone).sort(),
    ['5511988887777','5521999997777']);
  const armazenados=JSON.parse(readFileSync(join(dir,'contatos-autorizados.json'),'utf8'));
  assert.equal(armazenados.contatos.length,2);
  assert.equal(armazenados.contatos[0].evidencia,EVIDENCIA_IMPORTADA);
  assert.equal(armazenados.contatos[0].registroAutorizacao.origem,
    contrato.origemAutorizacao);
  assert.equal(armazenados.contatos[0].registroAutorizacao.tipo,'declaracao-do-operador');
  assert.ok(contatoComConsentimento(armazenados.contatos[0]));
  assert.equal(armazenados.contatos[0].codigoConfirmacao,null,
    'A importação não simula código de confirmação recebido');
  assert.equal(armazenados.contatos[0].registroAutorizacao.dataAutorizacao,
    '2026-10-10');
  const fila=await post('/api/local/campanhas/convite/fila',{
    nome:'Grupo de ofertas',modo:'web',contatoIds:naFila.map(c=>c.id),
  });
  assert.equal(fila.status,200,JSON.stringify(await fila.clone().json()));
  assert.equal((await fila.json()).fila.pendentes,2);
  assert.equal(app.contatos.resumo().ativos,2);
});

test('reimportação mantém ids, bloqueios persistem mesmo sem cadastro prévio',async t=>{
  const {dir,app,post,get}=await fixture(t);
  const bloqueios=iniciarDenuncias(dir,app.contatos);
  bloqueios.registrar({
    telefone:'5521999997777',mensagemId:'prior-unsubscribe-001',
    motivo:'saida-solicitada',origem:'teste',
  });
  const lote=await post('/api/local/campanhas/importar-autorizados',{
    ...contrato,pessoas:pessoas(),
  });
  assert.equal(lote.status,200);
  const resultado=(await lote.json()).resultado;
  assert.equal(resultado.importados,1);
  assert.equal(resultado.bloqueados,1);
  const antes=(await get('/api/local/campanhas/destinatarios')).destinatarios;
  const copia=await post('/api/local/campanhas/importar-autorizados',{
    ...contrato,pessoas:pessoas(),
  });
  assert.equal(copia.status,200);
  const reimportado=(await copia.json()).resultado;
  assert.equal(reimportado.jaRegistrados,1);
  assert.equal(reimportado.bloqueados,1);
  const depois=(await get('/api/local/campanhas/destinatarios')).destinatarios;
  assert.deepEqual(depois,antes);
  app.contatos.descadastrarPorId(antes[0].id);
  const retorno=await post('/api/local/campanhas/importar-autorizados',{
    ...contrato,pessoas:pessoas(),
  });
  assert.equal((await retorno.json()).resultado.bloqueados,2);
  assert.equal((await get('/api/local/campanhas/destinatarios')).destinatarios.length,0);
});

test('exige declaração, origem, referencia, data real e protege chamada local',async t=>{
  const {base,post,get}=await fixture(t);
  const rota='/api/local/campanhas/importar-autorizados';
  const assertRejeita=async(mensagem,campo,valor)=>{
    const r=await post(rota,{...contrato,pessoas:pessoas(),[campo]:valor});
    assert.equal(r.status,409,mensagem);
    assert.equal((await r.json()).ok,false);
  };
  await assertRejeita('Não aceitar sem confirmação','declaracao',false);
  await assertRejeita('Não aceitar origem em branco','origemAutorizacao','');
  await assertRejeita('Não aceitar referencia vazia','referenciaAutorizacao','');
  await assertRejeita('Não aceitar data futura','dataAutorizacao','2099-01-01');
  await assertRejeita('Não aceitar data inválida','dataAutorizacao','2026-02-30');
  const cruzado=await post(rota,{...contrato,pessoas:pessoas()},
    {origin:'https://outra-pagina.example'});
  assert.equal(cruzado.status,403);
  const semProtecao=await fetch(base+rota,{
    method:'POST',headers:{origin:base,'content-type':'application/json'},
    body:JSON.stringify({...contrato,pessoas:pessoas()}),
  });
  assert.equal(semProtecao.status,403);
  assert.equal((await get('/api/local/campanhas/destinatarios')).destinatarios.length,0);
});

test('fila WhatsApp Web aceita centenas de destinatarios sem rejeitar o JSON',async t=>{
  const {app,post,get}=await fixture(t);
  // Regressao: 897 IDs UUID ultrapassam os 4096 bytes da rota antiga.
  const pessoasFicticias=Array.from({length:897},(_,indice)=>({
    nome:'Contato ficticio '+(indice+1),
    telefone:'119'+String(10000000+indice),
  }));
  for(let indice=0;indice<pessoasFicticias.length;indice+=75){
    app.contatos.importarConsentimentosExternos({
      ...contrato,pessoas:pessoasFicticias.slice(indice,indice+75),
    });
  }
  const destinatarios=(await get('/api/local/campanhas/destinatarios')).destinatarios;
  assert.equal(destinatarios.length,897);
  const payload={
    nome:'Convites autorizados',
    modo:'web',
    contatoIds:destinatarios.map(c=>c.id),
  };
  assert.ok(Buffer.byteLength(JSON.stringify(payload))>4096);
  const resposta=await post('/api/local/campanhas/convite/fila',payload);
  assert.equal(resposta.status,200,JSON.stringify(await resposta.clone().json()));
  const dados=await resposta.json();
  assert.equal(dados.fila.total,897);
  assert.equal(dados.fila.pendentes,897);
  assert.equal(dados.fila.manuais,0);
  assert.equal((await get('/api/local/campanhas/convite/filas')).filas.length,1);
});

test('cadastro pendente pode ser documentado sem falsificar QUERO VIP',async t=>{
  const {app,post,get}=await fixture(t);
  const previamente=app.contatos.cadastrar({
    nome:'Pessoa Teste',telefone:'11988887777',
    origem:'inscricao-voluntaria',consentimento:true,
  });
  assert.equal(previamente.registrado,true);
  assert.equal(app.contatos.resumo().pendentes,1);
  const r=await post('/api/local/campanhas/importar-autorizados',{
    ...contrato,pessoas:[pessoas()[0]],
  });
  assert.equal(r.status,200);
  assert.equal((await r.json()).resultado.atualizados,1);
  const dados=app.contatos.listar();
  assert.equal(dados[0].evidencia,EVIDENCIA_IMPORTADA);
  assert.equal(dados[0].status,'ativo');
  assert.equal((await get('/api/local/campanhas/destinatarios')).destinatarios.length,1);
});
