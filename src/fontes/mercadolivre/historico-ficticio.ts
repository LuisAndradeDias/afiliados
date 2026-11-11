/**
 * MELI-10E: historico experimental EXCLUSIVAMENTE com observacoes ficticias.
 * Nao utiliza API, WhatsApp, monitor, painel ou dados reais.
 * Comparacao historica habilitada nao significa oferta, desconto ou envio aprovado.
 */
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export type DisponibilidadeFicticia = "confirmada" | "indeterminada" | "indisponivel";
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
  disponibilidade: DisponibilidadeFicticia;
}

export interface ResumoPreco {
  /** Apenas observacoes com disponibilidade confirmada. */
  amostras: number;
  /** Observacoes armazenadas para auditoria, nunca usadas como base do preco. */
  observacoesNaoConfirmadas: number;
  /** Dias distintos de precos confirmados nos ultimos 30 dias. */
  diasDistintos: number;
  /** Referencias historicas confirmadas, nunca preco anunciado automaticamente. */
  minimoCentavos: number | null;
  maximoCentavos: number | null;
  /** Null quando o registro mais recente nao confirma disponibilidade. */
  ultimoCentavos: number | null;
  mediana30dCentavos: number | null;
  primeiroEm: string | null;
  ultimoEm: string | null;
  ultimoRegistroEm: string;
  ultimaDisponibilidade: DisponibilidadeFicticia;
  /** Sinal de que ha amostras para analisar, NAO sinal para publicar oferta. */
  alertaPrecoBaixoHabilitado: boolean;
}

type Contexto = Omit<CotacaoFicticia, "centavos" | "capturadoEm" | "disponibilidade">;
type Registro = { centavos: number; instante: string; disponibilidade: DisponibilidadeFicticia };
const DIA_MS = 86_400_000;
const JANELA_MS = 30 * DIA_MS;
const FRESCOR_MS = DIA_MS;

function identidade(c: Contexto): string {
  return [c.siteId, c.itemId, c.vendedorId, c.varianteId, c.pagamento, c.tipoPreco, c.moeda].join("|");
}

function instanteUtc(texto: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(texto)) {
    throw new Error("Horario UTC invalido");
  }
  const ms = Date.parse(texto);
  if (!Number.isFinite(ms) || ms < Date.parse("2000-01-01T00:00:00Z")) {
    throw new Error("Horario UTC invalido");
  }
  const normalizado = new Date(ms).toISOString();
  if (normalizado.slice(0, 19) !== texto.slice(0, 19)) {
    throw new Error("Data UTC impossivel");
  }
  return normalizado;
}

function validarContexto(c: Contexto): void {
  if (c.fonte !== "fixture" || c.siteId !== "MLB" || c.moeda !== "BRL" || c.tipoPreco !== "atual") {
    throw new Error("Fonte ou contexto sem autorizacao neste prototipo");
  }
  if (!/^MLB[0-9]+$/.test(c.itemId) ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(c.vendedorId) ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(c.varianteId) ||
    !["pix", "cartao", "outro"].includes(c.pagamento)) {
    throw new Error("Identidade comercial incompleta ou invalida");
  }
}

function validarCotacao(c: CotacaoFicticia): void {
  validarContexto(c);
  if (!Number.isSafeInteger(c.centavos) || c.centavos <= 0 ||
    !["confirmada", "indeterminada", "indisponivel"].includes(c.disponibilidade)) {
    throw new Error("Cotacao ficticia invalida");
  }
  instanteUtc(c.capturadoEm);
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
    CREATE UNIQUE INDEX IF NOT EXISTS idx_meli_fixture_identidade_momento
      ON observacoes_ficticias(identidade, capturado_em);`);
  }

  registrar(c: CotacaoFicticia, agoraIso = new Date().toISOString()): boolean {
    validarCotacao(c);
    const instante = instanteUtc(c.capturadoEm);
    const agora = instanteUtc(agoraIso);
    if (instante > agora) throw new Error("Observacao ficticia no futuro");
    const chave = identidade(c);
    // Chave de coleta: mesmo produto, vendedor, pagamento e instante.
    // Um segundo preco conflitante nunca substitui o primeiro.
    const id = createHash("sha256").update(JSON.stringify([chave, instante])).digest("hex");
    const existente = this.db.prepare(`SELECT centavos, disponibilidade
      FROM observacoes_ficticias WHERE id = ?`).get(id) as
      { centavos: number; disponibilidade: DisponibilidadeFicticia } | undefined;
    if (existente) {
      if (existente.centavos === c.centavos && existente.disponibilidade === c.disponibilidade) {
        return false;
      }
      throw new Error("Observacoes conflitantes no mesmo instante: nenhuma sobrescrita");
    }
    try {
      this.db.prepare(`INSERT INTO observacoes_ficticias
        (id, identidade, capturado_em, centavos, disponibilidade, fonte)
        VALUES (?, ?, ?, ?, ?, 'fixture')`)
        .run(id, chave, instante, c.centavos, c.disponibilidade);
    } catch (erro) {
      // Caso outra instancia tenha registrado a mesma amostra, confirme igualdade.
      const concorrente = this.db.prepare(`SELECT centavos, disponibilidade
        FROM observacoes_ficticias WHERE id = ?`).get(id) as
        { centavos: number; disponibilidade: DisponibilidadeFicticia } | undefined;
      if (concorrente && concorrente.centavos === c.centavos &&
        concorrente.disponibilidade === c.disponibilidade) return false;
      throw erro;
    }
    return true;
  }

  resumir(contexto: Contexto, agoraIso: string): ResumoPreco | null {
    validarContexto(contexto);
    const agora = instanteUtc(agoraIso);
    const agoraMs = Date.parse(agora);
    const registros = this.db.prepare(`SELECT centavos, capturado_em AS instante,
      disponibilidade FROM observacoes_ficticias
      WHERE identidade = ? AND capturado_em <= ?
      ORDER BY capturado_em ASC, id ASC`).all(identidade(contexto), agora) as Registro[];
    if (!registros.length) return null;

    const confirmados = registros.filter(r => r.disponibilidade === "confirmada");
    const janela = confirmados.filter(r => Date.parse(r.instante) >= agoraMs - JANELA_MS);
    const dias = new Set(janela.map(r => r.instante.slice(0, 10))).size;
    const valores30d = janela.map(r => r.centavos).sort((a, b) => a - b);
    const meio = Math.floor(valores30d.length / 2);
    const mediana = valores30d.length === 0 ? null :
      valores30d.length % 2 === 1 ? valores30d[meio] :
      (valores30d[meio - 1] + valores30d[meio]) / 2;

    const ultimo = registros[registros.length - 1];
    const ultimoConfirmado = confirmados[confirmados.length - 1];
    const referenciaFresca = agoraMs - Date.parse(ultimo.instante) <= FRESCOR_MS;
    return {
      amostras: confirmados.length,
      observacoesNaoConfirmadas: registros.length - confirmados.length,
      diasDistintos: dias,
      minimoCentavos: confirmados.length ? Math.min(...confirmados.map(r => r.centavos)) : null,
      maximoCentavos: confirmados.length ? Math.max(...confirmados.map(r => r.centavos)) : null,
      ultimoCentavos: ultimo.disponibilidade === "confirmada" ? ultimo.centavos : null,
      mediana30dCentavos: mediana,
      primeiroEm: confirmados[0]?.instante ?? null,
      ultimoEm: ultimoConfirmado?.instante ?? null,
      ultimoRegistroEm: ultimo.instante,
      ultimaDisponibilidade: ultimo.disponibilidade,
      alertaPrecoBaixoHabilitado: ultimo.disponibilidade === "confirmada" &&
        referenciaFresca && dias >= 3
    };
  }

  fechar(): void { this.db.close(); }
}
