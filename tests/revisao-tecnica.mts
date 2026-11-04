import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { consultarRevisaoTecnica } from "../src/painel/revisao-http.js";

test("revisão registra somente observações técnicas e histórico real", async () => {
  const raiz = await mkdtemp(join(tmpdir(), "cpv-revisao-"));
  const data = join(raiz, "data");
  try {
    await mkdir(data);
    await writeFile(join(data, "ultima-oferta-whatsapp.json"), JSON.stringify({
      titulo: "Furadeira de teste", produtoId: "MLB123", plataforma: "Mercado Livre",
      precoAtual: 119.9, descontoPercentual: 20, cupomCodigo: "FAKE20",
      urlProduto: "https://www.mercadolivre.com.br/p/MLB123"
    }));
    await writeFile(join(data, "ultima-oferta-mercadolivre.json"), JSON.stringify({
      titulo: "Furadeira de teste", produtoId: "MLB123", plataforma: "Mercado Livre",
      precoAtual: 119.9
    }));
    await writeFile(join(data, "historico-ofertas.json"), JSON.stringify([
      { chave: "amazon:a", titulo: "Teste A", enviadoEm: "2026-11-04T11:00:00Z" },
      { chave: "amazon:b", titulo: "Teste B", vistoEm: "2026-11-04T11:00:00Z" }
    ]));
    const r = await consultarRevisaoTecnica(raiz);
    assert.equal(r.modo, "somente-leitura");
    assert.equal(r.resumo.ofertasObservadas, 1, "Não duplicar mesma oferta");
    assert.equal(r.resumo.enviosConfirmados, 1, "Não contar apenas visualizados");
    assert.equal(r.fichas[0].cupomCodigo, "FAKE20");
    assert.match(r.fichas[0].verificacoes.map(x => x.observacao).join(" "), /aplicabilidade/i);
    assert.equal((r.fichas[0] as unknown as Record<string,unknown>).podePublicar, undefined);
    assert.equal((await readFile(join(data, "ultima-oferta-whatsapp.json"), "utf8")).includes("Furadeira"), true);
  } finally { await rm(raiz, { recursive: true, force: true }); }
});

test("arquivo inválido não quebra a Central e URL host falso não é exibido", async () => {
  const raiz = await mkdtemp(join(tmpdir(), "cpv-rev-invalid-"));
  try {
    await mkdir(join(raiz, "data"));
    await writeFile(join(raiz, "data", "historico-ofertas.json"), "{invalid");
    await writeFile(join(raiz, "data", "ultima-oferta-whatsapp.json"), JSON.stringify({
      titulo: "Produto", plataforma: "Amazon", precoAtual: 80,
      urlAfiliado: "https://amazon.com.br.evil.example/dp/123"
    }));
    const res = await consultarRevisaoTecnica(raiz);
    assert.equal(res.fichas[0].link, null);
    assert.equal(res.resumo.enviosConfirmados, null);
    assert.ok(res.avisos.length > 0);
  } finally { await rm(raiz, { recursive: true, force: true }); }
});