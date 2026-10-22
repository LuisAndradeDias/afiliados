import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, normalize } from 'node:path';
import {
  numeroDaConta, instanciaAutorizada, segredoPonteCentral,
} from '../laboratorio-whatygo/ponte-identidade.mjs';

const EXPECTED = '5511999990000:12@s.whatsapp.net';
const NAME = 'cpv-lab-remetente-4306';
const one = (jid, connected = true) => [{ name: NAME, connected, jid }];

test('reconnecting the same phone with a changed device suffix remains safe', () => {
  assert.equal(numeroDaConta(EXPECTED), '5511999990000');
  assert.equal(instanciaAutorizada(one('5511999990000:99@s.whatsapp.net'), NAME, EXPECTED), true);
  assert.equal(instanciaAutorizada(one('5511999990000@s.whatsapp.net'), NAME, EXPECTED), true);
  assert.equal(instanciaAutorizada(one(EXPECTED), NAME, EXPECTED), true);
});

test('a different account or disconnected session never authenticates', () => {
  assert.equal(instanciaAutorizada(one('5511988880000:99@s.whatsapp.net'), NAME, EXPECTED), false);
  assert.equal(instanciaAutorizada(one('5511999990000:33@s.whatsapp.net', false), NAME, EXPECTED), false);
  assert.equal(instanciaAutorizada(one('5511999990000@lid'), NAME, EXPECTED), false);
  assert.equal(instanciaAutorizada(one('5511999990000@g.us'), NAME, EXPECTED), false);
  assert.equal(instanciaAutorizada(one(EXPECTED).concat(one(EXPECTED)), NAME, EXPECTED), false);
  assert.equal(instanciaAutorizada([], NAME, EXPECTED), false);
  assert.equal(instanciaAutorizada(one(EXPECTED), NAME, '123@lid'), false);
  assert.equal(instanciaAutorizada(one(EXPECTED), 'other-instance', EXPECTED), false);
});

test('the 3045 bridge always reads the private preview data directory, never the default data directory', () => {
  const laboratory = join('C:', 'projeto01', 'captacao', 'caca-promos-vip', 'laboratorio-whatygo');
  const actual = segredoPonteCentral(laboratory);
  const expected = normalize(join(laboratory, '..', 'dados', 'previa-acer', 'whatygo-ponte-chave.txt'));
  assert.equal(actual, expected);
  assert.match(actual, /previa-acer/);
});
