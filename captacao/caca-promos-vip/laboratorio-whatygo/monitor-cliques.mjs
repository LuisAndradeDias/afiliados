import { createServer } from 'node:http';
import { mkdirSync, existsSync, readFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const logDir = join(root, 'runtime');
const logFile = join(logDir, 'eventos-botoes.jsonl');
const history = [];
mkdirSync(logDir, { recursive: true });
if (existsSync(logFile)) {
  for (const line of readFileSync(logFile, 'utf8').split(/\r?\n/).filter(Boolean).slice(-25)) {
    try { const item = JSON.parse(line); if (item?.evento && item?.quando) history.unshift(item); } catch {}
  }
}

const choices = new Map([
  ['aceitar_grupo', 'Entrar no grupo'],
  ['recusar_grupo', 'Nao tenho interesse'],
  ['CPV_ENTRAR', 'Entrar no grupo'],
  ['CPV_NAO_INTERESSE', 'Nao tenho interesse'],
]);
function findChoice(payload) {
  const serialized = JSON.stringify(payload?.data ?? {});
  for (const [identifier, label] of choices) {
    if (serialized.includes(identifier)) return { identifier, label };
  }
  return { identifier: null, label: 'Opcao nao identificada' };
}
function addEvent(payload) {
  const type = String(payload?.event ?? '').toUpperCase();
  if (!['BUTTON_CLICK', 'SEND_MESSAGE', 'CONNECTION'].includes(type)) return;
  const event = {
    quando: new Date().toISOString(),
    evento: type,
    instancia: String(payload.instance ?? '').slice(0, 60),
    ...(type === 'BUTTON_CLICK' ? { escolha: findChoice(payload) } : {}),
  };
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
<p class="small">Webhook: http://127.0.0.1:4011/webhook</p></section>
<section><h2>Eventos recebidos</h2><table><thead><tr>
<th>Horário</th><th>Evento</th><th>Instância</th><th>Escolha</th>
</tr></thead><tbody id="events"><tr><td colspan="4">Nenhum evento ainda.</td></tr></tbody></table></section>
<p class="small">O monitor grava somente tipo do evento, nome da instância e identificador da opção.
Confira os botões no celular: a API sozinha não garante entrega.</p></main>
<script>
async function load(){
try {
 const r=await fetch('/status',{cache:'no-store'}); if(!r.ok)throw Error();
 const d=await r.json();document.getElementById('status').textContent='Monitor ativo';
 const body=document.getElementById('events');body.replaceChildren();
 if(!d.events.length){let tr=document.createElement('tr');let td=document.createElement('td');
 td.colSpan=4;td.textContent='Aguardando evento...';tr.append(td);body.append(tr);return}
 for(const e of d.events){let tr=document.createElement('tr');
 for(const text of [new Date(e.quando).toLocaleTimeString('pt-BR'),e.evento,e.instancia,e.escolha?.label??'-']){
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
    res.end(JSON.stringify({ active: true, events: history }));
    return;
  }
  if (req.method === 'POST' && url.pathname === '/webhook') {
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
    req.on('end', () => {
      if (res.writableEnded) return;
      try {
        addEvent(JSON.parse(body));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } catch {
        res.writeHead(400);
        res.end('JSON invalido');
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
