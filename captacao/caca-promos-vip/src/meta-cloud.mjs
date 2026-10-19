import { createHmac, timingSafeEqual } from 'node:crypto';

const ID = /^[0-9]{6,30}$/;
const VERSAO_API = /^v\d{1,2}\.\d$/;
const MODELO = /^[a-z][a-z0-9_]{2,127}$/;

function compararSegredos(a,b) {
  const primeiro = Buffer.from(String(a ?? ''),'utf8');
  const segundo = Buffer.from(String(b ?? ''),'utf8');
  return primeiro.length > 0 && primeiro.length === segundo.length &&
    timingSafeEqual(primeiro, segundo);
}

export function obterConfigMeta(ambiente = process.env) {
  const versao = String(ambiente.WA_META_GRAPH_VERSION || '');
  const telefoneId = String(ambiente.WA_META_PHONE_NUMBER_ID || '');
  const wabaId = String(ambiente.WA_META_WABA_ID || '');
  const appSecret = String(ambiente.WA_META_APP_SECRET || '');
  const webhookToken = String(ambiente.WA_META_WEBHOOK_VERIFY_TOKEN || '');
  const tokenApi = String(ambiente.WA_META_ACCESS_TOKEN || '');
  const template = String(ambiente.WA_META_TEMPLATE_NAME || 'convite_ofertas_v1');
  return {
    versao, telefoneId, wabaId, appSecret, webhookToken, tokenApi, template,
    configuracaoValida:VERSAO_API.test(versao) && ID.test(telefoneId) &&
      ID.test(wabaId) && appSecret.length>=16 &&
      webhookToken.length>=24 && tokenApi.length>=30 && MODELO.test(template),
  };
}

export function resumoMeta(config) {
  return {
    modo:'configuracao',
    configuracaoPreenchida:Boolean(config.configuracaoValida),
    contaConectada:false, // Sem chamada autenticada de validacao a Meta.
    telefoneConfigurado:ID.test(config.telefoneId),
    wabaConfigurado:ID.test(config.wabaId),
    tokenConfigurado:Boolean(config.tokenApi && config.tokenApi.length >= 30),
    webhookConfigurado:Boolean(config.appSecret?.length >= 16 && config.webhookToken?.length>=24),
    modelo:MODELO.test(config.template) ? config.template : null,
    envioAtivo:false,
    instrucao:'Configure a conta Meta, o modelo aprovado e um webhook HTTPS antes de habilitar envios.',
  };
}

export function verificarDesafioMeta(params, tokenEsperado) {
  if (!tokenEsperado || tokenEsperado.length < 24) return null;
  if (params.get('hub.mode') !== 'subscribe') return null;
  if (!compararSegredos(params.get('hub.verify_token'), tokenEsperado)) return null;
  const desafio = params.get('hub.challenge');
  return typeof desafio === 'string' && /^\d{1,128}$/.test(desafio) ? desafio : null;
}

export function verificarAssinaturaMeta(bodyRaw, assinatura, appSecret) {
  if (!(bodyRaw instanceof Buffer) || !appSecret || appSecret.length < 16 ||
      typeof assinatura !== 'string' || !/^sha256=[0-9a-f]{64}$/i.test(assinatura)) {
    return false;
  }
  const esperado = createHmac('sha256', appSecret).update(bodyRaw).digest();
  const recebido = Buffer.from(assinatura.slice(7),'hex');
  return recebido.length === esperado.length && timingSafeEqual(esperado,recebido);
}

export function lerEventosMeta(payload, telefoneIdEsperado) {
  if (payload?.object !== 'whatsapp_business_account' || !ID.test(String(telefoneIdEsperado||''))) return [];
  const eventos=[];
  const entradas=Array.isArray(payload.entry) ? payload.entry.slice(0,30) : [];
  for (const entrada of entradas) {
    for (const alteracao of (Array.isArray(entrada.changes)?entrada.changes:[]).slice(0,30)) {
      if (alteracao?.field !== 'messages' ||
          String(alteracao.value?.metadata?.phone_number_id || '') !== telefoneIdEsperado) continue;
      for (const msg of (Array.isArray(alteracao.value.messages)?alteracao.value.messages:[]).slice(0,100)) {
        const from=String(msg.from || '');
        const id=String(msg.id || '');
        if (!/^[1-9]\d{7,14}$/.test(from) || id.length < 4 || id.length > 255) continue;
        const payloadBotao = msg.type === 'button'
          ? String(msg.button?.payload || '')
          : msg.type === 'interactive'
            ? String(msg.interactive?.button_reply?.id || '')
            : '';
        const texto = msg.type === 'text' ? String(msg.text?.body || '').trim() : '';
        let tipo = null;
        if (payloadBotao === 'CPV_DENUNCIAR' || payloadBotao.startsWith('CPV_DENUNCIAR:')) tipo='denuncia';
        else if (payloadBotao === 'CPV_ENTRAR' || payloadBotao.startsWith('CPV_ENTRAR:')) tipo='entrar';
        else if (/^SAIR[.!\s]*$/i.test(texto)) tipo='sair';
        if (tipo) eventos.push({ tipo, from, id });
      }
    }
  }
  return eventos;
}

function limitarTexto(valor, max = 60) {
  return String(valor || '').replace(/[\x00-\x1f<>]/g,' ').trim().slice(0,max);
}

// Dois botoes quick_reply, uma combinacao que permite receber as duas
// respostas por webhook. O link do grupo sera entregue em resposta ao clique
// em "Entrar no grupo", dentro da janela de atendimento.
export function montarConviteMeta({ para, nome, grupo, template = 'convite_ofertas_v1' }) {
  const telefone=String(para||'').replace(/\D/g,'');
  if (!/^[1-9]\d{7,14}$/.test(telefone) || !MODELO.test(template)) {
    throw new Error('Telefone ou modelo de convite inválido.');
  }
  return {
    messaging_product:'whatsapp',
    recipient_type:'individual',
    to:telefone,
    type:'template',
    template:{
      name:template,
      language:{code:'pt_BR'},
      components:[
        {type:'body',parameters:[
          {type:'text',text:limitarTexto(nome,60) || 'amigo'},
          {type:'text',text:limitarTexto(grupo,60) || 'nosso grupo'},
        ]},
        {type:'button',sub_type:'quick_reply',index:'0',
          parameters:[{type:'payload',payload:'CPV_ENTRAR'}]},
        {type:'button',sub_type:'quick_reply',index:'1',
          parameters:[{type:'payload',payload:'CPV_DENUNCIAR'}]},
      ],
    },
  };
}
