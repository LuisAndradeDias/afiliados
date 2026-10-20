import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {iniciarServidor} from '../src/server.mjs';

// O worker de teste abre um Chrome MOCKADO, sem WhatsApp real.
async function preparar(t) {
  const dir=mkdtempSync(join(tmpdir(),'cpv-worker-chrome-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const app=await iniciarServidor({
    dataDir:dir,port:0,metaAmbiente:{},whatsappWorkerTeste:true,
  });
  t.after(()=>new Promise(ok=>app.servidor.close(ok)));
  app.contatos.configurarRemetente('11999998888');
  const cadastro=app.contatos.cadastrar({
    nome:'Pessoa com autorização',telefone:'11988887777',origem:'teste',
    consentimento:true,
  });
  const contato=app.contatos.listar()[0];
  app.contatos.confirmar({
    id:contato.id,codigo:cadastro.codigo,evidencia:'mensagem-recebida',
  });
  const base=app.base;
  const post=(path,dados)=>fetch(base+path,{
    method:'POST',headers:{
      origin:base,'content-type':'application/json','x-cpv-local':'1',
    },body:JSON.stringify(dados),
  });
  const modelo=await post('/api/local/campanhas/convite/modelo',{
    mensagem:'Olá! Você autorizou receber convites do Caça Promos VIP. Gostaria de participar do grupo gratuito? Para recusar, responda SAIR.',
    grupoUrl:'https://chat.whatsapp.com/TesteConvite789',
    nomeModelo:'convite_ofertas_v1',
  });
  assert.equal(modelo.status,200);
  const criada=await post('/api/local/campanhas/convite/fila',{
    modo:'web',nome:'Teste automação supervisionada',
    contatoIds:[contato.id],
  });
  assert.equal(criada.status,200);
  const fila=(await criada.json()).fila;
  async function status(){
    return (await (await fetch(base+'/api/local/campanhas/convite/whatsapp/estado')).json()).estado;
  }
  async function aguardar(fase,timeout=35000){
    const inicial=Date.now();
    let ultimo;
    do{
      ultimo=await status();
      if(ultimo.fase===fase)return ultimo;
      if(['erro','incerto','cancelado'].includes(ultimo.fase) &&
         ultimo.fase!==fase) {
        throw new Error('Worker falhou antes de '+fase+': '+JSON.stringify(ultimo));
      }
      await new Promise(r=>setTimeout(r,350));
    }while(Date.now()-inicial<timeout);
    throw new Error('Timeout em '+fase+': '+JSON.stringify(ultimo));
  }
  return {app,post,status,aguardar,fila,contato};
}

test('Chrome simulado prepara destinatário, envia após clique e confirma pelo DOM',async t=>{
  const a=await preparar(t);
  assert.equal((await a.status()).fase,'inativo');
  const dados={campanhaId:a.fila.id,contatoId:a.contato.id};
  const prepared=await a.post('/api/local/campanhas/convite/whatsapp/preparar',dados);
  assert.equal(prepared.status,202,JSON.stringify(await prepared.clone().json()));
  await a.aguardar('pronto');
  const outro=await a.post('/api/local/campanhas/convite/whatsapp/preparar',dados);
  assert.equal(outro.status,409,'Não inicia outro Chrome simultaneamente');
  const naoConfirmado=await a.post('/api/local/campanhas/convite/whatsapp/enviar',dados);
  assert.equal(naoConfirmado.status,409);
  const confirmado=await a.post('/api/local/campanhas/convite/whatsapp/enviar',{
    ...dados,confirmar:true,
  });
  assert.equal(confirmado.status,202);
  await a.aguardar('confirmado');
  const detalhes=await (await fetch(a.app.base+
    '/api/local/campanhas/convite/fila?id='+a.fila.id)).json();
  assert.equal(detalhes.fila.manuais,1);
  assert.equal(detalhes.fila.pendentes,0);
  assert.equal((await a.status()).ocupado,false);
  const repetir=await a.post('/api/local/campanhas/convite/whatsapp/preparar',dados);
  assert.equal(repetir.status,409,'Ninguém deve receber um segundo convite confirmado');
  assert.equal((await fetch(a.app.base+'/api/admin/contatos')).status,401);
});

test('cancelar Chrome de teste antes do clique não registra envio',async t=>{
  const a=await preparar(t);
  const dados={campanhaId:a.fila.id,contatoId:a.contato.id};
  const resultado=await a.post('/api/local/campanhas/convite/whatsapp/preparar',dados);
  assert.equal(resultado.status,202,JSON.stringify(await resultado.clone().json()));
  const worker=await a.aguardar('pronto');
  assert.equal(worker.processoAtivo,true);
  const antes=await a.post('/api/local/campanhas/convite/filas/limpar',{confirmado:true});
  assert.equal(antes.status,409,'Limpeza bloqueada com Chrome ainda em preparação');
  assert.equal((await a.post('/api/local/campanhas/convite/whatsapp/cancelar',{
    ...dados,confirmarNaoEnviado:true,
  })).status,202);
  await a.aguardar('cancelado');
  const detalhes=await (await fetch(a.app.base+
    '/api/local/campanhas/convite/fila?id='+a.fila.id)).json();
  assert.equal(detalhes.fila.manuais,0);
  assert.equal(detalhes.fila.pendentes,1);
  const inicio=Date.now();
  while((await a.status()).processoAtivo && Date.now()-inicio<12000) {
    await new Promise(ok=>setTimeout(ok,100));
  }
  assert.equal((await a.status()).processoAtivo,false);
  const depois=await a.post('/api/local/campanhas/convite/filas/limpar',{confirmado:true});
  assert.equal(depois.status,200,'Somente depois do fechamento real');
  assert.equal((await (await fetch(a.app.base+
    '/api/local/campanhas/convite/filas')).json()).filas.length,0);
});
