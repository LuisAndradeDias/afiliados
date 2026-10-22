import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const patch = readFileSync(join(root, '..', 'laboratorio-whatygo', 'patch-cliques-identidade-whatygo.patch'), 'utf8');

test('WhatyGo obtains button-click identity from the nested MessageInfo instead of null top-level fields', () => {
  assert.match(patch, /\+.*"messageId":\s+evt\.Info\.ID/);
  assert.match(patch, /\+.*"fromMe":\s+evt\.Info\.IsFromMe/);
  assert.match(patch, /\+.*"phone":\s+evt\.Info\.Sender\.ToNonAD\(\)\.String\(\)/);
  assert.match(patch, /\+.*"chat":\s+evt\.Info\.Chat\.ToNonAD\(\)\.String\(\)/);
  assert.match(patch, /-.*"messageId":\s+dataMap\["ID"\]/);
  assert.match(patch, /-.*"fromMe":\s+dataMap\["FromMe"\]/);
});
