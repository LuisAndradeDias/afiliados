import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { instanciaAutorizada } from '../laboratorio-whatygo/ponte-identidade.mjs';

const laboratorio = join(dirname(fileURLToPath(import.meta.url)), '..', 'laboratorio-whatygo');
const instancia = 'cpv-lab-remetente-4306';
const base = 'http://127.0.0.1:4000';
const readPrivate = (relative) => readFileSync(join(laboratorio, relative), 'utf8').trim();

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
  if (!valid) throw new Error('Link de grupo não configurado ou inválido.');
  return [
    'Você escolheu entrar no grupo Caça Promos VIP 👑',
    '',
    'Toque no link abaixo e confirme sua entrada no WhatsApp:',
    valid,
    '',
    'Se o grupo exigir aprovação, aguarde a confirmação dos administradores.',
  ].join('\n');
}

/**
 * Only one solicited text reply per verified button click.
 * Returns API acknowledgement, never claims WhatsApp delivery or group membership.
 */
export async function enviarLinkSolicitado({ telefone, urlGrupo, fetchImpl = fetch }) {
  if (typeof telefone !== 'string' || !/^55[1-9][0-9]{9,10}$/.test(telefone)) {
    throw new Error('Destinatário inválido.');
  }
  const texto = mensagemConviteGrupo(urlGrupo);
  const token = readPrivate('private/instancia-remetente-4306.token');
  const storedJid = readPrivate('private/remetente-autorizado-jid.txt');
  const line = readPrivate('.env.native').split(/\r?\n/)
    .find(x => x.startsWith('GLOBAL_API_KEY='));
  const adminKey = line?.slice('GLOBAL_API_KEY='.length);
  if (!token || !adminKey || !storedJid) throw new Error('Credenciais do laboratório ausentes.');
  const control = new AbortController();
  const timeout = setTimeout(() => control.abort(), 12_000);
  try {
    const response = await fetchImpl(base + '/instance/all', {
      headers: { apikey: adminKey },
      signal: control.signal,
    });
    if (!response.ok) throw new Error('Não foi possível validar a sessão do remetente.');
    const state = await response.json();
    const matches = (state.data ?? []).filter(x => x?.name === instancia);
    if (!instanciaAutorizada(state.data, instancia, storedJid) ||
        matches.length !== 1 || matches[0].token !== token) {
      throw new Error('A sessão WhatsApp não pertence ao remetente autorizado.');
    }
    const sent = await fetchImpl(base + '/send/text', {
      method: 'POST',
      headers: { apikey: token, 'content-type': 'application/json' },
      body: JSON.stringify({ number: telefone, text: texto }),
      signal: control.signal,
    });
    if (!sent.ok) throw new Error('WhatyGo recusou o envio solicitado.');
    const result = await sent.json();
    const id = result?.data?.Info?.ID;
    if (result?.message !== 'success' || typeof id !== 'string' || id.length < 6) {
      throw new Error('O envio não retornou um ID confiável.');
    }
    return { aceitoPelaApi: true };
  } finally {
    clearTimeout(timeout);
  }
}
