import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarImportacaoAutorizada } from '../src/importacao-autorizada.mjs';

const GRUPO_A = '11111111-1111-4111-8111-111111111111';
const GRUPO_B = '22222222-2222-4222-8222-222222222222';
const autoriza = { autorizacaoColeta: true, referenciaPermissao: 'Permissão individual registrada em 13/10/2026' };

function comBanco(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'captacao-import-'));
  try { return fn(iniciarImportacaoAutorizada(dir), dir); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

test('exige autorização documentada, grupo e números válidos', () => comBanco(banco => {
  assert.throws(() => banco.importar({ origem: 'grupo-01', grupoId: GRUPO_A, lista: '11999998888', autorizacaoColeta: false, referenciaPermissao: 'Declaração' }), /autorização individual/);
  assert.throws(() => banco.importar({ origem: 'grupo-01', grupoId: GRUPO_A, lista: '11999998888', autorizacaoColeta: true, referenciaPermissao: '' }), /referência/);
  assert.throws(() => banco.importar({ origem: 'grupo-01', grupoId: GRUPO_A, lista: 'não tenho números', ...autoriza }), /Nenhum número/);
  assert.throws(() => banco.importar({ origem: 'grupo-01', grupoId: GRUPO_A, lista: '11999998888\n'.repeat(1501), ...autoriza }), /1.500/);
  assert.equal(banco.listar().total, 0);
  const internacional = banco.importar({ origem: 'grupo-01', grupoId: GRUPO_A, lista: '+351 912 345 678', ...autoriza });
  assert.equal(internacional.novos, 1);
}));

test('normaliza telefones, evita duplicações, conserva origem e não habilita mensagens', () => comBanco((banco, dir) => {
  const a = banco.importar({ grupoId: GRUPO_A, origem: 'grupo-01', lista: 'Nome;Telefone\nAna; (11) 98888-7777\n+55 (11) 98888-7777\n11977776666\ninválido', ...autoriza });
  assert.equal(a.novos, 2);
  assert.equal(a.repetidos, 1);
  assert.equal(a.invalidos, 1);
  assert.equal(a.cabecalhos, 1);
  const b = banco.importar({ grupoId: GRUPO_B, origem: 'grupo-02', lista: '(11) 98888-7777;Ana Silva\n21 99999-7777', ...autoriza, referenciaPermissao: 'Termo da segunda comunidade' });
  assert.equal(b.novos, 1);
  assert.equal(b.repetidos, 1);
  assert.equal(banco.listar().total, 3);
  assert.equal(banco.listar('grupo-02').total, 2);
  const registro = banco.listar().contatos.find(c => c.telefone === '5511988887777');
  assert.deepEqual(registro.origens, ['grupo-01', 'grupo-02']);
  assert.equal(registro.autorizadoParaMensagens, false);
  assert.equal(registro.permissoesPorOrigem['grupo-01'].referencia, autoriza.referenciaPermissao);
  assert.equal(registro.permissoesPorOrigem['grupo-02'].referencia, 'Termo da segunda comunidade');
  assert.doesNotMatch(banco.exportarCsv('grupo-01'), /5521999997777/);
  assert.match(banco.exportarCsv('grupo-02'), /Termo da segunda comunidade/);
  assert.equal(JSON.parse(readFileSync(join(dir, 'participantes-importados.json'), 'utf8')).historico.length, 2);
  assert.equal(banco.excluir(registro.id), true);
  assert.equal(banco.listar().total, 2);
}));

test('escapa injeção em CSV e exige origem válida', () => comBanco(banco => {
  banco.importar({ grupoId: GRUPO_A, origem: 'grupo-01', lista: '=HYPERLINK("https://e.test");11966665555', ...autoriza });
  assert.match(banco.exportarCsv(), /"'=HYPERLINK/);
  assert.throws(() => banco.listar('=2+2'), /Identificador/);
  assert.throws(() => banco.excluir('não-existe'), /Registro não encontrado/);
}));
