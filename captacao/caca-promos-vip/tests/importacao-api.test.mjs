import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarServidor } from '../src/server.mjs';

function post(base, rota, payload, headers = {}) {
  return fetch(base + rota, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
}

test('API exige admin e importa apenas números com autorização declarada por grupo', async () => {
  const pasta = mkdtempSync(join(tmpdir(), 'cpv-importacao-api-'));
  let servidor;
  try {
    const s = await iniciarServidor({ port: 0, dataDir: pasta });
    servidor = s.servidor;
    const { base, chave } = s;
    assert.equal((await fetch(base + '/api/admin/importados')).status, 401);
    assert.equal((await fetch(base + '/api/admin/importados.csv')).status, 401);
    const login = await post(base, '/api/admin/login', { chave });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const administrador = { cookie, 'x-cpv-admin': '1' };
    const cadastrado = await post(base, '/api/admin/grupos', {
      nome: 'Grupo para teste',
      link: 'https://chat.whatsapp.com/CpMG7JTqP464hgJwf8ElFc',
      origem: 'grupo-teste',
      permissaoDivulgacao: false,
    }, administrador);
    assert.equal(cadastrado.status, 200);
    const { grupo } = await cadastrado.json();
    const payload = { grupoId: grupo.id, lista: 'Nome;Telefone\nTeste;11988887777\n11988887777',
      autorizacaoColeta: true, referenciaPermissao: 'Termos assinados no teste' };
    assert.equal((await post(base, '/api/admin/importados', payload, { cookie })).status, 403);
    assert.equal((await post(base, '/api/admin/importados', { ...payload, autorizacaoColeta: false }, administrador)).status, 409);
    assert.equal((await post(base, '/api/admin/importados', { ...payload, grupoId: 'invalido' }, administrador)).status, 409);
    const salvo = await post(base, '/api/admin/importados', payload, administrador);
    assert.equal(salvo.status, 200);
    assert.equal((await salvo.json()).resultado.novos, 1);
    const corpo = await (await fetch(base + '/api/admin/importados', { headers: { cookie } })).json();
    assert.equal(corpo.total, 1);
    assert.equal(corpo.contatos[0].autorizadoParaMensagens, false);
    const outros = await (await fetch(base + '/api/admin/contatos', { headers: { cookie } })).json();
    assert.equal(outros.contatos.length, 0, 'importação não equivale a autorização para enviar mensagens');
    const csv = await fetch(base + '/api/admin/importados.csv?origem=grupo-teste', { headers: { cookie } });
    assert.equal(csv.status, 200);
    assert.match(await csv.text(), /5511988887777/);
    assert.equal((await fetch(base + '/api/admin/importados.csv?origem=%3D2%2B2', { headers: { cookie } })).status, 400);
    const removido = await post(base, '/api/admin/importados/excluir', { id: corpo.contatos[0].id }, administrador);
    assert.equal(removido.status, 200);
    assert.equal((await (await fetch(base + '/api/admin/importados', { headers: { cookie } })).json()).total, 0);
    const antiga = await fetch(base + '/painel', { redirect:'manual' });
    assert.equal(antiga.status, 302);
    assert.equal(antiga.headers.get('location'), '/enviar');
    assert.equal((await fetch(base + '/assets/importacao.js')).status, 404);
    const novo = await (await fetch(base + '/campanhas')).text();
    assert.match(novo, /id="importFile"/);
  } finally {
    if (servidor) await new Promise(resolve => servidor.close(resolve));
    rmSync(pasta, { recursive: true, force: true });
  }
});
