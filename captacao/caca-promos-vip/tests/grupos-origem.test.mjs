import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarServidor } from '../src/server.mjs';
import { validarLinkGrupo, validarOrigemGrupo } from '../src/grupos.mjs';

const VALID_URL = 'https://chat.whatsapp.com/CpMG7JTqP464hgJwf8ElFc';
const jsonPost = (base, path, payload, headers = {}) => fetch(base + path, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(payload),
});

test('valida apenas links reais de convite e origem sem dados pessoais', () => {
  assert.equal(validarLinkGrupo(VALID_URL + '/'), VALID_URL);
  assert.equal(validarOrigemGrupo('TECNOS-01'), 'tecnos-01');
  for (const url of [
    'https://chat.whatsapp.com.evil.invalid/CpMG7JTqP464hgJwf8ElFc',
    'http://chat.whatsapp.com/CpMG7JTqP464hgJwf8ElFc',
    'https://chat.whatsapp.com@evil.invalid/CpMG7JTqP464hgJwf8ElFc',
    'https://wa.me/5511999999999',
    'https://chat.whatsapp.com/invalid',
    'https://chat.whatsapp.com/CpMG7JTqP464hgJwf8ElFc?tracker=123',
    'javascript:alert(1)',
  ]) {
    assert.throws(() => validarLinkGrupo(url), /link|Link|Use/);
  }
  assert.throws(() => validarOrigemGrupo('5511999999999'), /Identificador/);
  assert.throws(() => validarOrigemGrupo('grupo;=SUM(1)'), /Identificador/);
});

test('painel de grupos exige login, guarda permissão e só exporta inscrições voluntárias por origem', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cpv-grupos-'));
  let server;
  try {
    const running = await iniciarServidor({ port: 0, dataDir: dir });
    server = running.servidor;
    const { base, chave } = running;
    assert.equal((await fetch(base + '/api/admin/grupos')).status, 401);
    assert.equal((await jsonPost(base, '/api/admin/grupos', {
      nome: 'Grupo teste', link: VALID_URL, origem: 'tecnologia-01',
      permissaoDivulgacao: false,
    })).status, 401);

    const login = await jsonPost(base, '/api/admin/login', { chave });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const admin = { cookie, 'x-cpv-admin': '1' };
    const leitura = { headers: { cookie } };

    const malicious = await jsonPost(base, '/api/admin/grupos', {
      nome: 'Inseguro', link: 'https://chat.whatsapp.com.bad.invalid/Abcdef1234567890123456',
      origem: 'inseguro-01', permissaoDivulgacao: true,
    }, admin);
    assert.equal(malicious.status, 409);
    assert.equal((await (await fetch(base + '/api/admin/grupos', leitura)).json()).grupos.length, 0);

    const created = await jsonPost(base, '/api/admin/grupos', {
      nome: 'Tecnologia voluntária', link: VALID_URL, origem: 'tecnologia-01',
      permissaoDivulgacao: false,
    }, admin);
    assert.equal(created.status, 200);
    const result = await created.json();
    const id = result.grupo.id;
    assert.equal(result.grupo.permissaoDivulgacao, false);

    const duplicate = await jsonPost(base, '/api/admin/grupos', {
      nome: 'Outro', link: VALID_URL, origem: 'tecnologia-02',
      permissaoDivulgacao: true,
    }, admin);
    assert.equal(duplicate.status, 409);
    assert.equal((await jsonPost(base, '/api/admin/grupos/permissao', {
      id, permitido: true,
    }, { cookie })).status, 403);
    const permit = await jsonPost(base, '/api/admin/grupos/permissao', {
      id, permitido: true,
    }, admin);
    assert.equal(permit.status, 200);
    assert.equal((await permit.json()).grupo.permissaoDivulgacao, true);

    const registro = JSON.parse(readFileSync(join(dir, 'grupos-origem.json'), 'utf8'));
    assert.equal(registro.grupos.length, 1);
    assert.equal(registro.grupos[0].origem, 'tecnologia-01');

    const dataA = await jsonPost(base, '/api/cadastro', {
      nome: 'Interessado A', telefone: '(11) 98888-7777',
      consentimento: true, origem: 'tecnologia-01',
    });
    const dataB = await jsonPost(base, '/api/cadastro', {
      nome: 'Interessado B', telefone: '(21) 98888-7777',
      consentimento: true, origem: 'instagram',
    });
    assert.equal(dataA.status, 200);
    assert.equal(dataB.status, 200);

    const sheet = await fetch(base + '/api/admin/contatos.csv?origem=tecnologia-01', leitura);
    assert.equal(sheet.status, 200);
    const csv = await sheet.text();
    assert.match(csv, /Interessado A/);
    assert.doesNotMatch(csv, /Interessado B/);
    assert.match(csv, /consentimento_declarado_em_utc/);
    assert.doesNotMatch(csv, /tokenDescadastro/);
    assert.equal((await fetch(base + '/api/admin/contatos.csv?origem=tec%3B%3D42', leitura)).status, 400);
    assert.equal((await fetch(base + '/api/admin/contatos.csv?origem=tecnologia-01')).status, 401);

    const ui = await (await fetch(base + '/painel')).text();
    assert.match(ui, /id="groupCard"/);
    assert.match(ui, /id="groupContactsFilter"/);
    assert.match(ui, /Grupos de origem|Seus grupos e convites/);
    const js = await (await fetch(base + '/assets/painel.js')).text();
    assert.match(js, /Abrir no WhatsApp/);
    assert.match(js, /permissaoDivulgacao/);

    const removed = await jsonPost(base, '/api/admin/grupos/excluir', { id }, admin);
    assert.equal(removed.status, 200);
    assert.equal((await (await fetch(base + '/api/admin/grupos', leitura)).json()).grupos.length, 0);
    const after = await (await fetch(base + '/api/admin/contatos.csv?origem=tecnologia-01', leitura)).text();
    assert.match(after, /Interessado A/, 'excluir grupo não apaga prova de consentimento');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    rmSync(dir, { force: true, recursive: true });
  }
});
