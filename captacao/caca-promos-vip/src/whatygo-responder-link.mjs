import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { instanciaAutorizada } from '../laboratorio-whatygo/ponte-identidade.mjs';

const laboratorio = join(dirname(fileURLToPath(import.meta.url)), '..', 'laboratorio-whatygo');
const instancia = 'cpv-lab-remetente-4306';
const base = 'http://127.0.0.1:4000';
const readPrivate = (relative) => readFileSync(join(laboratorio, relative), 'utf8').trim();

/** Only sanitized stage/codes can be persisted. Never raw response bodies. */
export class FalhaLinkWhatyGo extends Error {
  constructor(codigo, etapa, statusHttp = null) {
    super(codigo);
    this.name = 'FalhaLinkWhatyGo';
    this.codigo = codigo;
    this.etapa = etapa;
    this.statusHttp = Number.isInteger(statusHttp) && statusHttp >= 100 &&
      statusHttp <= 599 ? statusHttp : null;
  }
}

export function diagnosticoSeguroEnvio(error) {
  const known = error instanceof FalhaLinkWhatyGo ? error : null;
  const etapa = known?.etapa === 'preenvio' ? 'preenvio' : 'apos-solicitacao';
  const codigo = known?.codigo || 'desconhecido';
  const categoria = ({
    'credenciais-ausentes': 'credenciais locais ausentes',
    'numero-invalido': 'numero de destino invalido',
    'grupo-invalido': 'link de grupo invalido',
    'sessao-http': 'consulta da sessao rejeitada',
    'sessao-dados-invalidos': 'resposta de sessao invalida',
    'sessao-nao-verificada': 'identidade ou conexao do remetente nao confirmada',
    'sessao-transporte': 'falha ao consultar a sessao',
    'sessao-timeout': 'tempo limite na consulta da sessao',
    'envio-http': 'API de texto rejeitou a solicitacao',
    'envio-resposta-invalida': 'API nao confirmou um ID valido',
    'envio-transporte': 'conexao interrompida durante a solicitacao',
    'envio-timeout': 'tempo limite da solicitacao de envio',
  })[codigo] || 'falha nao classificada';
  const http = known?.statusHttp ? ' (HTTP ' + known.statusHttp + ')' : '';
  return {
    codigo,
    etapa,
    statusHttp: known?.statusHttp || null,
    texto: etapa === 'preenvio'
      ? 'Envio nao iniciado: ' + categoria + http + '. Nenhuma mensagem foi solicitada ao WhatyGo.'
      : 'Solicitacao ao WhatyGo sem confirmacao: ' + categoria + http + '. Verifique a conversa antes de qualquer envio manual. Sem repeticao automatica.',
  };
}

function carregarCredenciais() {
  const token = readPrivate('private/instancia-remetente-4306.token');
  const storedJid = readPrivate('private/remetente-autorizado-jid.txt');
  const line = readPrivate('.env.native').split(/\r?\n/)
    .find(x => x.startsWith('GLOBAL_API_KEY='));
  const adminKey = line?.slice('GLOBAL_API_KEY='.length).trim();
  return { token, storedJid, adminKey };
}

export function validarConviteGrupo(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname === 'chat.whatsapp.com' &&
      /^\/[A-Za-z0-9_-]{12,64}\/?$/.test(u.pathname) &&
      !u.username && !u.password && !u.search && !u.hash ? u.href : null;
  } catch {
    return null;
  }
}

export function mensagemConviteGrupo(url) {
  const valid = validarConviteGrupo(url);
  if (!valid) throw new FalhaLinkWhatyGo('grupo-invalido', 'preenvio');
  return [
    'Você escolheu entrar no grupo Caça Promos VIP 👑',
    '',
    'Toque no link abaixo e confirme sua entrada no WhatsApp:',
    valid,
    '',
    'Se o grupo exigir aprovação, aguarde a confirmação dos administradores.',
  ].join('\n');
}

/** One solicited text reply. A POST timeout is always uncertain: never retry. */
export async function enviarLinkSolicitado({
  telefone, urlGrupo, fetchImpl = fetch, credenciais = carregarCredenciais,
}) {
  if (typeof telefone !== 'string' || !/^55[1-9][0-9]{9,10}$/.test(telefone)) {
    throw new FalhaLinkWhatyGo('numero-invalido', 'preenvio');
  }
  const texto = mensagemConviteGrupo(urlGrupo);
  let token;
  let storedJid;
  let adminKey;
  try {
    ({ token, storedJid, adminKey } = credenciais());
  } catch {
    throw new FalhaLinkWhatyGo('credenciais-ausentes', 'preenvio');
  }
  if (!token || !adminKey || !storedJid) {
    throw new FalhaLinkWhatyGo('credenciais-ausentes', 'preenvio');
  }
  let postIniciado = false;
  const control = new AbortController();
  const timeout = setTimeout(() => control.abort(), 12_000);
  try {
    const response = await fetchImpl(base + '/instance/all', {
      headers: { apikey: adminKey },
      signal: control.signal,
    });
    if (!response?.ok) {
      throw new FalhaLinkWhatyGo('sessao-http', 'preenvio', response?.status);
    }
    let state;
    try { state = await response.json(); } catch {
      throw new FalhaLinkWhatyGo('sessao-dados-invalidos', 'preenvio');
    }
    if (!Array.isArray(state?.data)) {
      throw new FalhaLinkWhatyGo('sessao-dados-invalidos', 'preenvio');
    }
    const matches = state.data.filter(x => x?.name === instancia);
    if (!instanciaAutorizada(state.data, instancia, storedJid) ||
        matches.length !== 1 || matches[0].token !== token) {
      throw new FalhaLinkWhatyGo('sessao-nao-verificada', 'preenvio');
    }
    // Once a POST starts, an exception can mean the message WAS sent.
    postIniciado = true;
    const sent = await fetchImpl(base + '/send/text', {
      method: 'POST',
      headers: { apikey: token, 'content-type': 'application/json' },
      body: JSON.stringify({ number: telefone, text: texto }),
      signal: control.signal,
    });
    if (!sent?.ok) {
      throw new FalhaLinkWhatyGo('envio-http', 'apos-solicitacao', sent?.status);
    }
    let result;
    try { result = await sent.json(); } catch {
      throw new FalhaLinkWhatyGo('envio-resposta-invalida', 'apos-solicitacao');
    }
    const id = result?.data?.Info?.ID;
    if (result?.message !== 'success' || typeof id !== 'string' || id.length < 6) {
      throw new FalhaLinkWhatyGo('envio-resposta-invalida', 'apos-solicitacao');
    }
    return { aceitoPelaApi: true };
  } catch (error) {
    if (error instanceof FalhaLinkWhatyGo) throw error;
    const prefix = postIniciado ? 'envio' : 'sessao';
    const reason = error?.name === 'AbortError' ? 'timeout' : 'transporte';
    throw new FalhaLinkWhatyGo(prefix + '-' + reason,
      postIniciado ? 'apos-solicitacao' : 'preenvio');
  } finally {
    clearTimeout(timeout);
  }
}
