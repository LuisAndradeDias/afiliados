import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarImportacaoAutorizada } from '../src/importacao-autorizada.mjs';
import { iniciarServidor } from '../src/server.mjs';

const GRUPO_ID = '11111111-1111-4111-8111-111111111111';
const ORIGEM = 'grupoteste-01';
const LISTA = 'Nome;Telefone\nAna;11988887777\n11988887777\n21 99999-7777\nlinha sem numero';
const consentimento = {
  autorizacaoColeta: true,
  referenciaPermissao: 'Consentimentos individuais documentados no teste',
};

function post(base, rota, objeto, headers = {}) {
  return fetch(base + rota, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(objeto),
  });
}

test('prévia não escreve dados, informa duplicados e indica linhas inválidas', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cpv-previa-'));
  try {
    const banco = iniciarImportacaoAutorizada(dir);
    const arquivo = join(dir, 'participantes-importados.json');
    const entrada = { origem: ORIGEM, grupoId: GRUPO_ID, lista: LISTA };
    const resultado = banco.simular(entrada);
    assert.deepEqual(
      [resultado.novos, resultado.repetidos, resultado.invalidos, resultado.cabecalhos],
      [2, 1, 1, 1],
    );
    assert.deepEqual(resultado.linhasInvalidas, [5]);
    const comLinhaEmBranco = banco.simular({ ...entrada, lista: '11988887777\n\nlinha ruim' });
    assert.deepEqual(comLinhaEmBranco.linhasInvalidas, [3], 'número de linha preserva linhas em branco');
    assert.equal(resultado.validosDistintos, 2);
    assert.equal(existsSync(arquivo), false, 'a prévia não cria um banco de dados');
    assert.doesNotMatch(JSON.stringify(resultado), /5511988887777/, 'a prévia não retorna telefones');
    const gravado = banco.importar({ ...entrada, ...consentimento });
    assert.equal(gravado.novos, 2);
    const antes = readFileSync(arquivo, 'utf8');
    const seguinte = banco.simular(entrada);
    assert.equal(seguinte.novos, 0);
    assert.equal(seguinte.repetidos, 3);
    assert.equal(readFileSync(arquivo, 'utf8'), antes, 'a prévia não altera o banco existente');
    assert.throws(() => banco.simular({ ...entrada, lista: 'tudo inválido' }), /Nenhum número/);
    assert.equal(banco.listar().total, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('prévia HTTP exige sessão, proteção administrativa e grupo cadastrado', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cpv-previa-http-'));
  let server;
  try {
    const running = await iniciarServidor({ port: 0, dataDir: dir });
    server = running.servidor;
    const { base, chave } = running;
    const entradaSemGrupo = { grupoId: GRUPO_ID, lista: LISTA };
    assert.equal((await post(base, '/api/admin/importados/previa', entradaSemGrupo)).status, 401);
    const login = await post(base, '/api/admin/login', { chave });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await post(base, '/api/admin/importados/previa', entradaSemGrupo, { cookie })).status, 403);
    const admin = { cookie, 'x-cpv-admin': '1' };
    assert.equal((await post(base, '/api/admin/importados/previa', entradaSemGrupo, admin)).status, 409);
    const cadastro = await post(base, '/api/admin/grupos', {
      nome: 'Grupo teste para prévia',
      link: 'https://chat.whatsapp.com/CpMG7JTqP464hgJwf8ElFc',
      origem: ORIGEM,
      permissaoDivulgacao: false,
    }, admin);
    assert.equal(cadastro.status, 200);
    const { grupo } = await cadastro.json();
    const previa = await post(base, '/api/admin/importados/previa', {
      grupoId: grupo.id, lista: LISTA,
    }, admin);
    assert.equal(previa.status, 200);
    const resposta = await previa.json();
    assert.equal(resposta.previa.novos, 2);
    assert.equal(resposta.previa.invalidos, 1);
    assert.equal(existsSync(join(dir, 'participantes-importados.json')), false);
    assert.equal(
      (await post(base, '/api/admin/importados', { grupoId: grupo.id, lista: LISTA, ...consentimento }, admin)).status,
      200,
    );
    const ui = await (await fetch(base + '/painel')).text();
    assert.match(ui, /id="startGuide"/);
    assert.match(ui, /id="importPreview"/);
    assert.match(ui, /id="importOpenGroup"/);
    assert.match(ui, /Versão 0\.5/);
    const js = await (await fetch(base + '/assets/importacao.js')).text();
    assert.match(js, /api\/admin\/importados\/previa/);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
