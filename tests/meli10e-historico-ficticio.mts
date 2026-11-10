import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { HistoricoMeliFicticio, type CotacaoFicticia } from "../src/fontes/mercadolivre/historico-ficticio.js";

const base: CotacaoFicticia = {
  fonte: "fixture", siteId: "MLB", itemId: "MLB123456789",
  vendedorId: "111", varianteId: "principal", pagamento: "pix",
  tipoPreco: "atual", moeda: "BRL", centavos: 12000,
  capturadoEm: "2026-11-01T10:00:00Z", disponibilidade: "confirmada"
};
const contexto = (c: CotacaoFicticia) => ({
  fonte: c.fonte, siteId: c.siteId, itemId: c.itemId, vendedorId: c.vendedorId,
  varianteId: c.varianteId, pagamento: c.pagamento, tipoPreco: c.tipoPreco, moeda: c.moeda
});

test("registro idempotente, estatisticas confirmadas e tres dias distintos", () => {
  const h = new HistoricoMeliFicticio();
  try {
    assert.equal(h.registrar(base), true);
    assert.equal(h.registrar(base), false);
    assert.equal(h.resumir(contexto(base), "2026-11-01T11:00:00Z")?.alertaPrecoBaixoHabilitado, false);
    h.registrar({...base, centavos: 10000, capturadoEm: "2026-11-02T10:00:00Z"});
    h.registrar({...base, centavos: 8000, capturadoEm: "2026-11-03T10:00:00Z"});
    assert.deepEqual(h.resumir(contexto(base), "2026-11-03T12:00:00Z"), {
      amostras: 3, observacoesNaoConfirmadas: 0, diasDistintos: 3,
      minimoCentavos: 8000, maximoCentavos: 12000,
      ultimoCentavos: 8000, mediana30dCentavos: 10000,
      primeiroEm: "2026-11-01T10:00:00.000Z",
      ultimoEm: "2026-11-03T10:00:00.000Z",
      ultimoRegistroEm: "2026-11-03T10:00:00.000Z",
      ultimaDisponibilidade: "confirmada",
      alertaPrecoBaixoHabilitado: true
    });
    assert.equal(h.resumir(contexto(base), "2026-11-05T12:00:00Z")?.alertaPrecoBaixoHabilitado, false,
      "historico antigo nao aprova comparacao recente");
  } finally { h.fechar(); }
});

test("indeterminada e indisponivel nao entram em referencia de preco, nem liberam alerta", () => {
  const h = new HistoricoMeliFicticio();
  try {
    h.registrar({...base, disponibilidade: "indeterminada", centavos: 500});
    h.registrar({...base, disponibilidade: "indisponivel", centavos: 200,
      capturadoEm: "2026-11-02T10:00:00Z"});
    let r = h.resumir(contexto(base), "2026-11-02T12:00:00Z");
    assert.equal(r?.amostras, 0);
    assert.equal(r?.observacoesNaoConfirmadas, 2);
    assert.equal(r?.minimoCentavos, null);
    assert.equal(r?.ultimoCentavos, null);
    assert.equal(r?.mediana30dCentavos, null);
    assert.equal(r?.alertaPrecoBaixoHabilitado, false);
    h.registrar({...base, centavos: 12000, capturadoEm: "2026-11-03T10:00:00Z"});
    h.registrar({...base, centavos: 11000, capturadoEm: "2026-11-04T10:00:00Z"});
    h.registrar({...base, centavos: 10000, capturadoEm: "2026-11-05T10:00:00Z"});
    r = h.resumir(contexto(base), "2026-11-05T11:00:00Z");
    assert.equal(r?.amostras, 3);
    assert.equal(r?.minimoCentavos, 10000);
    assert.equal(r?.mediana30dCentavos, 11000);
    assert.equal(r?.alertaPrecoBaixoHabilitado, true);
    // Uma observacao posterior sem estoque confirmado bloqueia o indicador.
    h.registrar({...base, disponibilidade: "indeterminada", centavos: 500,
      capturadoEm: "2026-11-05T12:00:00Z"});
    r = h.resumir(contexto(base), "2026-11-05T13:00:00Z");
    assert.equal(r?.ultimoCentavos, null);
    assert.equal(r?.ultimaDisponibilidade, "indeterminada");
    assert.equal(r?.alertaPrecoBaixoHabilitado, false);
    assert.equal(r?.minimoCentavos, 10000, "observacao incerta nao altera minimo");
  } finally { h.fechar(); }
});

test("nao confunde vendedores, variantes, Pix e cartao; mesma data nao basta", () => {
  const h = new HistoricoMeliFicticio();
  try {
    h.registrar(base);
    h.registrar({...base, centavos: 11000, capturadoEm: "2026-11-01T15:00:00Z"});
    h.registrar({...base, centavos: 15000, pagamento: "cartao"});
    h.registrar({...base, centavos: 7000, vendedorId: "222"});
    h.registrar({...base, centavos: 6000, varianteId: "outra"});
    const r = h.resumir(contexto(base), "2026-11-02T00:00:00Z");
    assert.equal(r?.amostras, 2);
    assert.equal(r?.diasDistintos, 1);
    assert.equal(r?.alertaPrecoBaixoHabilitado, false);
    assert.equal(h.resumir(contexto({...base,pagamento:"cartao"}), "2026-11-02T00:00:00Z")?.minimoCentavos, 15000);
    assert.equal(h.resumir(contexto({...base,vendedorId:"222"}), "2026-11-02T00:00:00Z")?.minimoCentavos, 7000);
    assert.equal(h.resumir(contexto({...base,varianteId:"outra"}), "2026-11-02T00:00:00Z")?.minimoCentavos, 6000);
  } finally { h.fechar(); }
});

test("nao substitui preco/estado divergente no mesmo produto e instante", () => {
  const h = new HistoricoMeliFicticio();
  try {
    assert.equal(h.registrar(base), true);
    assert.equal(h.registrar({...base, capturadoEm: "2026-11-01T10:00:00.000Z"}), false);
    assert.throws(() => h.registrar({...base, centavos: 1}), /conflitantes/);
    assert.throws(() => h.registrar({...base, disponibilidade: "indisponivel"}), /conflitantes/);
    assert.equal(h.resumir(contexto(base), "2026-11-02T00:00:00Z")?.amostras, 1);
  } finally { h.fechar(); }
});

test("persistencia real em arquivo temporario e deduplicacao apos reabertura", async () => {
  const dir = await mkdtemp(join(tmpdir(), "meli10e-fixture-"));
  const arquivo = join(dir, "historico-ficticio.sqlite");
  try {
    const h1 = new HistoricoMeliFicticio(arquivo);
    try { assert.equal(h1.registrar(base), true); } finally { h1.fechar(); }
    const h2 = new HistoricoMeliFicticio(arquivo);
    try {
      assert.equal(h2.registrar(base), false);
      assert.throws(() => h2.registrar({...base, centavos: 999}), /conflitantes/);
      assert.equal(h2.resumir(contexto(base), "2026-11-02T00:00:00Z")?.amostras, 1);
    } finally { h2.fechar(); }
  } finally { await rm(dir, {recursive: true, force: true}); }
});

test("falha fechada para datas invalidas/futuras, fontes reais e valores incorretos", () => {
  const h = new HistoricoMeliFicticio();
  try {
    for (const c of [
      {...base, fonte: "api" as "fixture"},
      {...base, centavos: -1}, {...base, centavos: 0}, {...base, centavos: 1.4},
      {...base, itemId: "MLB_INVALID"}, {...base, vendedorId: ""},
      {...base, capturadoEm: "2026-02-30T00:00:00Z"},
      {...base, capturadoEm: "2026-11-06T10:00:00Z"}
    ]) assert.throws(() => h.registrar(c, "2026-11-05T00:00:00Z"));
    assert.equal(h.resumir(contexto(base), "2026-11-03T00:00:00Z"), null);
  } finally { h.fechar(); }
});

test("historico nao gera oferta, compra, comissao ou autorizacao de envio", () => {
  const h = new HistoricoMeliFicticio();
  try {
    h.registrar({...base,disponibilidade:"indisponivel"});
    const resumo = h.resumir(contexto(base), "2026-11-04T00:00:00Z");
    assert.ok(resumo);
    assert.equal(resumo.alertaPrecoBaixoHabilitado, false);
    for (const nome of ["ofertaAprovada", "envioPermitido", "linkAfiliado", "comissaoConfirmada"]) {
      assert.equal(Object.hasOwn(resumo, nome), false);
    }
  } finally { h.fechar(); }
});
