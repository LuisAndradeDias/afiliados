/**
 * MELI-10E: nucleo SQLite experimental, SOMENTE dados ficticios de testes.
 * Sem API, monitor, WhatsApp, painel ou importacao de dados operacionais.
 * Nenhum dado pode ser registrado como oferta aprovada por este modulo.
 */
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export interface CotacaoFicticia {
  fonte: "fixture";
  siteId: "MLB";
  itemId: string;
  vendedorId: string;
  varianteId: string;
  pagamento: "pix" | "cartao" | "outro";
  tipoPreco: "atual";
  moeda: "BRL";
  centavos: number;
  capturadoEm: string;
  disponibilidade: "confirmada" | "indeterminada" | "indisponivel";
}

export interface ResumoPreco {
  amostras: number;
  diasDistintos: number;
  minimoCentavos: number;
  maximoCentavos: number;
  ultimoCentavos: number;
  mediana30dCentavos: number | null;
  primeiroEm: string;
  ultimoEm: string;
  alertaPrecoBaixoHabilitado: boolean;
}

function identidade(c: Omit<CotacaoFicticia, "centavos" | "capturadoEm" | "disponibilidade">): string {
  return [c.siteId, c.itemId, c.vendedorId, c.varianteId, c.pagamento, c.tipoPreco, c.moeda].join("|");
}

function validar(c: CotacaoFicticia): void {
  if (c.fonte !== "fixture" || c.siteId !== "MLB" || c.moeda !== "BRL" || c.tipoPreco !== "atual") {
    throw new Error("Fonte ou contexto sem autorizacao neste prototipo");
  }
  if (!/^MLB[0-9]+$/.test(c.itemId) ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(c.vendedorId) ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(c.varianteId)) {
    throw new Error("Identidade incompleta ou invalida");
  }
  if (!["pix", "cartao", "outro"].includes(c.pagamento) ||
    !["confirmada", "indeterminada", "indisponivel"].includes(c.disponibilidade) ||
    !Number.isSafeInteger(c.centavos) || c.centavos <= 0) {
    throw new Error("Cotacao ficticia invalida");
  }
  const ms = Date.parse(c.capturadoEm);
  const formato = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(c.capturadoEm);
  const data = Number.isFinite(ms) ? new Date(ms).toISOString() : "";
  if (!formato || !Number.isFinite(ms) ||
    data.slice(0, 19) !== c.capturadoEm.slice(0, 19) ||
    Number(c.capturadoEm.slice(0, 4)) < 2000) {
    throw new Error("Horario UTC invalido");
  }
}

export class HistoricoMeliFicticio {
  private readonly db: DatabaseSync;
  constructor(arquivo = ":memory:") {
    this.db = new DatabaseSync(arquivo);
    this.db.exec(`CREATE TABLE IF NOT EXISTS observacoes_ficticias (
      id TEXT PRIMARY KEY, identidade TEXT NOT NULL,
      capturado_em TEXT NOT NULL, centavos INTEGER NOT NULL CHECK(centavos > 0),
      disponibilidade TEXT NOT NULL, fonte TEXT NOT NULL CHECK(fonte = 'fixture')
    );
    CREATE INDEX IF NOT EXISTS idx_meli_fixture_identidade
      ON observacoes_ficticias(identidade, capturado_em);`);
  }

  registrar(c: CotacaoFicticia): boolean {
    validar(c);
    const chave = identidade(c);
    const instante = new Date(c.capturadoEm).toISOString();
    const id = createHash("sha256").update(JSON.stringify([chave, instante, c.centavos, c.disponibilidade, c.fonte])).digest("hex");
    const resultado = this.db.prepare(`INSERT OR IGNORE INTO observacoes_ficticias
      (id, identidade, capturado_em, centavos, disponibilidade, fonte)
      VALUES (?, ?, ?, ?, ?, 'fixture')`).run(id, chave, instante, c.centavos, c.disponibilidade);
    return resultado.changes === 1;
  }

  resumir(contexto: Omit<CotacaoFicticia, "centavos" | "capturadoEm" | "disponibilidade">,
    agoraIso: string): ResumoPreco | null {
    validar({ ...contexto, centavos: 1, capturadoEm: "2026-01-01T00:00:00Z", disponibilidade: "indeterminada" });
    const agora = Date.parse(agoraIso);
    if (!Number.isFinite(agora)) throw new Error("Data de referencia invalida");
    const rows = this.db.prepare(`SELECT centavos, capturado_em AS instante
      FROM observacoes_ficticias WHERE identidade = ? AND capturado_em <= ?
      ORDER BY capturado_em ASC, id ASC`).all(identidade(contexto), new Date(agora).toISOString()) as
      Array<{ centavos: number; instante: string }>;
    if (!rows.length) return null;
    const ultimos30 = rows.filter(r => Date.parse(r.instante) >= agora - 30 * 86400000)
      .map(r => r.centavos).sort((a, b) => a - b);
    const meio = Math.floor(ultimos30.length / 2);
    const mediana = ultimos30.length === 0 ? null : ultimos30.length % 2
      ? ultimos30[meio] : (ultimos30[meio - 1] + ultimos30[meio]) / 2;
    const dias = new Set(rows.map(r => r.instante.slice(0, 10))).size;
    return {
      amostras: rows.length,
      diasDistintos: dias,
      minimoCentavos: Math.min(...rows.map(r => r.centavos)),
      maximoCentavos: Math.max(...rows.map(r => r.centavos)),
      ultimoCentavos: rows[rows.length - 1].centavos,
      mediana30dCentavos: mediana,
      primeiroEm: rows[0].instante,
      ultimoEm: rows[rows.length - 1].instante,
      alertaPrecoBaixoHabilitado: dias >= 3
    };
  }
  fechar(): void { this.db.close(); }
}
