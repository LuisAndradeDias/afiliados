import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarServidor } from '../src/server.mjs';

test('abrir WhatsApp Web sem contatos: QR, sessão conectada, fechar e reabrir',async t=>{
  const dataDir=mkdtempSync(join(tmpdir(),'cpv-conexao-wa-'));
  t.after(()=>rmSync(dataDir,{recursive:true,force:true}));
  const app=await iniciarServidor({
    dataDir,port:0,metaAmbiente:{},whatsappWorkerTeste:true,
  });
  const base=app.base;
  const post=(caminho,dados={},headers={})=>fetch(base+caminho,{
    method:'POST',
    headers:{origin:base,'content-type':'application/json','x-cpv-local':'1',
      ...headers},
    body:JSON.stringify(dados),
  });
  const estado=async()=>(await (await fetch(base+
    '/api/local/campanhas/convite/whatsapp/conexao/estado')).json()).estado;
  async function esperar(fases,timeout=25000){
    const inicio=Date.now();
    let ultimo;
    do{
      ultimo=await estado();
      if(fases.includes(ultimo.fase))return ultimo;
      if(ultimo.fase==='erro')throw new Error('Falha no worker de conexão: '+
        ultimo.mensagem);
      await new Promise(r=>setTimeout(r,100));
    }while(Date.now()-inicio<timeout);
    throw new Error('Tempo excedido: '+JSON.stringify(ultimo));
  }
  t.after(async()=>{
    const s=await estado().catch(()=>null);
    if(s?.ocupado){
      await post('/api/local/campanhas/convite/whatsapp/conexao/fechar')
        .catch(()=>null);
      await esperar(['fechado']).catch(()=>null);
    }
    await new Promise(done=>app.servidor.close(done));
  });

  assert.equal((await estado()).fase,'inativo');
  assert.equal((await estado()).envioHabilitado,false);
  const endpoint='/api/local/campanhas/convite/whatsapp/conexao/abrir';
  assert.equal((await fetch(base+endpoint)).status,405);
  assert.equal((await post(endpoint,{},{
    origin:'https://outro-dominio.example',
  })).status,403,'Protege o navegador de origem estranha');
  const abrir=await post(endpoint);
  assert.equal(abrir.status,202,JSON.stringify(await abrir.clone().json()));
  const duplicado=await post(endpoint);
  assert.equal(duplicado.status,409,'Não abre duas sessões para o mesmo painel');
  const qr=await esperar(['qr','conectado']);
  assert.equal(qr.ocupado,true);
  const conectado=await esperar(['conectado']);
  assert.equal(conectado.ocupado,true);
  assert.equal(conectado.envioHabilitado,false);
  const preparar=await post('/api/local/campanhas/convite/whatsapp/preparar',{
    campanhaId:'00000000-0000-4000-8000-000000000000',
    contatoId:'00000000-0000-4000-8000-000000000001',
  });
  assert.equal(preparar.status,409,'Conectar não é disparar mensagens');

  const encerrado=await post('/api/local/campanhas/convite/whatsapp/conexao/fechar');
  assert.equal(encerrado.status,202);
  const fechado=await esperar(['fechado']);
  assert.equal(fechado.ocupado,false);
  assert.equal(fechado.envioHabilitado,false);
  const novo=await post(endpoint);
  assert.equal(novo.status,202,'Pode reconectar depois de fechar');
  await esperar(['qr','conectado']);
  assert.equal((await post('/api/local/campanhas/convite/whatsapp/conexao/fechar')).status,202);
  await esperar(['fechado']);
  assert.equal((await fetch(base+'/api/admin/contatos')).status,401);
});
