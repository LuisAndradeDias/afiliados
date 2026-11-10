import assert from "node:assert/strict";
import test from "node:test";
import { HistoricoMeliFicticio, type CotacaoFicticia } from "../src/fontes/mercadolivre/historico-ficticio.js";

const base: CotacaoFicticia = {
  fonte: "fixture", siteId: "MLB", itemId: "MLB123456789",
  vendedorId: "111", varianteId: "principal", pagamento: "pix",
  tipoPreco: "atual", moeda: "BRL", centavos: 12000,
  capturadoEm: "2026-11-01T10:00:00Z", disponibilidade: "indeterminada"
};
const contexto = (c: CotacaoFicticia) => ({
  fonte: c.fonte, siteId: c.siteId, itemId: c.itemId, vendedorId: c.vendedorId,
  varianteId: c.varianteId, pagamento: c.pagamento, tipoPreco: c.tipoPreco, moeda: c.moeda
});
test("registro idempotente e min/max/mediana por tres dias distintos", () => {
  const h = new HistoricoMeliFicticio();
  try {
    assert.equal(h.registrar(base), true);
    assert.equal(h.registrar(base), false);
    assert.equal(h.resumir(contexto(base), "2026-11-05T12:00:00Z")?.alertaPrecoBaixoHabilitado, false);
    h.registrar({...base, centavos: 10000, capturadoEm: "2026-11-02T10:00:00Z"});
    h.registrar({...base, centavos: 8000, capturadoEm: "2026-11-03T10:00:00Z"});
    assert.deepEqual(h.resumir(contexto(base), "2026-11-05T12:00:00Z"), {
      amostras: 3, diasDistintos: 3, minimoCentavos: 8000, maximoCentavos: 12000,
      ultimoCentavos: 8000, mediana30dCentavos: 10000,
      primeiroEm: "2026-11-01T10:00:00.000Z", ultimoEm: "2026-11-03T10:00:00.000Z",
      alertaPrecoBaixoHabilitado: true
    });
  } finally {h.fechar();}
});
test("mesmo dia nao habilita alerta e separa vendedores, Pix e cartao", () => {
  const h = new HistoricoMeliFicticio();
  try {
    h.registrar(base);
    h.registrar({...base, centavos: 11000, capturadoEm: "2026-11-01T15:00:00Z"});
    h.registrar({...base, centavos: 15000, pagamento: "cartao"});
    h.registrar({...base, centavos: 7000, vendedorId: "222"});
    const r=h.resumir(contexto(base), "2026-11-02T00:00:00Z");
    assert.equal(r?.amostras, 2);
    assert.equal(r?.diasDistintos, 1);
    assert.equal(r?.alertaPrecoBaixoHabilitado, false);
    assert.equal(h.resumir(contexto({...base,pagamento:"cartao"}), "2026-11-02T00:00:00Z")?.minimoCentavos,15000);
    assert.equal(h.resumir(contexto({...base,vendedorId:"222"}), "2026-11-02T00:00:00Z")?.minimoCentavos,7000);
  } finally {h.fechar();}
});
test("rejeita valores incorretos e qualquer fonte nao ficticia", () => {
  const h = new HistoricoMeliFicticio();
  try {
    for (const c of [
      {...base, fonte: "api" as "fixture"},
      {...base, centavos: -1}, {...base, centavos: 0},
      {...base, itemId: "MLB_INVALID"}, {...base, vendedorId: ""},
      {...base, capturadoEm: "2026-02-30T00:00:00Z"}
    ]) assert.throws(() => h.registrar(c));
    assert.equal(h.resumir(contexto(base), "2026-11-03T00:00:00Z"), null);
  } finally {h.fechar();}
});
test("observacao nao altera disponibilidade ou autoriza publicacao", () => {
  const h = new HistoricoMeliFicticio();
  try {
    h.registrar({...base,disponibilidade:"indisponivel"});
    assert.deepEqual(Object.keys(h.resumir(contexto(base), "2026-11-04T00:00:00Z") ?? {}).includes("ofertaAprovada"),false);
  } finally {h.fechar();}
});
