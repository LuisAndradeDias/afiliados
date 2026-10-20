import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarServidor } from '../src/server.mjs';
import { telefoneBrasil, VERSAO_TERMO } from '../src/contatos.mjs';

const segundos = { method: 'POST', headers: { 'content-type': 'application/json' } };
function post(base, path, body, extra = {}) {
  return fetch(base + path, {
    ...segundos,
    ...extra,
    headers: { ...segundos.headers, ...(extra.headers || {}) },
    body: JSON.stringify(body),
  });
}

test('telefone Brasil normaliza DDD e rejeita números indevidos', () => {
  assert.equal(telefoneBrasil('(11) 99999-9999'), '5511999999999');
  assert.equal(telefoneBrasil('+55 (11) 99999-9999'), '5511999999999');
  assert.equal(telefoneBrasil('1133334444'), '551133334444');
  assert.equal(telefoneBrasil('abc'), null);
  assert.equal(telefoneBrasil('00000000000'), null);
  assert.equal(telefoneBrasil('+351 912345678'), null);
});

test('fluxo com duas etapas, painel privado, csv seguro, descadastro e nenhum disparo', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cacapromos-consent-'));
  let server;
  try {
    const running = await iniciarServidor({ port: 0, dataDir: dir });
    server = running.servidor;
    const { base, chave } = running;
    assert.match(chave, /^[a-f0-9]{48}$/);

    const noConsent = await post(base, '/api/cadastro', {
      nome: 'Visitante', telefone: '11987654321', origem: 'parceria-01', consentimento: false
    });
    assert.equal(noConsent.status, 400, 'sem consentimento é proibido cadastrar');

    const invalid = await post(base, '/api/cadastro', {
      telefone: '12345', consentimento: true, origem: 'parceria-01'
    });
    assert.equal(invalid.status, 400);

    const honeypot = await post(base, '/api/cadastro', {
      telefone: '11987654321', website: 'spam', consentimento: true
    });
    assert.equal(honeypot.status, 400);

    assert.equal((await fetch(base + '/api/admin/resumo')).status, 401);
    assert.equal((await fetch(base + '/api/admin/contatos')).status, 401);
    assert.equal((await fetch(base + '/api/admin/contatos.csv')).status, 401);
    assert.equal((await fetch(base + '/api/admin/modelo.xlsx')).status, 401);

    const cadastro = await post(base, '/api/cadastro', {
      nome: '=HYPERLINK("https://example.invalid","Test")', telefone: '+55 (11) 98765-4321',
      origem: 'parceria-01', consentimento: true, website: ''
    });
    assert.equal(cadastro.status, 200);
    const cadastroInfo = await cadastro.json();
    assert.equal(cadastroInfo.registrado, true);
    assert.equal(cadastroInfo.repetido, false);
    assert.match(cadastroInfo.codigo, /^[A-F0-9]{6}$/);
    assert.equal(cadastroInfo.remetente, '', 'segundo número ainda não foi configurado');
    assert.ok(!JSON.stringify(cadastroInfo).includes('tokenDescadastro'));

    const registro = JSON.parse(readFileSync(join(dir, 'contatos-autorizados.json'), 'utf8'));
    assert.equal(registro.contatos.length, 1);
    assert.equal(registro.contatos[0].status, 'pendente');
    assert.equal(registro.contatos[0].versaoTermo, VERSAO_TERMO);
    assert.equal(registro.contatos[0].telefone, '5511987654321');
    const id = registro.contatos[0].id;
    const token = registro.contatos[0].tokenDescadastro;

    const duplicate = await post(base, '/api/cadastro', {
      nome: 'Qualquer pessoa', telefone: '11987654321', consentimento: true
    });
    assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json()).repetido, true);
    assert.equal(JSON.parse(readFileSync(join(dir, 'contatos-autorizados.json'), 'utf8')).contatos.length, 1);

    const wrongPassword = await post(base, '/api/admin/login', { chave: 'incorreta' });
    assert.equal(wrongPassword.status, 401);
    const login = await post(base, '/api/admin/login', { chave });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    const admin = { headers: { cookie, 'x-cpv-admin': '1' } };
    const invalidCsrf = await post(base, '/api/admin/remetente', { telefone: '11999999999' }, { headers: { cookie } });
    assert.equal(invalidCsrf.status, 403);
    const outside = await post(base, '/api/admin/remetente', { telefone: '11999999999' }, {
      headers: { cookie, 'x-cpv-admin': '1', origin: 'https://outrosite.example' }
    });
    assert.equal(outside.status, 403);

    const impossibleConfirm = await post(base, '/api/admin/confirmar', {
      id, codigo: cadastroInfo.codigo, evidencia: 'mensagem-recebida'
    }, admin);
    assert.equal(impossibleConfirm.status, 409, 'não confirmar sem segundo número');
    const pendingLink = await fetch(base + '/api/admin/convite?id=' + id, { headers: { cookie } });
    assert.equal(pendingLink.status, 409, 'não preparar mensagem antes de verificar consentimento');

    const setNumber = await post(base, '/api/admin/remetente', { telefone: '(11) 99988-7766' }, admin);
    assert.equal(setNumber.status, 200);
    assert.equal((await setNumber.json()).remetente, '5511999887766');
    const wrongCode = await post(base, '/api/admin/confirmar', {
      id, codigo: '000000', evidencia: 'mensagem-recebida'
    }, admin);
    assert.equal(wrongCode.status, 409);
    const rightCode = await post(base, '/api/admin/confirmar', {
      id, codigo: cadastroInfo.codigo, evidencia: 'mensagem-recebida'
    }, admin);
    assert.equal(rightCode.status, 200);

    const summary = await (await fetch(base + '/api/admin/resumo', { headers: { cookie } })).json();
    assert.equal(summary.contatos.ativos, 1);
    assert.equal(summary.contatos.pendentes, 0);
    const allowed = await fetch(base + '/api/admin/convite?id=' + id, { headers: { cookie } });
    assert.equal(allowed.status, 200);
    const msg = await allowed.json();
    assert.match(msg.mensagem, /Você autorizou receber novidades/);
    assert.match(msg.mensagem, /responda SAIR/);
    assert.match(msg.url, /^https:\/\/wa\.me\/5511987654321\?text=/);
    assert.equal(msg.numeroRemetente, '5511999887766');

    const csvResponse = await fetch(base + '/api/admin/contatos.csv', { headers: { cookie } });
    assert.equal(csvResponse.status, 200);
    const csv = await csvResponse.text();
    assert.match(csv, /consentimento_confirmado_em_utc/);
    assert.match(csv, /"'=HYPERLINK/);
    assert.doesNotMatch(csv, /tokenDescadastro/);
    const workbook = await fetch(base + '/api/admin/modelo.xlsx', { headers: { cookie } });
    assert.equal(workbook.status, 200);
    assert.match(workbook.headers.get('content-type'), /spreadsheetml/);
    const workbookBytes = Buffer.from(await workbook.arrayBuffer());
    assert.equal(workbookBytes.toString('ascii', 0, 2), 'PK');

    const markSent = await post(base, '/api/admin/registrar-envio', { id }, admin);
    assert.equal(markSent.status, 200);
    const cancel = await post(base, '/api/descadastro', { token });
    assert.equal(cancel.status, 200);
    const afterOptout = await fetch(base + '/api/admin/convite?id=' + id, { headers: { cookie } });
    assert.equal(afterOptout.status, 409, 'após descadastro não se prepara mensagem');
    const contactAfter = JSON.parse(readFileSync(join(dir, 'contatos-autorizados.json'), 'utf8')).contatos[0];
    assert.equal(contactAfter.status, 'descadastrado');
    assert.ok(contactAfter.descadastroEm);
    assert.equal((await post(base, '/api/descadastro', { token })).status, 200, 'descadastro repetido é seguro');
    assert.equal((await fetch(base + '/api/admin/contatos', { headers: { cookie } })).status, 200);
    const adminList = await (await fetch(base + '/api/admin/contatos', { headers: { cookie } })).json();
    assert.equal(adminList.contatos.length, 1);
    assert.ok(!JSON.stringify(adminList).includes('tokenDescadastro'));
    const remove = await post(base, '/api/admin/excluir', { id }, admin);
    assert.equal(remove.status, 200);
    assert.equal(JSON.parse(readFileSync(join(dir, 'contatos-autorizados.json'), 'utf8')).contatos.length, 0);
    assert.equal((await fetch(base + '/api/admin/convite?id=' + id, { headers: { cookie } })).status, 409);

    const antigo = await fetch(base + '/painel', { redirect:'manual' });
    assert.equal(antigo.status, 302);
    assert.equal(antigo.headers.get('location'), '/campanhas');
    assert.equal((await fetch(base + '/assets/painel.js')).status, 404,
      'Script obsoleto não pode permanecer publicado');
    assert.equal((await fetch(base + '/sair?token=' + token)).status, 200);
    const oldReport = await fetch(base + '/relatorio?chave=' + chave);
    assert.equal(oldReport.status, 200, 'relatório anterior continua disponível');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
