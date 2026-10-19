import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarContatos } from '../src/contatos.mjs';
import { iniciarCampanhas } from '../src/campanhas.mjs';

function ambiente(t) {
  const dir=mkdtempSync(join(tmpdir(),'cpv-campanhas-test-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const contatos=iniciarContatos(dir);
  const campanhas=iniciarCampanhas(dir,contatos);
  contatos.configurarRemetente('11999998888');
  function novo(nome,telefone,confirmado=true){
    const data=contatos.cadastrar({nome,telefone,origem:'lista-testes',consentimento:true});
    const contato=contatos.listar().find(c=>c.telefone.endsWith(telefone.replace(/\D/g,'')));
    if(confirmado){
      contatos.confirmar({id:contato.id,codigo:data.codigo,evidencia:'mensagem-recebida'});
    }
    return contato.id;
  }
  return {dir,contatos,campanhas,novo};
}

test('somente contatos com opt-in confirmado entram na campanha',t=>{
  const a=ambiente(t);
  const ativo=a.novo('Pessoa Fictícia A','11988887777');
  const pendente=a.novo('Pessoa Pendente','21999997777',false);
  assert.equal(a.campanhas.destinatarios().length,1);
  assert.equal(existsSync(join(a.dir,'campanhas-manuais.json')),false);
  assert.throws(()=>a.campanhas.criar({
    nome:'Ofertas teste',grupo:'Grupo exemplo',modelo:'Olá {nome}, confira {grupo}',
    contatoIds:[ativo,pendente],
  }),/consentimento/);
  assert.equal(existsSync(join(a.dir,'campanhas-manuais.json')),false);
  assert.throws(()=>a.campanhas.criar({
    nome:'Ofertas teste',grupo:'Grupo exemplo',modelo:'Olá {telefone}, oferta!',
    contatoIds:[ativo],
  }),/variáveis/);
});

test('personalização, link individual e registro são supervisionados e persistentes',t=>{
  const a=ambiente(t);
  const id=a.novo('Ana Fictícia','11988887777');
  const campanha=a.campanhas.criar({
    nome:'Promoções de teste',grupo:'Grupo de ofertas',
    modelo:'Olá {nome}, novidades do {grupo}!',contatoIds:[id],
  });
  assert.equal(campanha.total,1);
  assert.equal(a.campanhas.listar()[0].pendentes,1);
  const previa=a.campanhas.prepararMensagem({campanhaId:campanha.id,contatoId:id});
  assert.match(previa.mensagem,/Olá Ana/);
  assert.match(previa.mensagem,/Grupo de ofertas/);
  assert.match(previa.mensagem,/responda SAIR/);
  assert.ok(previa.url.startsWith('https://wa.me/5511988887777?text='));
  const raw=readFileSync(join(a.dir,'campanhas-manuais.json'),'utf8');
  assert.ok(!raw.includes('5511988887777'),'Nao duplicar telefones na base de campanhas');
  assert.equal(a.campanhas.obter(campanha.id).itens[0].status,'pendente');
  assert.throws(()=>a.campanhas.registrar({
    campanhaId:campanha.id,contatoId:id,enviado:false,
  }),/Confirme/);
  assert.equal(a.campanhas.obter(campanha.id).itens[0].status,'pendente');
  const enviado=a.campanhas.registrar({
    campanhaId:campanha.id,contatoId:id,enviado:true,
  });
  assert.ok(enviado.enviadoEm);
  assert.equal(a.campanhas.listar()[0].enviados,1);
  assert.ok(a.contatos.listar().find(c=>c.id===id).ultimoEnvioManualEm);
  a.contatos.descadastrarPorId(id);
  assert.equal(a.campanhas.listar()[0].enviados,1,'Histórico de envio não desaparece após descadastro');
  assert.throws(()=>a.campanhas.prepararMensagem({
    campanhaId:campanha.id,contatoId:id,
  }),/sem autorização|já foi tratado/);
  const recarregado=iniciarCampanhas(a.dir,a.contatos);
  assert.equal(recarregado.obter(campanha.id).enviados,1);
});

test('descadastro bloqueia preparar e registrar até em campanha salva',t=>{
  const a=ambiente(t);
  const id=a.novo('Pessoa Exemplo','21999997777');
  const campanha=a.campanhas.criar({
    nome:'Teste descadastro',grupo:'Clube exemplo',
    modelo:'Oi {nome}, aviso do {grupo}',contatoIds:[id],
  });
  a.contatos.descadastrarPorId(id);
  const atual=a.campanhas.obter(campanha.id);
  assert.equal(atual.bloqueados,1);
  assert.equal(atual.itens[0].telefone,null);
  assert.equal(atual.itens[0].status,'bloqueado');
  assert.throws(()=>a.campanhas.prepararMensagem({
    campanhaId:campanha.id,contatoId:id,
  }),/sem autorização/);
  assert.throws(()=>a.campanhas.registrar({
    campanhaId:campanha.id,contatoId:id,enviado:true,
  }),/sem autorização/);
});

test('não permite reenvio, ignora sem envio e rejeita destinatários falsos',t=>{
  const a=ambiente(t);
  const id=a.novo('Pessoa Teste','11988887777');
  const campanha=a.campanhas.criar({
    nome:'Fictícia modelo',grupo:'Exemplo',
    modelo:'Olá, novidades para {nome}',contatoIds:[id],
  });
  assert.throws(()=>a.campanhas.criar({
    nome:'Outra',modelo:'Mensagem válida',contatoIds:['xxxxxxxx'],
  }),/duplicados ou inválidos/);
  assert.throws(()=>a.campanhas.criar({
    nome:'Outra',modelo:'Mensagem válida',contatoIds:[id,id],
  }),/duplicados ou inválidos/);
  a.campanhas.ignorar({campanhaId:campanha.id,contatoId:id});
  assert.equal(a.campanhas.listar()[0].ignorados,1);
  assert.throws(()=>a.campanhas.registrar({
    campanhaId:campanha.id,contatoId:id,enviado:true,
  }),/já foi tratado/);
});
