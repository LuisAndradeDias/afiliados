import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarServidor } from '../src/server.mjs';
import { normalizarOrigem } from '../src/analytics.mjs';

const realGroup = 'https://chat.whatsapp.com/CpMG7JTqP464hgJwf8ElFc';

test('origem da campanha nunca recebe telefone/nome ou outro campo arbitrário', () => {
  assert.equal(normalizarOrigem('instagram'), 'instagram');
  assert.equal(normalizarOrigem('parceria-01'), 'parceria-01');
  assert.equal(normalizarOrigem('5511999999999'), 'direto');
  assert.equal(normalizarOrigem('Fulano Silva'), 'direto');
  assert.equal(normalizarOrigem('https://site.exemplo'), 'direto');
  assert.equal(normalizarOrigem('../../arquivos'), 'direto');
});

test('página, CTA independente do cadastro e relatório agregado', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cacapromos-piloto-'));
  let servidor;
  try {
    const running = await iniciarServidor({ port: 0, dataDir: dir });
    servidor = running.servidor;
    const { base, chave } = running;
    assert.match(chave, /^[0-9a-f]{48}$/);
    const health = await fetch(base + '/saude');
    assert.equal(health.status, 200);

    const landing = await fetch(base + '/c/instagram');
    assert.equal(landing.status, 200);
    const html = await landing.text();
    assert.match(html, /A gente caça/);
    assert.match(html, /Caça Promos VIP/i);
    assert.match(html, /entrar\?origem=instagram/i);
    assert.match(html, /cadastro opcional/i);
    assert.match(html, /id="leadConsent" type="checkbox" required/);
    assert.doesNotMatch(html, /id="leadConsent"[^>]*checked/);
    assert.doesNotMatch(html, /disparos automáticos a participantes/i);

    const landingParceria = await fetch(base + '/c/parceria-01');
    assert.equal(landingParceria.status, 200);
    const raiz = await fetch(base + '/', { redirect:'manual' });
    assert.equal(raiz.status, 302);
    assert.equal(raiz.headers.get('location'), '/enviar');

    const saida = await fetch(base + '/entrar?origem=instagram', { redirect: 'manual' });
    assert.equal(saida.status, 303);
    assert.equal(saida.headers.get('location'), realGroup);

    assert.equal((await fetch(base + '/relatorio')).status, 403);
    assert.equal((await fetch(base + '/relatorio?chave=ERRADA')).status, 403);
    const report = await fetch(base + '/relatorio?chave=' + chave);
    assert.equal(report.status, 200);
    const reportHtml = await report.text();
    assert.match(reportHtml, /Resultados do/);
    assert.match(reportHtml, /Cliques não representam necessariamente/);

    const csv = await (await fetch(base + '/relatorio.csv?chave=' + chave)).text();
    assert.match(csv, /instagram;1;1;100,0/);
    assert.match(csv, /parceria-01;1;0;0,0/);

    const dados = JSON.parse(readFileSync(join(dir, 'metricas.json'), 'utf8'));
    assert.equal(dados.campanhas.instagram.visitas, 1);
    assert.equal(dados.campanhas.instagram.cliques, 1);
    assert.equal(dados.campanhas['parceria-01'].visitas, 1);
    assert.equal(Object.keys(dados.dias).length, 1);
    assert.ok(!JSON.stringify(dados).includes('whatsapp.com'));
    assert.ok(!JSON.stringify(dados).includes('telefone'));

    const head = await fetch(base + '/c/instagram', { method: 'HEAD' });
    assert.equal(head.status, 200);
    const depois = JSON.parse(readFileSync(join(dir, 'metricas.json'), 'utf8'));
    assert.equal(depois.campanhas.instagram.visitas, 1, 'HEAD não conta uma visita');

    assert.equal((await fetch(base + '/pagina-inexistente')).status, 404);
    assert.equal((await fetch(base + '/entrar', { method: 'POST' })).status, 405);
  } finally {
    if (servidor) await new Promise((resolve) => servidor.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a configuração do link aceita apenas convite HTTPS do WhatsApp', async () => {
  await assert.rejects(
    iniciarServidor({ port: 0, inviteUrl: 'http://example.com' }),
    /link HTTPS de chat.whatsapp.com/
  );
  await assert.rejects(
    iniciarServidor({ port: 0, inviteUrl: 'https://example.com' }),
    /link HTTPS de chat.whatsapp.com/
  );
});
