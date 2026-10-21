// Preparador ISOLADO de dois botoes nativos (Native Flow) para um teste pessoal.
// Nao conecta ao WhatsApp, nao instala dependencias e nao envia mensagens sozinho.
// Algumas bibliotecas nao oficiais tentam transmitir Native Flow via WhatsApp Web;
// esse recurso e instavel e NAO possui garantia de entrega/renderizacao.
// Nenhum dispositivo, contato ou fila e alterado por este modulo.

const NUMERO=/^[1-9]\d{7,14}$/;
const URL=/(?:https?:\/\/|www\.|chat\.whatsapp\.com\/)/i;

export const BOTOES_CONVITE=Object.freeze([
  Object.freeze({id:'CPV_ENTRAR',rotulo:'Entrar no grupo'}),
  Object.freeze({id:'CPV_NAO_INTERESSE',rotulo:'Não tenho interesse'}),
]);

export function configurarBotoesDeConvite({
  texto='Olá! Você autorizou receber convites para as ofertas. Deseja participar?',
}={}){
  if(typeof texto!=='string'||texto.trim().length<20||
     texto.trim().length>1024||/[\u0000-\u001f]/.test(texto.replace(/\n/g,''))){
    throw new Error('O convite deve conter de 20 a 1.024 caracteres de texto.');
  }
  if(URL.test(texto)){
    throw new Error('Este teste usa apenas botoes de resposta, sem links externos no texto.');
  }
  return {
    texto:texto.trim(),
    botoes:BOTOES_CONVITE.map(item=>({id:item.id,rotulo:item.rotulo})),
    status:'EXPERIMENTAL_NAO_OFICIAL',
    aviso:'A previa nao prova que o destinatario vera os botoes no WhatsApp.',
    linkExterno:false,
  };
}

// Formato aceito por forks de Baileys. Criar a estrutura NAO transmite nada.
// O pacote oficial WhiskeySockets pode nao renderizar essa mensagem.
export function montarPayloadNativeFlow(opcoes={}){
  const modelo=configurarBotoesDeConvite(opcoes);
  return {
    text:modelo.texto,
    title:'Caça Promos VIP',
    footer:'Responda somente se desejar. SAIR também é aceito.',
    interactiveButtons:modelo.botoes.map(b=>({
      name:'quick_reply',
      buttonParamsJson:JSON.stringify({
        display_text:b.rotulo,id:b.id,
      }),
    })),
  };
}

// Teste exclusivamente no numero informado pelo proprio titular. A execucao
// real depende de um transporte CONECTADO EXPLICITAMENTE depois de aceitar
// os riscos de um cliente nao oficial. Sem fallback para texto/link oculto.
export async function testarBotoesNoProprioNumero({
  transporte,numeroDestino,numeroDoTitular,
  titularConfirmou=false,aceitouRisco=false,
  cliqueConfirmado=false,texto,
}={}){
  const normalizar=v=>String(v??'').replace(/\D/g,'');
  const destino=normalizar(numeroDestino);
  const titular=normalizar(numeroDoTitular);
  if(!NUMERO.test(destino)||destino!==titular){
    throw new Error('O modo experimental permite somente envio para o próprio número.');
  }
  if(titularConfirmou!==true||aceitouRisco!==true||cliqueConfirmado!==true){
    throw new Error('Confirme titularidade, risco da conexão não oficial e envio deste único teste.');
  }
  if(!transporte||typeof transporte.sendMessage!=='function'){
    throw new Error('Nenhum transporte de WhatsApp experimental foi conectado.');
  }
  const payload=montarPayloadNativeFlow({texto});
  const jid=destino+'@s.whatsapp.net';
  const resultado=await transporte.sendMessage(jid,payload);
  if(!resultado?.key?.id){
    return {situacao:'INCERTO',mensagem:'A biblioteca não forneceu ID do envio. Não repita.'};
  }
  // Aceite do transporte NAO comprova renderizacao nem leitura dos botoes.
  return {situacao:'TRANSPORTE_ACEITOU',mensagem:'Confira no celular se os botões apareceram. Não repita.',id:resultado.key.id};
}

export function interpretarRespostaDeBotao(msg={}){
  const payload=msg?.message?.buttonsResponseMessage?.selectedButtonId ||
    msg?.message?.templateButtonReplyMessage?.selectedId ||
    msg?.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
  let valor=String(payload||'');
  if(valor.startsWith('{')){
    try{const json=JSON.parse(valor);valor=String(json.id||json.button_id||'');}
    catch{return {tipo:'desconhecido'};}
  }
  if(valor==='CPV_ENTRAR')return {tipo:'interesse',acao:'solicitar-entrada-supervisionada'};
  if(valor==='CPV_NAO_INTERESSE')return {tipo:'saida',acao:'bloquear-apos-confirmar-origem'};
  return {tipo:'desconhecido'};
}
