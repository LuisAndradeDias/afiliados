import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("extensao Mercado Livre usa identidade discreta sem ampliar permissoes", async () => {
  const path = new URL("../browser-extension/mercadolivre-affiliate/manifest.json", import.meta.url);
  const manifest = JSON.parse(await readFile(path, "utf8"));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, "Conector 02");
  assert.equal(manifest.version, "0.4.1");
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
