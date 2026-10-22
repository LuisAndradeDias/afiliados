import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { contatoComConsentimento, telefoneBrasil } from './contatos.mjs';

const CHOICES = new Map([
  ['aceitar_grupo', 'aceitar'],
  ['recusar_grupo', 'recusar'],
  ['CPV_ENTRAR', 'aceitar'],
  ['CPV_NAO_INTERESSE', 'recusar'],
]);
const MAX_ENTRIES = 5000;
const MAX_EVENT_AGE = 48 * 3600 * 1000;
const EXPECTED_INSTANCE = 'cpv-lab-remetente-4306';

function privateKey(path) {
  try {
    const s = readFileSync(path, 'utf8').trim();
    if (!/^[0-9a-f]{64}$/.test(s)) throw new Error('Chave local inválida.');
    return s;
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    const key = randomBytes(32).toString('hex');
    writeFileSync(path, key + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    return key;
  }
}

function hmac(secret, value) {
  return createHmac('sha256', Buffer.from(secret, 'hex')).update(String(value)).digest('hex');
}
function keyMatches(provided, expected) {
  if (typeof provided !== 'string' || !/^[0-9a-f]{64}$/.test(provided)) return false;
  return timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
}
function jidNumber(jid) {
  if (typeof jid !== 'string') return null;
  const m = /^([1-9][0-9]{7,14})(?::[0-9]{1,3})?@s\.whatsapp\.net$/.exec(jid);
  return m ? telefoneBrasil(m[1]) : null;
}
function maskPhone(phone) {
  return phone ? '+' + phone.slice(0, 4) + ' •••• ' + phone.slice(-4) : 'Não identificado';
}
function eventTimestamp(value) {
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.valueOf()) ? null : date;
}

/**
 * Reject untrusted or ambiguous identity instead of treating a WhatsApp LID
 * or a group participant as the contact's verified telephone.
 */
export function parseButtonClick(payload, {
  instance = EXPECTED_INSTANCE,
  now = () => new Date(),
} = {}) {
  if (!payload || typeof payload !== 'object' || payload.event !== 'ButtonClick' ||
      payload.instanceName !== instance) return { valid: false, reason: 'origem-invalida' };
  const raw = payload.data;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { valid: false, reason: 'sem-dados' };
  const choice = CHOICES.get(raw.buttonId);
  if (!choice) return { valid: false, reason: 'botao-desconhecido' };
  const messageId = String(raw.messageId ?? '');
  if (!/^[A-Za-z0-9_:-]{6,180}$/.test(messageId)) return { valid: false, reason: 'id-invalido' };
  const timestamp = eventTimestamp(raw.timestamp);
  if (!timestamp || Math.abs(now().getTime() - timestamp.getTime()) > MAX_EVENT_AGE) {
    return { valid: false, reason: 'evento-fora-do-prazo' };
  }
  const sender = jidNumber(raw.phone);
  const senderJid = jidNumber(raw.jid);
  const chat = jidNumber(raw.chat);
  // FromMe must be explicitly false; do not infer false from missing value.
  const verified = raw.fromMe === false && sender !== null && sender === senderJid && sender === chat;
  return {
    valid: true,
    choice,
    sender: verified ? sender : null,
    timestamp: timestamp.toISOString(),
    messageId,
    verified,
    reason: verified ? null : 'identidade-nao-verificada',
    instance: payload.instanceName,
  };
}

export function iniciarRespostasBotoes({
  dataDir, contatos, denuncias, convites, agora = () => new Date(),
  instanceName = EXPECTED_INSTANCE,
} = {}) {
  if (!dataDir || !contatos || !denuncias) throw new Error('Dependências de respostas incompletas.');
  mkdirSync(dataDir, { recursive: true });
  const dbFile = join(dataDir, 'respostas-botoes-whatygo.json');
  const eventSecret = privateKey(join(dataDir, 'respostas-botoes-hmac-local.txt'));
  const bridgeSecret = privateKey(join(dataDir, 'whatygo-ponte-chave.txt'));

  function checkBridgeKey(token) {
    return keyMatches(token, bridgeSecret);
  }
  function load() {
    try {
      const doc = JSON.parse(readFileSync(dbFile, 'utf8'));
      if (doc.versao !== 1 || !Array.isArray(doc.eventos)) throw new Error('Histórico inválido.');
      return doc;
    } catch (e) {
      if (e.code === 'ENOENT') return { versao: 1, eventos: [] };
      throw e;
    }
  }
  function save(doc) {
    const temp = dbFile + '.' + process.pid + '.' + randomBytes(4).toString('hex') + '.tmp';
    writeFileSync(temp, JSON.stringify(doc, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    renameSync(temp, dbFile);
  }
  // This method must only be called after the loopback-only HTTP endpoint
  // authenticates the monitor's shared secret; unverified button data is inert.
  function receive(payload) {
    const event = parseButtonClick(payload, { instance: instanceName, now: agora });
    if (!event.valid) return { ok: false, ignored: true, reason: event.reason };
    const hash = hmac(eventSecret, event.instance + ':' + event.messageId + ':' + event.choice);
    const doc = load();
    const exists = doc.eventos.find(row => row.id === hash);
    if (exists) return { ok: true, duplicate: true, status: exists.status };
    const phone = event.sender;
    const contact = phone ? contatos.listar().find(c => c.telefone === phone) : null;
    let status = 'pendente-identidade';
    let detail = 'Não foi possível verificar o telefone do clique.';
    if (phone && event.choice === 'recusar') {
      const result = denuncias.registrar({
        telefone: phone,
        mensagemId: 'whatygo-' + event.messageId,
        motivo: 'saida-solicitada',
        origem: 'clique-botao-whatygo-validado',
      });
      status = 'recusa-bloqueada';
      detail = result.duplicada
        ? 'A recusa já havia sido registrada; o bloqueio permanece.'
        : 'Bloqueio confirmado para impedir novos convites.';
    } else if (phone && event.choice === 'aceitar') {
      if (denuncias.estaBloqueado(phone)) {
        status = 'impedido-bloqueado';
        detail = 'O número está bloqueado. Não enviar convite.';
      } else if (!contact || !contatoComConsentimento(contact)) {
        status = 'pendente-consentimento';
        detail = 'Confirmar registro de consentimento antes de encaminhar o grupo.';
      } else {
        status = 'aceite-pendente-operador';
        detail = 'Aceite registrado. O operador pode encaminhar o link do grupo manualmente.';
      }
    }
    const entry = {
      id: hash,
      instante: event.timestamp,
      registradoEm: agora().toISOString(),
      acao: event.choice,
      status,
      detalhe: detail,
      contatoId: contact?.id || null,
      telefone: maskPhone(phone),
      instancia: event.instance,
    };
    doc.eventos.unshift(entry);
    doc.eventos.length = Math.min(doc.eventos.length, MAX_ENTRIES);
    save(doc);
    return { ok: true, duplicate: false, status };
  }
  function list() {
    const rows = load().eventos;
    let groupUrl = null;
    try {
      const candidate = convites?.configuracao?.().grupoUrl;
      const u = new URL(candidate);
      if (u.protocol === 'https:' && u.hostname === 'chat.whatsapp.com') groupUrl = u.href;
    } catch {}
    const total = {
      recebido: rows.length,
      aceites: rows.filter(x => x.acao === 'aceitar').length,
      recusas: rows.filter(x => x.acao === 'recusar').length,
      bloqueios: rows.filter(x => x.status === 'recusa-bloqueada').length,
      pendentes: rows.filter(x => x.status.startsWith('pendente-')).length,
    };
    return {
      total,
      registros: rows.slice(0, 100).map(x => {
        const stillEligible = x.status === 'aceite-pendente-operador' && x.contatoId &&
          contatos.listar().some(c => c.id === x.contatoId && contatoComConsentimento(c) &&
            !denuncias.estaBloqueado(c.telefone));
        const laterBlocked = x.status === 'aceite-pendente-operador' && x.contatoId &&
          contatos.listar().some(c => c.id === x.contatoId && denuncias.estaBloqueado(c.telefone));
        return {
          ...x,
          status: laterBlocked ? 'impedido-bloqueado' : x.status,
          linkGrupo: stillEligible ? groupUrl : null,
        };
      }),
    };
  }
  return { receive, list, checkBridgeKey };
}
