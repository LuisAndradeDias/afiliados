import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarRespostasBotoes } from '../src/respostas-botoes.mjs';
import { mensagemConviteGrupo, validarConviteGrupo } from '../src/whatygo-responder-link.mjs';

const NOW = new Date('2026-10-22T18:00:00.000Z');
const TEL = '5511999990000';
const LINK = 'https://chat.whatsapp.com/abcdefghijklmnopqrstuv';
const CONTATO = {
  id: '741acf0e-e956-49cc-9b27-bdef37e9f8df', telefone: TEL,
  status: 'ativo', consentimentoConfirmadoEm: NOW.toISOString(),
  evidencia: 'autorizacao-externa-declarada-com-origem-e-data',
  registroAutorizacao: { origem: 'autorizado-explicitamente', referencia: 'teste-documentado',
    dataAutorizacao: '2026-10-22', declaradoEm: NOW.toISOString() },
};
const click = (id, choice = 'aceitar_grupo', fields = {}) => ({
  event: 'ButtonClick', instanceName: 'cpv-lab-remetente-4306',
  data: {
    buttonId: choice, messageId: id,
    phone: TEL + '@s.whatsapp.net', jid: TEL + '@s.whatsapp.net',
    chat: TEL + '@s.whatsapp.net', fromMe: false,
    timestamp: Math.floor(NOW.getTime() / 1000), ...fields,
  },
});
const tick = () => new Promise(resolve => setTimeout(resolve, 35));
function setup(t, { authorized = true, send = async () => ({ aceitoPelaApi: true }) } = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'cpv-auto-btn-'));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  const blocked = new Set();
  const registered = authorized ? [CONTATO] : [];
  const calls = [];
  const deps = {
    dataDir, agora: () => NOW,
    contatos: { listar: () => registered },
    denuncias: {
      estaBloqueado: phone => blocked.has(phone),
      registrar: ({ telefone }) => { blocked.add(telefone); return { duplicada: false }; },
    },
    convites: { configuracao: () => ({ grupoUrl: LINK }) },
    enviarLink: async data => { calls.push(data); return send(data); },
  };
  const service = iniciarRespostasBotoes(deps);
  return { service, calls, blocked, dataDir, registered, deps };
}

test('automatic links are opt-in only and config must be explicitly enabled', t => {
  const { service, calls, dataDir } = setup(t);
  assert.equal(service.configuracaoAutomacao().habilitada, false);
  assert.throws(() => service.configurarAutomacao({ habilitada: true }), /Confirme/);
  assert.equal(service.receive(click('MSGOPTIN00001')).status, 'aceite-pendente-operador');
  assert.equal(calls.length, 0);
  assert.equal(service.configurarAutomacao({ habilitada: true, confirmado: true }).habilitada, true);
  assert.equal(readFileSync(join(dataDir, 'respostas-botoes-automacao.json'), 'utf8').includes(TEL), false);
});
test('one validated accepted click triggers one solicited link via a mocked transport', async t => {
  const { service, calls, dataDir } = setup(t);
  service.configurarAutomacao({ habilitada: true, confirmado: true });
  assert.equal(service.receive(click('MSGVALID00001')).status, 'auto-na-fila');
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].telefone, TEL);
  assert.equal(calls[0].urlGrupo, LINK);
  assert.equal(service.list().registros[0].status, 'auto-link-enviado-api');
  assert.equal(service.receive(click('MSGVALID00001')).duplicate, true);
  assert.equal(service.receive(click('MSGVALID00002')).status, 'auto-limite-contato');
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(service.list().total.respostasAutomaticas, 1);
  const persisted = readFileSync(join(dataDir, 'respostas-botoes-whatygo.json'), 'utf8');
  assert.equal(persisted.includes(TEL), false);
  assert.equal(JSON.stringify(service.list()).includes(TEL), false);
});
test('missing consent, blocked account, group click or invalid identity never sends', async t => {
  const { service, calls, blocked, registered } = setup(t, { authorized: false });
  service.configurarAutomacao({ habilitada: true, confirmado: true });
  assert.equal(service.receive(click('MSGPENDING01')).status, 'pendente-consentimento');
  assert.equal(service.receive(click('MSGLIDCLCK01', 'aceitar_grupo', {
    phone: '12345@lid',
  })).status, 'pendente-identidade');
  blocked.add(TEL);
  registered.push(CONTATO);
  assert.equal(service.receive(click('MSGBLOCKED01')).status, 'impedido-bloqueado');
  await tick();
  assert.equal(calls.length, 0);
});
test('refusal while an accepted auto reply is pending prevents sending', async t => {
  const { service, calls, blocked } = setup(t);
  service.configurarAutomacao({ habilitada: true, confirmado: true });
  assert.equal(service.receive(click('MSGACCEPT01')).status, 'auto-na-fila');
  assert.equal(service.receive(click('MSGREFUSE01', 'recusar_grupo')).status, 'recusa-bloqueada');
  assert.equal(blocked.has(TEL), true);
  await tick();
  assert.equal(calls.length, 0);
  assert.equal(service.list().registros.find(r => r.acao === 'aceitar').status, 'impedido-bloqueado');
});
test('turning off automation before queue executes prevents all outgoing sends', async t => {
  const { service, calls } = setup(t);
  service.configurarAutomacao({ habilitada: true, confirmado: true });
  assert.equal(service.receive(click('MSGDISABLE01')).status, 'auto-na-fila');
  service.configurarAutomacao({ habilitada: false });
  await tick();
  assert.equal(calls.length, 0);
  assert.equal(service.list().registros[0].status, 'auto-interrompido');
});
test('uncertain send gets recorded once with no automatic retry', async t => {
  const { service, calls } = setup(t, { send: async () => { throw Error('timeout'); } });
  service.configurarAutomacao({ habilitada: true, confirmado: true });
  assert.equal(service.receive(click('MSGTIMEOUT01')).status, 'auto-na-fila');
  await tick();
  assert.equal(service.list().registros[0].status, 'auto-incerto');
  assert.equal(service.receive(click('MSGTIMEOUT01')).duplicate, true);
  assert.equal(service.receive(click('MSGTIMEOUT02')).status, 'auto-limite-contato');
  await tick();
  assert.equal(calls.length, 1);
});
test('after restart, pending events are not automatically replayed', async t => {
  const { service, calls, deps } = setup(t);
  service.configurarAutomacao({ habilitada: true, confirmado: true });
  service.receive(click('MSGRESTART01'));
  await tick();
  const reload = iniciarRespostasBotoes(deps);
  assert.equal(reload.configuracaoAutomacao().habilitada, true);
  assert.equal(reload.receive(click('MSGRESTART01')).duplicate, true);
  assert.equal(calls.length, 1);
});
test('group URL is strict and never taken from an arbitrary domain', () => {
  assert.equal(validarConviteGrupo(LINK), LINK);
  assert.equal(validarConviteGrupo('https://evil.test/chat.whatsapp.com/abcdefghi123456'), null);
  assert.equal(validarConviteGrupo('http://chat.whatsapp.com/abcdefghijklmnop'), null);
  assert.equal(validarConviteGrupo(LINK + '?redirect=evil'), null);
  assert.match(mensagemConviteGrupo(LINK), /confirme sua entrada/);
});
