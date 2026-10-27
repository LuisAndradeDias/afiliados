import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  criarRepositorioShopee,
  validarRascunhoShopee,
  validarLinkShopee
} from "../src/painel/shopee-rascunhos.js";

const novo = (resto = {}) => ({
  titulo: "Fone Bluetooth sem fio",
  url: "https://s.shopee.com.br/abc123?af=campanha",
  confirmado: true,
  preco: "149,90",
  ...resto
});

test("aceita apenas links HTTPS Shopee válidos e mantém query de afiliado", () => {
  for (const link of [
    "https://s.shopee.com.br/ABC1?af_id=123",
    "https://shope.ee/1abcxyz",
    "https://shopee.com.br/Produto-i.123.456?utm=abc",
    "https://mall.shopee.com.br/oferta/abc"
  ]) assert.equal(validarLinkShopee(link), link);
  for (const link of [
    "http://shopee.com.br/produto",
    "https://shopee.com.br.evil.example/produto",
    "https://shopee.com.br@evil.example/produto",
    "https://user:password@shopee.com.br/produto",
    "https://fake-shopee.com.br/produto",
    "https://shopee.com.br/",
    "javascript:alert(1)",
    "https://evil.example"
  ]) assert.throws(() => validarLinkShopee(link), /Shopee|HTTPS|link|URL/i, link);
});

test("exige link afiliado confirmado e título real; não inventa descontos ou comissão", () => {
  assert.throws(() => validarRascunhoShopee(novo({ confirmado: false })), /afiliado|confirm/i);
  assert.throws(() => validarRascunhoShopee(novo({ titulo: "a" })), /título|titulo/i);
  assert.throws(() => validarRascunhoShopee(novo({ preco: "-1" })), /preço|preco/i);
  assert.throws(() => validarRascunhoShopee(novo({ preco: "1abc" })), /preço|preco/i);
  const r = validarRascunhoShopee(novo());
  assert.equal(r.preco, 149.9);
  assert.equal(r.titulo, "Fone Bluetooth sem fio");
  assert.equal(r.urlAfiliado, "https://s.shopee.com.br/abc123?af=campanha");
  assert.equal("comissao" in r, false);
  assert.equal("desconto" in r, false);
});

test("rascunhos persistem no disco local, não duplicam e podem ser excluídos", async () => {
  const dir = await mkdtemp(join(tmpdir(), "shopee-drafts-"));
  const file = join(dir, "data", "shopee-rascunhos.json");
  try {
    const repo = criarRepositorioShopee(file);
    assert.deepEqual(await repo.listar(), []);
    const item = await repo.salvar(novo());
    assert.match(item.id, /^[0-9a-f-]{36}$/);
    assert.equal(item.origem, "manual");
    assert.equal(item.status, "rascunho");
    assert.equal((await repo.listar()).length, 1);
    await assert.rejects(repo.salvar(novo()), /já está cadastrado|já cadastrado|duplicad/i);
    const second = criarRepositorioShopee(file);
    assert.equal((await second.listar())[0]?.urlAfiliado, item.urlAfiliado);
    assert.equal(await second.excluir(item.id), true);
    assert.equal(await second.excluir(item.id), false);
    assert.deepEqual(await second.listar(), []);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("arquivo inválido não é sobrescrito silenciosamente", async () => {
  const dir = await mkdtemp(join(tmpdir(), "shopee-corrupt-"));
  const file = join(dir, "rascunhos.json");
  try {
    await writeFile(file, "{nao-json");
    const repo = criarRepositorioShopee(file);
    await assert.rejects(repo.salvar(novo()), /arquivo|ler|dados/i);
    assert.equal(await readFile(file, "utf8"), "{nao-json");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("rascunhos não contêm instruções de WhatsApp e não enviam mensagens", async () => {
  const dir = await mkdtemp(join(tmpdir(), "shopee-safe-"));
  try {
    const file = join(dir, "rascunhos.json");
    await criarRepositorioShopee(file).salvar(novo());
    const content = await readFile(file, "utf8");
    assert.doesNotMatch(content, /whatsapp|numero|telefone|senha|app_secret|refresh_token/i);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
