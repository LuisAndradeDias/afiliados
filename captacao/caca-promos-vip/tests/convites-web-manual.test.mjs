import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { iniciarContatos } from '../src/contatos.mjs';
import { iniciarDenuncias } from '../src/denuncias.mjs';
import { iniciarConvitesUnicos } from '../src/convites-unicos.mjs';
import { obterConfigMeta } from '../src/meta-cloud.mjs';
import { iniciarServidor } from '../src/server.mjs';

const grupo='https://chat.whatsapp.com/ConviteFicticio678';
function fixture(t) {
  const dir=mkdtempSync(join(tmpdir(),'cpv-web-manual-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const contatos=iniciarContatos(dir);
  contatos.configurarRemetente('11999998888');
  const bloqueios=iniciarDenuncias(dir,contatos);
  const cria=()=>iniciarConvitesUnicos({dataDir:dir,contatos,bloqueios,
    configMeta:obterConfigMeta({}),grupoInicial:grupo});
  const convites=cria();
  function novo(nome,numero,confirmado=true){
    const entrada=contatos.cadastrar({
      nome,telefone:numero,origem:'teste-supervisionado',consentimento:true,
    });
    const pessoa=contatos.listar().find(c=>c.telefone.endsWith(numero));
    if(confirmado)contatos.confirmar({
      id:pessoa.id,codigo:entrada.codigo,evidencia:'mensagem-recebida',
    });
    return pessoa;
  }
  return {dir,contatos,bloqueios,convites,cria,novo};
}

test('link oficial do WhatsApp Web pré-preenche texto e não envia mensagens',t=>{
  const a=fixture(t);
  const ana=a.novo('Ana Autorizada','11988887777');
  const bruno=a.novo('Bruno Autorizado','21999997777');
  const nao=a.novo('Sem Optin','31988887777',false);
  assert.throws(()=>a.convites.criarFila({
    nome:'Lista com pendentes',modo:'web',contatoIds:[ana.id,nao.id],
  }),/autorizacao/);
  const fila=a.convites.criarFila({
    nome:'Grupo de promoções',modo:'web',contatoIds:[ana.id,bruno.id],
  });
  assert.equal(fila.modo,'web');
  assert.equal(fila.pendentes,2);
  assert.equal(a.convites.estatisticasManual().automatico,false);
  assert.equal(a.convites.estatisticasManual().simultaneos,1);
  assert.equal(a.convites.estatisticasManual().limiteDiario,50);

  const preparado=a.convites.prepararManual({
    campanhaId:fila.id,contatoId:ana.id,
  });
  assert.match(preparado.url,/^https:\/\/wa\.me\/5511988887777\?text=/);
  const mensagem=new URL(preparado.url).searchParams.get('text');
  assert.equal(mensagem,preparado.mensagem);
  assert.match(mensagem,/chat\.whatsapp\.com/);
  assert.match(mensagem,/responda SAIR ou DENUNCIAR/);
  assert.doesNotMatch(mensagem,/toque em Denunciar convite/);
  assert.equal(a.convites.detalhesFila(fila.id).abertos,1);
  assert.throws(()=>a.convites.prepararManual({
    campanhaId:fila.id,contatoId:bruno.id,
  }),/Finalize ou ignore/);
  assert.throws(()=>a.convites.marcarManual({
    campanhaId:fila.id,contatoId:ana.id,acao:'enviado',
  }),/Confirme/);
  assert.equal(a.convites.detalhesFila(fila.id).abertos,1);
  const gravado=a.convites.marcarManual({
    campanhaId:fila.id,contatoId:ana.id,acao:'enviado',confirmado:true,
  });
  assert.equal(gravado.status,'enviado-manualmente');
  assert.equal(a.convites.detalhesFila(fila.id).manuais,1);
  assert.equal(a.convites.estatisticasManual().confirmadosHoje,1);
  assert.throws(()=>a.convites.prepararManual({
    campanhaId:fila.id,contatoId:ana.id,
  }),/já tem convite|já foi tratado/);
  assert.throws(()=>a.convites.criarFila({
    nome:'Outra campanha',modo:'web',contatoIds:[ana.id],
  }),/já possui convite manual confirmado/);
  const reabrir=a.cria();
  assert.equal(reabrir.detalhesFila(fila.id).manuais,1);
  const preparadoB=reabrir.prepararManual({
    campanhaId:fila.id,contatoId:bruno.id,
  });
  assert.match(preparadoB.url,/5521999997777/);
  reabrir.marcarManual({campanhaId:fila.id,contatoId:bruno.id,acao:'ignorado'});
  assert.equal(reabrir.detalhesFila(fila.id).ignorados,1);
  assert.equal(reabrir.detalhesFila(fila.id).pendentes,0);
  assert.equal(a.convites.estatisticasManual().iniciadosHoje,2);
  assert.equal(a.convites.detalhesFila(fila.id).itens[0].telefoneMascarado.includes('7777'),true);
});

test('denúncia informada pelo operador bloqueia novas filas e registro duplicado',t=>{
  const a=fixture(t);
  const contato=a.novo('Cliente Autorizado','11988887777');
  const fila=a.convites.criarFila({
    nome:'Convite sem API',modo:'web',contatoIds:[contato.id],
  });
  a.convites.prepararManual({campanhaId:fila.id,contatoId:contato.id});
  const r=a.convites.marcarManual({
    campanhaId:fila.id,contatoId:contato.id,acao:'denunciado',
  });
  assert.equal(r.status,'denunciado');
  assert.equal(a.bloqueios.estaBloqueado(contato.telefone),true);
  assert.equal(a.contatos.listar()[0].status,'descadastrado');
  assert.equal(a.convites.pessoasElegiveis().length,0);
  assert.throws(()=>a.convites.criarFila({
    nome:'Nova fila',modo:'web',contatoIds:[contato.id],
  }),/autorizacao/);
  assert.throws(()=>a.convites.prepararManual({
    campanhaId:fila.id,contatoId:contato.id,
  }),/bloqueado|sem opt-in/);
  assert.equal(a.bloqueios.resumo().denuncias,1);
});

test('reclamação recebida dias depois do envio registra bloqueio sem apagar histórico',t=>{
  const a=fixture(t);
  const c=a.novo('Pessoa Teste','11988887777');
  const fila=a.convites.criarFila({
    nome:'Convite já enviado',modo:'web',contatoIds:[c.id],
  });
  a.convites.prepararManual({campanhaId:fila.id,contatoId:c.id});
  a.convites.marcarManual({campanhaId:fila.id,contatoId:c.id,
    acao:'enviado',confirmado:true});
  assert.equal(a.convites.detalhesFila(fila.id).manuais,1);
  a.convites.marcarManual({campanhaId:fila.id,contatoId:c.id,
    acao:'denunciado'});
  const depois=a.convites.detalhesFila(fila.id);
  assert.equal(depois.bloqueados,1);
  assert.equal(depois.manuais,1,'Mantém registro do envio anterior à denúncia');
  assert.equal(a.bloqueios.resumo().denuncias,1);
  assert.equal(a.contatos.listar()[0].status,'descadastrado');
  assert.throws(()=>a.convites.marcarManual({campanhaId:fila.id,
    contatoId:c.id,acao:'denunciado'}),/sem opt-in|bloqueado/);
});

test('limite diário 50 preparações e bloqueio da automação Meta na fila web',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cpv-limite-manual-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const ids=Array.from({length:51},()=>randomUUID());
  const mapa=new Map(ids.map((id,i)=>[id,{
    id,nome:'Pessoa Fictícia '+i,telefone:'55'+String(11000000000+i),
    status:'ativo',consentimentoConfirmadoEm:new Date().toISOString(),
    evidencia:'checkbox-e-mensagem-iniciada-pelo-titular',descadastroEm:null,
  }]));
  const fake={listar:()=>[...mapa.values()]};
  const bloqueios={estaBloqueado:()=>false};
  const convites=iniciarConvitesUnicos({
    dataDir:dir,contatos:fake,bloqueios,configMeta:obterConfigMeta({}),
    grupoInicial:grupo,
  });
  const fila=convites.criarFila({
    nome:'Limite manual',modo:'web',contatoIds:ids,
  });
  for (const id of ids.slice(0,50)){
    convites.prepararManual({campanhaId:fila.id,contatoId:id});
    convites.marcarManual({campanhaId:fila.id,contatoId:id,
      acao:'enviado',confirmado:true});
  }
  assert.equal(convites.estatisticasManual().restantesHoje,0);
  assert.throws(()=>convites.prepararManual({
    campanhaId:fila.id,contatoId:ids[50],
  }),/50 conversas/);
  assert.equal(convites.detalhesFila(fila.id).pendentes,1);
  await assert.rejects(convites.processarLote({
    campanhaId:fila.id,limite:1,confirmar:true,
  }),/Envio real indisponivel/);
});

test('rotas HTTP locais só preparam link, sem chamar WhatsApp ou serviço pago',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cpv-web-http-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const app=await iniciarServidor({dataDir:dir,port:0,metaAmbiente:{}});
  t.after(()=>new Promise(ok=>app.servidor.close(ok)));
  app.contatos.configurarRemetente('11999998888');
  const c=app.contatos.cadastrar({
    nome:'Nome Fictício',telefone:'11988887777',origem:'teste',consentimento:true,
  });
  const usuario=app.contatos.listar()[0];
  app.contatos.confirmar({
    id:usuario.id,codigo:c.codigo,evidencia:'mensagem-recebida',
  });
  const base=app.base;
  const post=(path,body,headers={})=>fetch(base+path,{
    method:'POST',headers:{origin:base,'content-type':'application/json',
      'x-cpv-local':'1',...headers},body:JSON.stringify(body),
  });
  const modelo=await post('/api/local/campanhas/convite/modelo',{
    mensagem:'Olá! Você autorizou receber nossos convites. Gostaria de entrar em um grupo gratuito? Para recusar, responda SAIR.',
    grupoUrl:grupo,nomeModelo:'convite_ofertas_v1',
  });
  assert.equal(modelo.status,200);
  const criado=await (await post('/api/local/campanhas/convite/fila',{
    nome:'Contato supervisionado',modo:'web',contatoIds:[usuario.id],
  })).json();
  const id=criado.fila.id;
  assert.equal((await fetch(base+'/api/local/campanhas/convite/manual/estatisticas')).status,200);
  const bad=await post('/api/local/campanhas/convite/manual/preparar',{
    campanhaId:id,contatoId:usuario.id,
  },{origin:'https://outro.site'});
  assert.equal(bad.status,403);
  const r=await post('/api/local/campanhas/convite/manual/preparar',{
    campanhaId:id,contatoId:usuario.id,
  });
  assert.equal(r.status,200);
  const preparado=(await r.json()).conversa;
  assert.match(preparado.url,/wa\.me\/5511988887777/);
  assert.match(preparado.mensagem,/SAIR ou DENUNCIAR/);
  const marcado=await post('/api/local/campanhas/convite/manual/registrar',{
    campanhaId:id,contatoId:usuario.id,acao:'enviado',confirmado:true,
  });
  assert.equal(marcado.status,200);
  const detalhe=await (await fetch(base+'/api/local/campanhas/convite/fila?id='+id)).json();
  assert.equal(detalhe.fila.manuais,1);
  assert.equal((await fetch(base+'/api/admin/contatos')).status,401);
});
