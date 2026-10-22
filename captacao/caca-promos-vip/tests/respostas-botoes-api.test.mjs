import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarServidor } from '../src/server.mjs';

test('Central receives only authenticated local ButtonClick events and renders the reply page', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'cpv-respostas-http-'));
  const started = await iniciarServidor({
    port: 0, host: '127.0.0.1', dataDir: dir, whatsappWorkerTeste: true,
    agora: () => new Date('2026-10-22T16:00:00.000Z'),
  });
  t.after(async () => {
    await new Promise((resolve) => started.servidor.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  });
  const { base } = started;
  const html = await fetch(base + '/respostas-botoes');
  assert.equal(html.status, 200);
  const markup = await html.text();
  assert.match(markup, /Respostas dos botões/);
  assert.match(markup, /respostas-botoes\.js/);
  const data = await fetch(base + '/api/local/whatygo/respostas');
  assert.equal(data.status, 200);
  assert.equal((await data.json()).total.recebido, 0);
  const token = readFileSync(join(dir, 'whatygo-ponte-chave.txt'), 'utf8').trim();
  const sample = {
    event: 'ButtonClick',
    instanceName: 'cpv-lab-remetente-4306',
    data: {
      buttonId: 'recusar_grupo',
      messageId: '3EB0TESTBTNCLICK0001',
      phone: '5511999990000@s.whatsapp.net',
      jid: '5511999990000@s.whatsapp.net',
      chat: '5511999990000@s.whatsapp.net',
      fromMe: false,
      timestamp: 1792684800,
    },
  };
  const send = (headers) => fetch(base + '/api/local/whatygo/evento', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(sample),
  });
  assert.equal((await send({})).status, 403);
  assert.equal((await send({ 'x-cpv-whatygo': token, origin: 'http://evil.test' })).status, 403);
  assert.equal((await send({ 'x-cpv-whatygo': token })).status, 200);
  assert.equal((await send({ 'x-cpv-whatygo': token })).status, 200);
  const events = await (await fetch(base + '/api/local/whatygo/respostas')).json();
  assert.equal(events.total.recebido, 1);
  assert.equal(events.total.bloqueios, 1);
  assert.equal(events.registros[0].status, 'recusa-bloqueada');
  assert.equal(events.registros[0].telefone.includes('5511999990000'), false);
  assert.equal(started.contatos.listar().length, 0);
  assert.doesNotMatch(JSON.stringify(events), /5511999990000/);
});
