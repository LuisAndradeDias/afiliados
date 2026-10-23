import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarServidor } from '../src/server.mjs';

test('automatic invite activation is loopback-only, explicit, and requires confirmed consent', async t => {
  const dataDir = mkdtempSync(join(tmpdir(), 'cpv-auto-api-'));
  const server = await iniciarServidor({
    port: 0, host: '127.0.0.1', dataDir,
    whatsappWorkerTeste: true, agora: () => new Date('2026-10-22T18:00:00.000Z'),
  });
  t.after(async () => {
    await new Promise(resolve => server.servidor.close(resolve));
    rmSync(dataDir, { recursive: true, force: true });
  });
  const target = server.base + '/api/local/whatygo/automacao';
  const post = (body, extra = {}) => fetch(target, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...extra },
    body: JSON.stringify(body),
  });
  const before = await (await fetch(server.base + '/api/local/whatygo/respostas')).json();
  assert.equal(before.automacao.habilitada, false);
  assert.equal((await post({ habilitada: true, confirmado: true })).status, 403);
  assert.equal((await post({ habilitada: true, confirmado: true }, {
    origin: 'http://another.example', 'x-cpv-local': '1',
  })).status, 403);
  assert.equal((await post({ habilitada: true, confirmado: true }, {
    origin: server.base,
  })).status, 403);
  const headers = { origin: server.base, 'x-cpv-local': '1' };
  const noConsent = await post({ habilitada: true }, headers);
  assert.equal(noConsent.status, 400);
  const yes = await post({ habilitada: true, confirmado: true }, headers);
  assert.equal(yes.status, 200);
  assert.equal((await yes.json()).automacao.habilitada, true);
  const after = await (await fetch(server.base + '/api/local/whatygo/respostas')).json();
  assert.equal(after.automacao.habilitada, true);
  assert.equal(after.total.recebido, 0);
  const turnOff = await post({ habilitada: false }, headers);
  assert.equal(turnOff.status, 200);
  assert.equal((await turnOff.json()).automacao.habilitada, false);
  const page = await (await fetch(server.base + '/respostas-botoes')).text();
  assert.match(page, /rbAutoEnable/);
  assert.match(page, /rbAutoDisable/);
  assert.match(page, /rbLatestOutcome/);
  const script = await (await fetch(server.base + '/assets/respostas-botoes.js')).text();
  assert.match(script, /changeAuto\(true\)/);
  assert.match(script, /changeAuto\(false\)/);
});
