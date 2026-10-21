import { createHmac, timingSafeEqual } from 'node:crypto';

const ID = /^[0-9]{6,30}$/;
const VERSAO_API = /^v\d{1,2}\.\d$/;
const MODELO = /^[a-z][a-z0-9_]{2,127}$/;
const TELEFONE = /^[1-9]\d{7,14}$/;
const LOCALE = 'pt_BR';
export const BOTAO_ENTRAR = 'Entrar no grupo';
export const BOTAO_NAO_INTERESSE = 'Não tenho interesse';

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
  const habilitado = ambiente.WA_META_ENABLE_SENDING === 'true';
  const limiteDiario=Number(ambiente.WA_META_MAX_DAILY || 50);
  const maximoDiario=Number.isInteger(limiteDiario) && limiteDiario>=1 &&
    limiteDiario<=500 ? limiteDiario : 50;
  return {
    versao, telefoneId, wabaId, appSecret, webhookToken, tokenApi, template,
    habilitado, maximoDiario,
    configuracaoValida:VERSAO_API.test(versao) && ID.test(telefoneId) &&
      ID.test(wabaId) && appSecret.length >= 16 &&
      webhookToken.length >= 24 && tokenApi.length >= 30 && MODELO.test(template),
  };
}

export function resumoMeta(config) {
  return {
    modo:'configuracao',
    configuracaoPreenchida:Boolean(config.configuracaoValida),
    contaConectada:false, // So uma verificacao autenticada da Meta pode confirmar.
    telefoneConfigurado:ID.test(config.telefoneId),
    wabaConfigurado:ID.test(config.wabaId),
    tokenConfigurado:Boolean(config.tokenApi && config.tokenApi.length >= 30),
    webhookConfigurado:Boolean(config.appSecret?.length >= 16 &&
      config.webhookToken?.length >= 24),
    modelo:MODELO.test(config.template) ? config.template : null,
    envioAtivo:Boolean(config.configuracaoValida && config.habilitado),
    instrucao:config.configuracaoValida
      ? 'Ainda e necessario verificar modelo aprovado e opt-in a cada lote.'
      : 'Crie o numero na Meta e configure os segredos privados para liberar os testes.',
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
  if (payload?.object !== 'whatsapp_business_account' ||
      !ID.test(String(telefoneIdEsperado||''))) return [];
  const eventos=[];
  const entradas=Array.isArray(payload.entry) ? payload.entry.slice(0,30) : [];
  for (const entrada of entradas) {
    for (const alteracao of (Array.isArray(entrada.changes)?entrada.changes:[]).slice(0,30)) {
      if (alteracao?.field !== 'messages' ||
          String(alteracao.value?.metadata?.phone_number_id || '') !== telefoneIdEsperado) continue;
      for (const msg of (Array.isArray(alteracao.value.messages)?alteracao.value.messages:[]).slice(0,100)) {
        const from=String(msg.from || '');
        const id=String(msg.id || '');
        if (!TELEFONE.test(from) || id.length < 4 || id.length > 255) continue;
        const payloadBotao = msg.type === 'button'
          ? String(msg.button?.payload || '')
          : msg.type === 'interactive'
            ? String(msg.interactive?.button_reply?.id || '')
            : '';
        const texto = msg.type === 'text' ? String(msg.text?.body || '').trim() : '';
        let tipo = null;
        if (payloadBotao === 'CPV_DENUNCIAR' ||
            payloadBotao.startsWith('CPV_DENUNCIAR:')) tipo='denuncia'; // Legado
        else if (payloadBotao === 'CPV_NAO_INTERESSE' ||
            payloadBotao.startsWith('CPV_NAO_INTERESSE:')) tipo='sair';
        else if (payloadBotao === 'CPV_ENTRAR' ||
            payloadBotao.startsWith('CPV_ENTRAR:')) tipo='entrar';
        else if (/^(SAIR|NÃO TENHO INTERESSE|NAO TENHO INTERESSE)[.!\s]*$/i.test(texto)) tipo='sair';
        if (tipo) eventos.push({ tipo, from, id });
      }
    }
  }
  return eventos;
}

export function lerStatusMeta(payload, telefoneIdEsperado) {
  if (payload?.object !== 'whatsapp_business_account' ||
      !ID.test(String(telefoneIdEsperado||''))) return [];
  const eventos=[];
  for (const entry of (Array.isArray(payload.entry) ? payload.entry : []).slice(0,30)) {
    for (const change of (Array.isArray(entry.changes) ? entry.changes : []).slice(0,30)) {
      if (change.field !== 'messages' ||
          String(change.value?.metadata?.phone_number_id||'') !== telefoneIdEsperado) continue;
      for (const status of (Array.isArray(change.value?.statuses) ? change.value.statuses : []).slice(0,100)) {
        if (typeof status.id === 'string' && status.id.length >= 4 && status.id.length < 256 &&
            ['sent','delivered','read','failed'].includes(status.status)) {
          eventos.push({ mensagemId:status.id, status:status.status });
        }
      }
    }
  }
  return eventos;
}

export function validarTextoModelo(texto) {
  if (typeof texto !== 'string') throw new Error('Mensagem obrigatoria.');
  const mensagem = texto.replace(/\r\n/g,'\n').trim();
  if (mensagem.length < 40 || mensagem.length > 1024 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(mensagem)) {
    throw new Error('Mensagem deve ter entre 40 e 1.024 caracteres.');
  }
  if (/\{\{|\}\}|\{nome\}|\{grupo\}/i.test(mensagem)) {
    throw new Error('Use uma mensagem identica para todos, sem variaveis.');
  }
  return mensagem;
}

export function montarModeloMeta({texto,nomeModelo='convite_ofertas_v1'}) {
  const mensagem=validarTextoModelo(texto);
  if (!MODELO.test(nomeModelo)) throw new Error('Nome do modelo invalido.');
  return {
    name:nomeModelo,language:LOCALE,category:'MARKETING',
    components:[
      {type:'BODY',text:mensagem},
      {type:'BUTTONS',buttons:[
        {type:'QUICK_REPLY',text:BOTAO_ENTRAR},
        {type:'QUICK_REPLY',text:BOTAO_NAO_INTERESSE},
      ]},
    ],
  };
}

export function montarConviteMeta({para,template='convite_ofertas_v1'}) {
  const telefone=String(para||'').replace(/\D/g,'');
  if (!TELEFONE.test(telefone) || !MODELO.test(template)) {
    throw new Error('Telefone ou modelo de convite inválido.');
  }
  // Modelo estatico sem componentes BODY: Meta envia rigorosamente a mesma
  // mensagem aprovada a todos os contatos.
  return {
    messaging_product:'whatsapp',recipient_type:'individual',
    to:telefone,type:'template',
    template:{name:template,language:{code:LOCALE},components:[
      {type:'button',sub_type:'quick_reply',index:'0',
        parameters:[{type:'payload',payload:'CPV_ENTRAR'}]},
      {type:'button',sub_type:'quick_reply',index:'1',
        parameters:[{type:'payload',payload:'CPV_NAO_INTERESSE'}]},
    ]},
  };
}

function caminhoApi(config, endpoint) {
  if (!config?.configuracaoValida || !VERSAO_API.test(config.versao)) {
    throw new Error('Cloud API nao configurada.');
  }
  return 'https://graph.facebook.com/'+config.versao+'/'+endpoint;
}

async function apiMeta(url,options,fetchImpl=fetch) {
  const retorno=await fetchImpl(url,{
    ...options,signal:AbortSignal.timeout(15000),
  });
  let dados={};
  try { dados=await retorno.json(); } catch { /* meta pode retornar erros em texto */ }
  if (!retorno.ok) {
    const codigo = Number.isInteger(dados?.error?.code) ? dados.error.code : retorno.status;
    throw new Error('Meta Graph API recusou a operacao (codigo '+codigo+').');
  }
  return dados;
}

export async function consultarModeloMeta(config,{nomeModelo,texto},fetchImpl=fetch) {
  montarModeloMeta({nomeModelo,texto});
  const url=new URL(caminhoApi(config,config.wabaId+'/message_templates'));
  url.searchParams.set('name',nomeModelo);
  url.searchParams.set('fields','name,status,language,category,components');
  url.searchParams.set('limit','20');
  const resposta=await apiMeta(url.toString(),{
    method:'GET',headers:{authorization:'Bearer '+config.tokenApi},
  },fetchImpl);
  const modelo=(Array.isArray(resposta.data)?resposta.data:[]).find(t =>
    t.name===nomeModelo && t.language===LOCALE);
  const body=(modelo?.components||[]).find(c=>c.type==='BODY')?.text;
  const btn=(modelo?.components||[]).find(c=>c.type==='BUTTONS')?.buttons||[];
  const corresponde = Boolean(modelo && body === validarTextoModelo(texto) &&
    btn.length===2 && btn.every((b,i)=>b.type==='QUICK_REPLY' &&
      b.text===[BOTAO_ENTRAR,BOTAO_NAO_INTERESSE][i]));
  return {
    encontrado:Boolean(modelo),status:modelo?.status||'NAO_CRIADO',
    textoIdentico:corresponde,
    aprovado: modelo?.status==='APPROVED' && corresponde,
    nomeModelo, idioma:LOCALE,
  };
}

export async function enviarConviteMeta(config,{para,template},fetchImpl=fetch) {
  if (!config.habilitado || !config.configuracaoValida) {
    throw new Error('Envios reais desligados ate configurar a Meta e habilitar explicitamente.');
  }
  const body=montarConviteMeta({para,template});
  const resposta=await apiMeta(caminhoApi(config,config.telefoneId+'/messages'),{
    method:'POST',headers:{
      authorization:'Bearer '+config.tokenApi,'content-type':'application/json',
    },body:JSON.stringify(body),
  },fetchImpl);
  const messageId=resposta?.messages?.[0]?.id;
  if (typeof messageId !== 'string' || messageId.length<4) {
    throw new Error('Meta nao confirmou o identificador da mensagem; envio incerto.');
  }
  return {mensagemId:messageId};
}

export async function responderLinkMeta(config,{para,urlGrupo},fetchImpl=fetch) {
  if (!config.habilitado || !config.configuracaoValida) {
    throw new Error('Respostas reais desligadas ate configurar a Meta.');
  }
  const destino=String(para||'').replace(/\D/g,'');
  const convite=new URL(String(urlGrupo||''));
  if (!TELEFONE.test(destino) || convite.protocol!=='https:' ||
      convite.hostname!=='chat.whatsapp.com' || !/^\/[A-Za-z0-9]+$/.test(convite.pathname) ||
      convite.search || convite.hash) {
    throw new Error('Numero ou link do grupo invalido.');
  }
  const data={
    messaging_product:'whatsapp',recipient_type:'individual',to:destino,
    type:'text',text:{preview_url:false,body:
      'Obrigado pelo interesse! 👑 Para entrar no grupo de ofertas, use este link: '+convite.toString()},
  };
  const resposta=await apiMeta(caminhoApi(config,config.telefoneId+'/messages'),{
    method:'POST',headers:{authorization:'Bearer '+config.tokenApi,
      'content-type':'application/json'},body:JSON.stringify(data),
  },fetchImpl);
  const id=resposta?.messages?.[0]?.id;
  if (typeof id!=='string' || id.length<4) throw new Error('Resposta ao convite sem confirmacao.');
  return {mensagemId:id};
}
