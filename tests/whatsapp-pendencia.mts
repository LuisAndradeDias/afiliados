import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { criarPendenciaWhatsapp } from "../src/painel/whatsapp-pendencia.js";

test("pendencia e persistente, sem PII, e so some apos conferencia explicita", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cpv-whatsapp-pendencia-"));
  try {
    const path = join(dir, "data", "envio-incerto.json");
    const p = criarPendenciaWhatsapp(path);
    assert.equal(await p.pendente(), false);
    await p.marcar();
    assert.equal(await criarPendenciaWhatsapp(path).pendente(), true);
    const raw = await readFile(path, "utf8");
    assert.match(raw, /envio-nao-confirmado/);
    assert.doesNotMatch(raw, /telefone|grupo|produto|mensagem|chave|token/i);
    await p.limpar();
    assert.equal(await p.pendente(), false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("cadastro de pendencia corrompido nunca libera reenvio", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cpv-whatsapp-incerto-"));
  try {
    const file = join(dir, "incerto.json");
    await writeFile(file, "{corrompido", "utf8");
    assert.equal(await criarPendenciaWhatsapp(file).pendente(), true);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
