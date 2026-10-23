import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOTOES_CONVITE,configurarBotoesDeConvite,
  montarPayloadNativeFlow,testarBotoesNoProprioNumero,
  interpretarRespostaDeBotao,
} from '../src/botoes-interativos-experimentais.mjs';

const texto='Olá, este é um convite solicitado. Deseja participar do grupo de ofertas?';
const tel='5531999998888';

test('modelo experimental mostra 2 botoes sem link ou click-to-join enganoso',()=>{
  const m=configurarBotoesDeConvite({texto});
  assert.equal(m.botoes.length,2);
  assert.equal(m.botoes[0].rotulo,'Entrar no grupo');
  assert.equal(m.botoes[1].rotulo,'Não tenho interesse');
  assert.equal(m.status,'EXPERIMENTAL_NAO_OFICIAL');
  assert.equal(m.linkExterno,false);
  assert.throws(()=>configurarBotoesDeConvite({texto:texto+' https://chat.whatsapp.com/a'}),/links/i);
  assert.throws(()=>configurarBotoesDeConvite({texto:'curto'}),/20/);
  assert.ok(Object.isFrozen(BOTOES_CONVITE));
});

test('payload de dois quick replies exige transporte explicito',()=>{
  const p=montarPayloadNativeFlow({texto});
  assert.equal(p.interactiveButtons.length,2);
  assert.equal(p.interactiveButtons[0].name,'quick_reply');
  const a=p.interactiveButtons.map(x=>JSON.parse(x.buttonParamsJson));
  assert.deepEqual(a.map(x=>x.id),['CPV_ENTRAR','CPV_NAO_INTERESSE']);
  assert.deepEqual(a.map(x=>x.display_text),['Entrar no grupo','Não tenho interesse']);
  assert.doesNotMatch(JSON.stringify(p),/https:\/\/|https%3a/i);
});

test('nunca envia para numero diferente do proprio ou sem consentimentos',async()=>{
  let enviou=0;
  const transporte={sendMessage:async()=>{enviou++;return {key:{id:'fake-id'}};}};
  const base={transporte,numeroDestino:tel,numeroDoTitular:tel,texto};
  await assert.rejects(()=>testarBotoesNoProprioNumero({...base,
    titularConfirmou:true,aceitouRisco:true}),/Confirme titularidade/);
  await assert.rejects(()=>testarBotoesNoProprioNumero({...base,
    numeroDestino:'5521999997777',titularConfirmou:true,
    aceitouRisco:true,cliqueConfirmado:true}),/próprio número/);
  await assert.rejects(()=>testarBotoesNoProprioNumero({...base,
    titularConfirmou:true,aceitouRisco:true,cliqueConfirmado:true,
    transporte:null}),/transporte/);
  assert.equal(enviou,0);
});

test('envio mock aceita no maximo um pedido; aceite NAO e entrega',async()=>{
  const calls=[];
  const transporte={
    sendMessage:async(jid,payload)=>{
      calls.push([jid,payload]);
      return {key:{id:'mock-key-experimental'}};
    },
  };
  const result=await testarBotoesNoProprioNumero({
    transporte,numeroDestino:tel,numeroDoTitular:tel,
    titularConfirmou:true,aceitouRisco:true,cliqueConfirmado:true,texto,
  });
  assert.equal(calls.length,1);
  assert.equal(calls[0][0],tel+'@s.whatsapp.net');
  assert.equal(result.situacao,'TRANSPORTE_ACEITOU');
  assert.match(result.mensagem,/Confira no celular/);
  await assert.rejects(()=>testarBotoesNoProprioNumero({
    transporte,numeroDestino:tel,numeroDoTitular:tel,
    titularConfirmou:true,aceitouRisco:true,cliqueConfirmado:true,texto,
  }),/já teve um teste/,'Nunca permitir segunda chamada mesmo após aceite do transporte');
  assert.equal(calls.length,1);
});

test('sem ID de envio fica incerto e sem repeticao automatica',async()=>{
  const result=await testarBotoesNoProprioNumero({
    transporte:{sendMessage:async()=>({})},numeroDestino:'5531999996666',
    numeroDoTitular:'5531999996666',titularConfirmou:true,aceitouRisco:true,
    cliqueConfirmado:true,texto,
  });
  assert.equal(result.situacao,'INCERTO');
});

test('entrada e saida nao executam entrada em grupo ou descadastro sem confirmacao',()=>{
  assert.equal(interpretarRespostaDeBotao({
    message:{buttonsResponseMessage:{selectedButtonId:'CPV_ENTRAR'}},
  }).acao,'solicitar-entrada-supervisionada');
  assert.equal(interpretarRespostaDeBotao({
    message:{interactiveResponseMessage:{nativeFlowResponseMessage:{
      paramsJson:JSON.stringify({id:'CPV_NAO_INTERESSE'}),
    }}},
  }).acao,'bloquear-apos-confirmar-origem');
  assert.equal(interpretarRespostaDeBotao({message:{}}).tipo,'desconhecido');
  assert.equal(interpretarRespostaDeBotao({
    message:{interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:'{bad'}}},
  }).tipo,'desconhecido');
});
