import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarRespostasBotoes, parseButtonClick } from '../src/respostas-botoes.mjs';

const NOW = new Date('2026-10-22T16:00:00.000Z');
const P = '5511999990000';
const msg = (buttonId, overrides = {}) => ({
  event: 'ButtonClick',
  instanceName: 'cpv-lab-remetente-4306',
  data: {
    buttonId,
    buttonText: buttonId,
    type: 'native_flow_response',
    phone: P + '@s.whatsapp.net',
    jid: P + '@s.whatsapp.net',
    chat: P + '@s.whatsapp.net',
    fromMe: false,
    messageId: '3EB01234ABCDEF',
    timestamp: Math.floor(NOW.getTime() / 1000),
    ...overrides,
  },
});
const agreement = {
  id: '9d4e1a04-aec9-4cf5-958e-f7a836bb9c5a',
  telefone: P,
  status: 'ativo',
  consentimentoConfirmadoEm: NOW.toISOString(),
  evidencia: 'autorizacao-externa-declarada-com-origem-e-data',
  registroAutorizacao: {
    origem: 'autorizacao-teste',
    dataAutorizacao: '2026-10-22',
    referencia: 'exemplo-autorizado',
    declaradoEm: NOW.toISOString(),
  },
};
function setup(t, contacts = []) {
  const directory = mkdtempSync(join(tmpdir(), 'cpv-whatygo-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const blocked = new Set();
  const calls = [];
  const deps = {
    dataDir: directory,
    agora: () => NOW,
    contatos: { listar: () => contacts },
    denuncias: {
      estaBloqueado: (p) => blocked.has(p),
      registrar: (data) => { calls.push(data); blocked.add(data.telefone); return { bloqueado: true, duplicada: false }; },
    },
    convites: { configuracao: () => ({ grupoUrl: 'https://chat.whatsapp.com/TESTE1234' }) },
  };
  return { deps, create: () => iniciarRespostasBotoes(deps), directory, calls, blocked };
}
test('only validated ButtonClick events can identify a person', () => {
  const options = { now: () => NOW };
  assert.equal(parseButtonClick(msg('aceitar_grupo'), options).verified, true);
  assert.equal(parseButtonClick(msg('recusar_grupo', { fromMe: true }), options).verified, false);
  assert.equal(parseButtonClick(msg('recusar_grupo', { phone: '117778888@lid' }), options).verified, false);
  assert.equal(parseButtonClick(msg('recusar_grupo', { chat: '123@g.us' }), options).verified, false);
  assert.equal(parseButtonClick(msg('recusar_grupo', { chat: '5511988880000@s.whatsapp.net' }), options).verified, false);
  assert.equal(parseButtonClick(msg('unknown'), options).valid, false);
  assert.equal(parseButtonClick({ ...msg('aceitar_grupo'), instanceName: 'other' }, options).valid, false);
  assert.equal(parseButtonClick(msg('aceitar_grupo', { timestamp: 2 }), options).valid, false);
  assert.equal(parseButtonClick(msg('aceitar_grupo', { messageId: '../bad' }), options).valid, false);
});
test('accepted opt-in is displayed as manual next step without sending or blocking', (t) => {
  const { create, calls } = setup(t, [agreement]);
  const module = create();
  assert.equal(module.receive(msg('aceitar_grupo')).status, 'aceite-pendente-operador');
  assert.equal(calls.length, 0);
  const { registros } = module.list();
  assert.equal(registros[0].linkGrupo, 'https://chat.whatsapp.com/TESTE1234');
  assert.equal(registros[0].telefone.includes(P), false);
});
test('no consent produces a pending acceptance with no group link', (t) => {
  const module = setup(t).create();
  assert.equal(module.receive(msg('aceitar_grupo')).status, 'pendente-consentimento');
  assert.equal(module.list().registros[0].linkGrupo, null);
});
test('a verified refusal blocks persistently and repeated click is idempotent', (t) => {
  const { create, calls, directory } = setup(t);
  const module = create();
  assert.equal(module.receive(msg('recusar_grupo')).status, 'recusa-bloqueada');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].motivo, 'saida-solicitada');
  assert.equal(module.receive(msg('recusar_grupo')).duplicate, true);
  assert.equal(create().list().total.bloqueios, 1);
  assert.equal(calls.length, 1);
  const storage = readFileSync(join(directory, 'respostas-botoes-whatygo.json'), 'utf8');
  assert.equal(storage.includes(P), false);
});
test('ambiguous sender, self reply and group reply never alter blocklist', (t) => {
  const { create, calls } = setup(t);
  const mod = create();
  const events = [
    msg('recusar_grupo', { fromMe: true }),
    msg('recusar_grupo', { phone: '123@lid', messageId: 'ABC000012345' }),
    msg('recusar_grupo', { chat: 'group@g.us', messageId: 'ABC000012346' }),
  ];
  for (const event of events) mod.receive(event);
  assert.equal(calls.length, 0);
  assert.ok(mod.list().total.pendentes >= 1);
});
test('local bridge key is required and survives restart', (t) => {
  const { create, directory } = setup(t);
  const mod = create();
  assert.equal(mod.checkBridgeKey('a'.repeat(64)), false);
  assert.equal(mod.checkBridgeKey(''), false);
  const secret = readFileSync(join(directory, 'whatygo-ponte-chave.txt'), 'utf8').trim();
  assert.equal(mod.checkBridgeKey(secret), true);
  assert.equal(create().checkBridgeKey(secret), true);
});
