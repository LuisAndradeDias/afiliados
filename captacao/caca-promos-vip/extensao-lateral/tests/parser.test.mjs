import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { runInNewContext } from 'node:vm';
const base = join(dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { TextEncoder };
sandbox.globalThis = sandbox;
runInNewContext(readFileSync(join(base, 'extractor-core.js'), 'utf8'), sandbox);
const core = sandbox.CPVVisibleExtraction;

test('telefones com DDD e internacionais; sem telefone => vazio', () => {
  assert.equal(core.normalizar('(11) 98888-7777'), '+5511988887777');
  assert.equal(core.normalizar('+55 48 8411-7227'), '+554884117227');
  assert.equal(core.normalizar('+351 912 345 678'), '+351912345678');
  assert.equal(core.normalizar('R$36,11'), null);
  assert.equal(core.normalizar('texto'), null);
});
test('lista autorizada consolida duplicados e rejeita linhas sem telefone', () => {
  const r = core.analisarLista('Nome;Telefone\nAna;+55 (11) 98888-7777\n+55 11 98888-7777\n+55 (21) 99999-7777\ntexto inválido');
  assert.equal(r.novos, 2);
  assert.equal(r.repetidos, 1);
  assert.equal(r.invalidos, 1);
  assert.equal(r.cabecalhos, 1);
  assert.deepEqual([...r.phones].sort(), ['+5511988887777', '+5521999997777'].sort());
});
test('não executa fórmulas, não inclui números inválidos e aplica limites', () => {
  const r = core.analisarLista('=HYPERLINK("https://example.org")\nNOME;TELEFONE\n11988887777');
  assert.equal(r.novos, 1);
  assert.equal(r.invalidos, 1);
  assert.equal(r.cabecalhos, 1);
  assert.throws(() => core.analisarLista('texto\n'.repeat(1502)), /1.500/);
  assert.throws(() => core.analisarLista('x'.repeat(110001)), /110 KB/);
});
test('permissões da extensão são limitadas ao painel', () => {
  const manifest = JSON.parse(readFileSync(join(base, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.side_panel.default_path, 'sidepanel.html');
  assert.deepEqual([...manifest.permissions], ['sidePanel']);
  assert.equal(manifest.action.default_popup, undefined);
});
