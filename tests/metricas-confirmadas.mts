import test from "node:test";
import assert from "node:assert/strict";
import { resumirEnviosConfirmados } from "../src/ofertas/historico.js";

test("contagem ignora vistos e alegacoes nao confirmadas", () => {
  const resumo = resumirEnviosConfirmados([
    { chave: "amazon:A", plataforma: "Amazon", produtoId: "A", titulo: "Produto", vistoEm: "2026-11-03T16:00:00.000Z" },
    { chave: "amazon:B", plataforma: "Amazon", produtoId: "B", titulo: "Produto", enviadoEm: "invalid" },
    { chave: "amazon:C", plataforma: "Amazon Brasil", produtoId: "C", titulo: "Produto", enviadoEm: "2026-11-03T19:01:00.000Z" },
    { chave: "ml:D", plataforma: "mercado-livre", produtoId: "D", titulo: "Produto", enviadoEm: "2026-11-03T19:10:00.000Z" },
    { chave: "shopee:E", plataforma: "Shopee", produtoId: "E", titulo: "Produto", enviadoEm: "2026-11-03T18:05:00.000Z" }
  ]);
  assert.deepEqual(resumo, {
    total: 3, amazon: 1, mercadoLivre: 1, shopee: 1,
    ultimoEm: "2026-11-03T19:10:00.000Z"
  });
});

test("historico vazio nunca inventa vendas ou envios", () => {
  assert.deepEqual(resumirEnviosConfirmados([]), {
    total: 0, amazon: 0, mercadoLivre: 0, shopee: 0, ultimoEm: null
  });
});
