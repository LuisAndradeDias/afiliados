import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarServidor } from '../src/server.mjs';

test('a captação utiliza os mesmos tokens do Figma e do painel de ofertas', () => {
  const ofertas = readFileSync(new URL('../../../src/painel/public/central.tokens.css', import.meta.url), 'utf8');
  const captacao = readFileSync(new URL('../src/assets/afiliados-v2.tokens.css', import.meta.url), 'utf8');
  assert.equal(captacao, ofertas, 'As duas cópias dos tokens devem ser idênticas');
  assert.match(captacao, /--af-brand-primary:/);
  assert.match(captacao, /--af-focus-ring:/);
});

test('seis telas locais mostram nova identidade sem perder IDs e com rotas públicas isoladas', async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), 'afiliados-v2-ui-'));
  const app = await iniciarServidor({
    port: 0, host: '127.0.0.1', dataDir, whatsappWorkerTeste: true,
  });
  t.after(async () => {
    app.servidor.closeAllConnections();
    await new Promise(resolve => app.servidor.close(resolve));
    rmSync(dataDir, { recursive: true, force: true });
  });

  const pages = [
    ['/inicio', 'cleanAuthorized'],
    ['/enviar', 'quickChooseSelf'],
    ['/contatos', 'contactsBody'],
    ['/campanhas', 'appView'],
    ['/respostas-botoes', 'rbAutoEnable'],
    ['/denuncias', 'reportFilters'],
  ];
  for (const [pathname, control] of pages) {
    const response = await fetch(app.base + pathname);
    assert.equal(response.status, 200, pathname);
    const html = await response.text();
    assert.match(html, /data-layout="clean"/, pathname);
    assert.match(html, /\/assets\/afiliados-v2\.tokens\.css/, pathname);
    assert.match(html, /\/assets\/afiliados-v2\.css/, pathname);
    assert.match(html, /Local · protegido/, pathname);
    assert.match(html, /class="clean-global-link"/, pathname);
    assert.match(html, /http:\/\/127\.0\.0\.1:3030\/central/, pathname);
    assert.match(html, /http:\/\/127\.0\.0\.1:3030\/ofertas/, pathname);
    assert.ok(html.includes('id="' + control + '"'), control + ' ausente em ' + pathname);
  }

  for (const asset of ['/assets/afiliados-v2.tokens.css', '/assets/afiliados-v2.css']) {
    const response = await fetch(app.base + asset);
    assert.equal(response.status, 200, asset);
    assert.match(response.headers.get('content-type') || '', /text\/css/, asset);
    assert.ok((await response.text()).length > 1000, asset);
  }

  for (const pathname of ['/sair', '/denunciar', '/c/teste-v2']) {
    const response = await fetch(app.base + pathname);
    assert.equal(response.status, 200, pathname);
    const html = await response.text();
    assert.doesNotMatch(html, /afiliados-v2\.css|afiliados-v2\.tokens\.css/, pathname);
    assert.doesNotMatch(html, /data-layout="clean"/, pathname);
  }
});
