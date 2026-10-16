import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';

const base = join(dirname(fileURLToPath(import.meta.url)), '..');

function iniciarPainel(textoInicial) {
  const ids = [
    'statusText', 'statusDot', 'resultPanel', 'resultItems', 'export',
    'count', 'resultNote', 'consent', 'clipboard', 'start', 'numbers',
    'group', 'demo', 'clear', 'close',
  ];
  const el = id => ({
    id, textContent:'', value:'', checked:false, disabled:false, hidden:false,
    className:'', listeners:{}, children:[], focus() {},
    addEventListener(tipo, callback) { this.listeners[tipo] = callback; },
    replaceChildren() { this.children = []; },
    append(child) { this.children.push(child); },
  });
  const elements = Object.fromEntries(ids.map(id => [id, el(id)]));
  elements.consent.checked = false;
  let copiedText = textoInicial;
  let clipboardCalls = 0;
  let ultimoArquivo = '';
  let ultimoBlob = null;

  const doc = {
    getElementById(id) { return elements[id]; },
    createElement(tag) {
      const item = el(tag);
      if (tag === 'a') item.click = () => { ultimoArquivo = item.download; };
      item.remove = () => {};
      return item;
    },
    body: { append() {} },
  };
  const context = {
    TextEncoder, Blob, document:doc,
    navigator:{clipboard:{readText:async () => {
      clipboardCalls++; return copiedText;
    }}},
    URL:{
      createObjectURL(blob) { ultimoBlob = blob; return 'blob:test'; },
      revokeObjectURL() {},
    },
    setTimeout() {},
  };
  context.globalThis = context;
  for (const script of ['extractor-core.js','sidepanel.js']) {
    runInNewContext(readFileSync(join(base, script), 'utf8'), context);
  }
  async function click(id) {
    await elements[id].listeners.click?.();
  }
  return {
    elements, click,
    change(id) { elements[id].listeners.change?.(); },
    async csv() { return ultimoBlob?.text(); },
    get lastFilename() { return ultimoArquivo; },
    get clipboardReads() { return clipboardCalls; },
    setClipboard(valor) { copiedText = valor; },
  };
}

test('o clipboard so e lido apos clique e confirmacao do operador', async () => {
  const ui = iniciarPainel('Pessoa Inventada\n+55 11 98888-7777');
  await ui.click('clipboard');
  assert.equal(ui.clipboardReads, 0);
  assert.match(ui.elements.statusText.textContent, /Confirme/);
  ui.elements.consent.checked = true;
  await ui.click('clipboard');
  assert.equal(ui.clipboardReads, 1);
  assert.equal(ui.elements.count.textContent, '1');
  assert.equal(ui.elements.export.disabled, false);
});

test('duas colagens cumulativas geram CSV nome-telefone sem duplicacao', async () => {
  const ui = iniciarPainel('Pessoa Exemplo A\n+55 11 98888-7777\nPessoa Exemplo B\n+55 21 99999-7777');
  ui.elements.group.value = 'Grupo teste de ofertas';
  ui.elements.consent.checked = true;
  await ui.click('clipboard');
  ui.setClipboard('Pessoa Exemplo B\n+55 21 99999-7777\nPessoa Exemplo C\n+55 31 98888-7777');
  await ui.click('clipboard');
  assert.equal(ui.elements.count.textContent, '3');
  assert.match(ui.elements.resultNote.textContent, /repetido/);
  await ui.click('export');
  assert.equal(ui.lastFilename, 'cpv-contatos-grupo-teste-de-ofertas.csv');
  const csv = await ui.csv();
  assert.match(csv, /nome;telefone/);
  assert.match(csv, /Pessoa Exemplo A/);
  assert.match(csv, /5511988887777/);
  assert.equal(csv.split(/\r?\n/).filter(Boolean).length, 4);
});

test('entrada manual funciona quando o clipboard nao esta disponivel', async () => {
  const ui = iniciarPainel('');
  ui.elements.consent.checked = true;
  ui.elements.numbers.value = 'Pessoa Ficticia; (11) 98888-7777';
  await ui.click('start');
  assert.equal(ui.clipboardReads, 0);
  assert.equal(ui.elements.count.textContent, '1');
  assert.equal(ui.elements.export.disabled, false);
});

test('limpar e revogar consentimento descartam memoria e bloqueiam CSV', async () => {
  const ui = iniciarPainel('Pessoa Exemplo\n+55 11 98888-7777');
  ui.elements.consent.checked = true;
  await ui.click('clipboard');
  await ui.click('clear');
  assert.equal(ui.elements.export.disabled, true);
  await ui.click('clipboard');
  ui.elements.consent.checked = false;
  ui.change('consent');
  assert.equal(ui.elements.export.disabled, true);
  assert.equal(ui.elements.resultPanel.hidden, true);
  await ui.click('demo');
  assert.equal(ui.elements.count.textContent, '3');
  assert.equal(ui.elements.export.disabled, true);
});
