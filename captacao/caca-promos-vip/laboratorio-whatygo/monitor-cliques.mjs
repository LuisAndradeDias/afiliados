import { createServer } from 'node:http';
import { mkdirSync, existsSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { instanciaAutorizada, segredoPonteCentral } from './ponte-identidade.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const logDir = join(root, 'runtime');
const logFile = join(logDir, 'eventos-botoes.jsonl');
const privateDir = join(root, 'private');
const keyPath = join(privateDir, 'webhook-recebimento-chave.txt');
const bridgeKeyPath = segredoPonteCentral(root);
mkdirSync(privateDir, { recursive: true });
let incomingKey;
if (existsSync(keyPath)) incomingKey = readFileSync(keyPath, 'utf8').trim();
else {
  incomingKey = randomBytes(32).toString('hex');
  writeFileSync(keyPath, incomingKey + '\n', { flag: 'wx', mode: 0o600 });
}
if (!/^[a-f0-9]{64}$/.test(incomingKey)) throw new Error('Segredo de webhook inválido.');
function authenticated(key) {
  if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) return false;
  return timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(incomingKey, 'hex'));
}
async function relay(payload) {
  // Confirm the linked sender has not been replaced by a different account.
  const settings = readFileSync(join(root, '.env.native'), 'utf8');
  const admin = settings.split(/\r?\n/).find(line => line.startsWith('GLOBAL_API_KEY='))?.slice('GLOBAL_API_KEY='.length);
  const expectedJid = readFileSync(join(privateDir, 'remetente-autorizado-jid.txt'), 'utf8').trim();
  if (!admin || !expectedJid || payload?.instanceName !== 'cpv-lab-remetente-4306') {
    throw new Error('Instância não autorizada.');
  }
  const instances = await fetch('http://127.0.0.1:4000/instance/all', {
    headers: { apikey: admin }, signal: AbortSignal.timeout(4000),
  });
  if (!instances.ok) throw new Error('Não foi possível conferir a sessão remetente.');
  const all = await instances.json();
  if (!instanciaAutorizada(all.data, payload.instanceName, expectedJid)) {
    throw new Error('A sessão remetente não está verificada.');
  }
  const key = readFileSync(bridgeKeyPath, 'utf8').trim();
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Ponte interna não configurada.');
  const d = payload?.data ?? {};
  const safe = {
    event: payload?.event,
    instanceName: payload?.instanceName,
    data: {
      buttonId: d.buttonId, messageId: d.messageId,
      phone: d.phone, jid: d.jid, chat: d.chat,
      fromMe: d.fromMe, timestamp: d.timestamp,
    },
  };
  const response = await fetch('http://127.0.0.1:3045/api/local/whatygo/evento', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cpv-whatygo': key },
    body: JSON.stringify(safe),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error('Central recusou evento HTTP ' + response.status);
  const result = await response.json();
  if (result?.ok === true) return result.status || 'recebido';
  const knownReasons = new Set(['origem-invalida', 'sem-dados', 'botao-desconhecido', 'id-invalido', 'evento-fora-do-prazo']);
  const reason = knownReasons.has(result?.reason) ? result.reason : 'motivo-nao-identificado';
  return 'ignorado:' + reason;
}
function safeEventHash(payload) {
  if (payload?.event !== 'ButtonClick') return null;
  const id = payload?.data?.messageId;
  if (typeof id !== 'string' || id.length < 6 || id.length > 180) return null;
  return createHash('sha256')
    .update(String(payload?.instanceName || '') + ':' + id + ':' + String(payload?.data?.buttonId || ''))
    .digest('hex');
}
const history = [];
const diagnostics = {
  receivedClicks: 0, forwardedClicks: 0, failedClicks: 0,
  lastClickAt: null, lastResult: null, lastError: null,
};
mkdirSync(logDir, { recursive: true });
if (existsSync(logFile)) {
  for (const line of readFileSync(logFile, 'utf8').split(/\r?\n/).filter(Boolean).slice(-100)) {
    try {
      const item = JSON.parse(line);
      if (item?.evento && item?.quando) {
        if (item.idHash) {
          const old = history.findIndex(e => e.idHash === item.idHash);
          if (old >= 0) history.splice(old, 1);
        }
        history.unshift(item);
        history.splice(25);
      }
    } catch {}
  }
}

const choices = new Map([
  ['aceitar_grupo', 'Entrar no grupo'],
  ['recusar_grupo', 'Nao tenho interesse'],
  ['CPV_ENTRAR', 'Entrar no grupo'],
  ['CPV_NAO_INTERESSE', 'Nao tenho interesse'],
]);
function findChoice(payload) {
  const identifier = String(payload?.data?.buttonId ?? payload?.data?.response?.buttonId ?? '');
  return {
    identifier: choices.has(identifier) ? identifier : null,
    label: choices.get(identifier) ?? 'Opcao nao identificada',
  };
}
function addEvent(payload, integration = 'recebido') {
  const raw = String(payload?.event ?? '').replace(/[^A-Za-z]/g, '').toUpperCase();
  const type = ({ BUTTONCLICK: 'BUTTON_CLICK', SENDMESSAGE: 'SEND_MESSAGE', CONNECTION: 'CONNECTION' })[raw];
  if (!type) return;
  const idHash = safeEventHash(payload);
  const event = {
    ...(idHash ? { idHash } : {}),
    quando: new Date().toISOString(),
    evento: type,
    instancia: String(payload?.instanceName ?? payload?.instance ?? '').slice(0, 60),
    ...(type === 'BUTTON_CLICK' ? { escolha: findChoice(payload), integracao: integration } : {}),
  };
  if (idHash) {
    const previous = history.findIndex(row => row.idHash === idHash);
    if (previous >= 0) history.splice(previous, 1);
  }
  history.unshift(event);
  history.splice(25);
  appendFileSync(logFile, JSON.stringify(event) + '\n', 'utf8');
}

const page = `<!doctype html><html lang="pt-br"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Caça Promos VIP - Monitor de Cliques</title>
<style>
body{font:15px system-ui;background:#101715;color:#e5eee8;margin:0;padding:30px}
main{max-width:850px;margin:auto}h1{font-size:23px}
section{background:#19231f;border:1px solid #37423c;border-radius:16px;padding:20px;margin-top:18px}
.small{color:#acb8af}.pill{background:#204b34;padding:5px 9px;border-radius:99px}
table{border-collapse:collapse;width:100%}td,th{padding:11px;border-bottom:1px solid #37423c;text-align:left}
@media(max-width:550px){body{padding:14px}section{padding:12px}td,th{padding:7px;font-size:12px}}
</style><main>
<h1>Caça Promos VIP · Monitor de botões</h1>
<p class="small">Laboratório local. Nenhuma mensagem é enviada por esta tela.</p>
<section><span class="pill" id="status">Aguardando...</span>
<p class="small">Webhook local autenticado. As respostas válidas são repassadas à Central.</p>
<p class="small" id="bridgeState">Conferindo a ponte...</p></section>
<section><h2>Eventos recebidos</h2><table><thead><tr>
<th>Horário</th><th>Evento</th><th>Instância</th><th>Escolha</th><th>Integração</th>
</tr></thead><tbody id="events"><tr><td colspan="4">Nenhum evento ainda.</td></tr></tbody></table></section>
<p class="small">O monitor grava somente tipo do evento, nome da instância e identificador da opção.
Abra as respostas detalhadas na <a href="http://127.0.0.1:3045/respostas-botoes">Central Caça Promos VIP</a>.
A API sozinha não garante entrega.</p></main>
<script>
async function load(){
try {
 const r=await fetch('/status',{cache:'no-store'}); if(!r.ok)throw Error();
 const d=await r.json();document.getElementById('status').textContent='Monitor ativo';
 const b=d.bridge||{};
 document.getElementById('bridgeState').textContent=!b.keyPresent?'Ponte: falta chave local':
  b.lastError?'Ponte: último encaminhamento falhou ('+b.lastError+')':
  'Ponte: chave correta; cliques recebidos '+(b.receivedClicks||0)+', encaminhados '+(b.forwardedClicks||0);
 const body=document.getElementById('events');body.replaceChildren();
 if(!d.events.length){let tr=document.createElement('tr');let td=document.createElement('td');
 td.colSpan=5;td.textContent='Aguardando evento...';tr.append(td);body.append(tr);return}
 for(const e of d.events){let tr=document.createElement('tr');
 for(const text of [new Date(e.quando).toLocaleTimeString('pt-BR'),e.evento,e.instancia,e.escolha?.label??'-',e.integracao??'-']){
 let td=document.createElement('td');td.textContent=text;tr.append(td)}
 body.append(tr)}
}catch {document.getElementById('status').textContent='Monitor desconectado';}}
load();setInterval(load,3000);
</script></html>`;

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      active: true, events: history,
      bridge: {
        keyPresent: existsSync(bridgeKeyPath),
        ...diagnostics,
      },
    }));
    return;
  }
  // Diagnostic: exercises the actual instance check and Central bridge, but
  // deliberately uses an unknown button, so the Central rejects it without
  // registering a click or changing a contact.
  if (req.method === 'POST' && url.pathname === '/diagnosticar-ponte') {
    if (req.socket.remoteAddress !== '127.0.0.1' ||
        !authenticated(url.searchParams.get('key'))) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end('{"ok":false}');
      return;
    }
    void (async () => {
      try {
        const result = await relay({
          event: 'ButtonClick',
          instanceName: 'cpv-lab-remetente-4306',
          data: { buttonId: '__diagnostico_inerte__' },
        });
        if (result !== 'ignorado-pela-central') throw new Error('Resposta inesperada da Central.');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true,"diagnostico":"ponte-autenticada-sem-registro"}');
      } catch (error) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: false,
          diagnostico: 'ponte-falhou',
          erro: String(error?.message || 'erro').slice(0, 100).replace(/[0-9]{9,}/g, '[oculto]'),
        }));
      }
    })();
    return;
  }
  if (req.method === 'POST' && url.pathname === '/webhook') {
    if (req.socket.remoteAddress !== '127.0.0.1' ||
        !authenticated(url.searchParams.get('key'))) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end('{"ok":false}');
      return;
    }
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      if (body.length + chunk.length > 65536) {
        res.writeHead(413);
        res.end('Evento muito grande');
        req.destroy();
      } else {
        body += chunk;
      }
    });
    req.on('end', async () => {
      if (res.writableEnded) return;
      let payload;
      try { payload = JSON.parse(body); }
      catch {
        res.writeHead(400);
        res.end('JSON invalido');
        return;
      }
      const isClick = payload?.event === 'ButtonClick';
      if (isClick) {
        diagnostics.receivedClicks += 1;
        diagnostics.lastClickAt = new Date().toISOString();
      }
      try {
        let result = 'recebido';
        if (isClick) {
          result = await relay(payload);
          diagnostics.forwardedClicks += 1;
          diagnostics.lastResult = result;
          diagnostics.lastError = null;
        }
        addEvent(payload, result);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } catch (error) {
        if (isClick) {
          diagnostics.failedClicks += 1;
          diagnostics.lastResult = 'falha-ponte';
          const note = String(error?.message || 'Falha não identificada');
          diagnostics.lastError = note.slice(0, 120).replace(/[0-9]{9,}/g, '[oculto]');
          addEvent(payload, 'falha-ponte');
        }
        // Return 503 so WhatyGo may retry. No contact is changed by the monitor.
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end('{"ok":false,"error":"Ponte local indisponivel"}');
      }
    });
    return;
  }
  res.writeHead(404);
  res.end('Nao encontrado');
});
server.listen(4011, '127.0.0.1', () => {
  console.log('MONITOR_READY http://127.0.0.1:4011');
});
