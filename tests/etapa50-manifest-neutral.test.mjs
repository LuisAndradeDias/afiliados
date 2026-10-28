import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("extensao Mercado Livre usa identidade discreta sem ampliar permissoes", async () => {
  const path = new URL("../browser-extension/mercadolivre-affiliate/manifest.json", import.meta.url);
  const manifest = JSON.parse(await readFile(path, "utf8"));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, "Conector 02");
  assert.equal(manifest.version, "0.4.4");
  assert.doesNotMatch(manifest.name + " " + manifest.description, /afiliad|ca.a promo|captacao/i);

  assert.deepEqual(manifest.permissions, ["alarms", "tabs"]);
  assert.deepEqual(manifest.host_permissions, [
    "http://127.0.0.1:3030/*",
    "http://localhost:3030/*",
    "https://www.mercadolivre.com.br/*",
    "https://mercadolivre.com.br/*",
  ]);
  assert.equal(manifest.background.service_worker, "background.js");
  assert.equal(manifest.content_scripts.length, 1);
  assert.deepEqual(manifest.content_scripts[0].js, ["content.js"]);
  assert.equal(manifest.content_scripts[0].run_at, "document_idle");
});

test("scripts da extensao nao exibem caracteres de substituicao corrompidos", async () => {
  for (const file of ["content.js", "background.js"]) {
    const path = new URL("../browser-extension/mercadolivre-affiliate/" + file, import.meta.url);
    const source = await readFile(path, "utf8");
    assert.ok(!source.includes("\ufffd"), file + " tem caracteres U+FFFD");
  }
});

test("extensao diferencia catalogo de anuncio individual em URLs confiaveis", async () => {
  const path = new URL("../browser-extension/mercadolivre-affiliate/content.js", import.meta.url);
  const source = await readFile(path, "utf8");
  assert.match(source, /const catalogo = /);
  assert.match(source, /const anuncio = /);
  assert.match(source, /hostMercadoLivre/);
  assert.match(source, /url\.username \|\| url\.password/);
  assert.match(source, /etiqueta pode estar correta/i);
});
