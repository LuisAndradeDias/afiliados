/**
 * MELI-13: armazenamento ADITIVO do preço geral de marketplace.
 *
 * Esquema ISOLADO da MELI-11: nao converte observacao em Pix/cartao,
 * nao atribui estoque nem libera ofertas/WhatsApp. Nenhuma rede.
 * Objetos de permissao exigem comprovacao humana externa; sua existencia
 * em codigo nao comprova liberacao do Mercado Livre.
 */
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { PrecoMarketplaceMeli12 } from "./mercadolivre-sale-price.js";

export interface PoliticaFonteMarketplace {
  registro: string;
  fonte: "mercadolivre_sale_price";
  escopo: "preco_geral_marketplace";
  verificadaPorResponsavel: true;
  aprovada: true;
  retencaoDias: number;
  validoAteUtc: string;
}
export interface PontoPrecoGeral {
  observadoEmUtc: string;
  referenciaOficialUtc: string;
  centavos: number;
  precoRegularCentavos: number | null;
  disponibilidade: "indeterminada";
  modalidadePagamento: "nao_informada";
  podePublicar: false;
  podeCompararComoDesconto: false;
}
export interface ItemPrecoGeral {
  chave: string;
  itemId: string;
  titulo: string;
  vendedorId: string;
  varianteId: string;
  contexto: "channel_marketplace";
  modalidadePagamento: "nao_informada";
  disponibilidade: "indeterminada";
  serie: PontoPrecoGeral[];
}
const DIA = 86_400_000;
const CHAVE = /^[A-Za-z0-9_-]{6,100}$/;
const ID = /^[A-Za-z0-9_-]{1,72}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const MAX_LOTE = 80;
const MAX_ITENS = 80;
const MAX_AMOSTRAS = 100;
function dataUtc(valor: string): string {
  if (typeof valor !== "string" || !UTC.test(valor)) throw Error("Data UTC invalida");
  const t = Date.parse(valor);
  if (!Number.isFinite(t) || t < Date.parse("2020-01-01T00:00:00Z")) {
    throw Error("Data UTC invalida");
  }
  const normal = new Date(t).toISOString();
  if (normal.slice(0, 19) !== valor.slice(0, 19)) throw Error("Data UTC impossivel");
  return normal;
}
function estruturaPolitica(p: PoliticaFonteMarketplace | null): p is PoliticaFonteMarketplace {
  return !!p && p.fonte === "mercadolivre_sale_price" &&
    p.escopo === "preco_geral_marketplace" &&
    p.aprovada === true && p.verificadaPorResponsavel === true &&
    CHAVE.test(p.registro) && Number.isSafeInteger(p.retencaoDias) &&
    p.retencaoDias >= 1 && p.retencaoDias <= 90 &&
    typeof p.validoAteUtc === "string";
}
function autorizar(
  p: PoliticaFonteMarketplace | null, agora: number
): asserts p is PoliticaFonteMarketplace {
  if (!estruturaPolitica(p)) throw Error("Fonte sem autorizacao documental");
  let validade: number;
  try { validade = Date.parse(dataUtc(p.validoAteUtc)); }
  catch { throw Error("Vigencia da autorizacao invalida"); }
  if (validade <= agora || validade > agora + 366 * DIA) {
    throw Error("Autorizacao expirada ou fora de vigencia");
  }
}
function validar(
  v: PrecoMarketplaceMeli12, agora: number, retencaoDias: number
): {observado: string; referencia: string} {
  if (!v || typeof v !== "object" ||
      !/^MLB\d{6,20}$/.test(v.itemId) ||
      typeof v.titulo !== "string" || !v.titulo.trim() ||
      v.titulo.length > 120 || /[\u0000-\u001f\u007f]/.test(v.titulo) ||
      !ID.test(v.vendedorId) || !ID.test(v.varianteId) ||
      v.contexto !== "channel_marketplace" || v.moeda !== "BRL" ||
      v.modalidadePagamento !== "nao_informada" ||
      v.disponibilidade !== "indeterminada" ||
      v.podePublicar !== false || v.podeCompararComoDesconto !== false ||
      v.proveniencia !== "resposta_sale_price_validada" ||
      !Number.isSafeInteger(v.centavos) || v.centavos <= 0 ||
      v.centavos > 100_000_000_000 ||
      !(v.precoRegularCentavos === null ||
        Number.isSafeInteger(v.precoRegularCentavos) && v.precoRegularCentavos > 0 &&
        v.precoRegularCentavos <= 100_000_000_000)) {
    throw Error("Amostra geral nao confiavel");
  }
  const observado = dataUtc(v.observadoEmUtc);
  const referencia = dataUtc(v.referenciaOficialUtc);
  const t = Date.parse(observado), r = Date.parse(referencia);
  if (t > agora + 60_000 || t < agora - retencaoDias * DIA ||
      r > t + 60_000 || t - r > 48 * 3_600_000) {
    throw Error("Amostra fora da janela autorizada");
  }
  return {observado, referencia};
}
function digest(v: PrecoMarketplaceMeli12, observado: string, registro: string): string {
  return createHash("sha256").update(JSON.stringify([
    registro,v.itemId,v.vendedorId,v.varianteId,v.contexto,observado
  ])).digest("hex");
}

/**
 * Cria somente a tabela meli13_preco_geral em banco SQLite existente.
 * Nao modifica meli11_obs, historico de cupons ou tabelas anteriores.
 */
export class PrecoGeralMarketplaceStore {
  private readonly db: DatabaseSync;
  constructor(arquivo: string = ":memory:") {
    this.db = new DatabaseSync(arquivo);
    this.db.exec("PRAGMA busy_timeout=3000; PRAGMA foreign_keys=ON;");
    this.db.exec([
      "CREATE TABLE IF NOT EXISTS meli13_preco_geral(",
      "dedup TEXT PRIMARY KEY,",
      "item_id TEXT NOT NULL,titulo TEXT NOT NULL,",
      "vendedor TEXT NOT NULL,variante TEXT NOT NULL,",
      "contexto TEXT NOT NULL CHECK(contexto='channel_marketplace'),",
      "pagamento TEXT NOT NULL CHECK(pagamento='nao_informada'),",
      "disponibilidade TEXT NOT NULL CHECK(disponibilidade='indeterminada'),",
      "centavos INTEGER NOT NULL CHECK(centavos>0),",
      "regular_centavos INTEGER,",
      "referencia_utc TEXT NOT NULL,observado_utc TEXT NOT NULL,",
      "proveniencia TEXT NOT NULL CHECK(proveniencia='resposta_sale_price_validada'),",
      "fonte TEXT NOT NULL, registro TEXT NOT NULL);",
      "CREATE INDEX IF NOT EXISTS idx_meli13_item",
      "ON meli13_preco_geral(item_id,vendedor,variante,observado_utc);",
      "CREATE INDEX IF NOT EXISTS idx_meli13_tempo",
      "ON meli13_preco_geral(registro,observado_utc);"
    ].join(" "));
  }
  registrar(
    lote: ReadonlyArray<PrecoMarketplaceMeli12>,
    politica: PoliticaFonteMarketplace | null,
    agoraIso = new Date().toISOString()
  ): {inseridas: number; repetidas: number} {
    const agora = Date.parse(dataUtc(agoraIso));
    autorizar(politica,agora);
    if (!Array.isArray(lote) || lote.length > MAX_LOTE) throw Error("Limite de lote excedido");
    // Valida TODAS antes da primeira insercao, inclusive inconsistencias semanticas.
    const revisadas = lote.map(v=>({v,...validar(v,agora,politica.retencaoDias)}));
    let inseridas=0,repetidas=0;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const buscar=this.db.prepare([
        "SELECT centavos,regular_centavos,referencia_utc,titulo,fonte,registro",
        "FROM meli13_preco_geral WHERE dedup=?"
      ].join(" "));
      const inserir=this.db.prepare([
        "INSERT INTO meli13_preco_geral (dedup,item_id,titulo,vendedor,variante,",
        "contexto,pagamento,disponibilidade,centavos,regular_centavos,",
        "referencia_utc,observado_utc,proveniencia,fonte,registro)",
        "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
      ].join(" "));
      for(const {v,observado,referencia} of revisadas){
        const hash=digest(v,observado,politica.registro);
        const anterior=buscar.get(hash) as {
          centavos:number;regular_centavos:number|null;referencia_utc:string;
          titulo:string;fonte:string;registro:string
        }|undefined;
        if (anterior) {
          if(anterior.centavos!==v.centavos ||
             anterior.regular_centavos!==v.precoRegularCentavos ||
             anterior.referencia_utc!==referencia ||
             anterior.titulo!==v.titulo.trim() ||
             anterior.fonte!==politica.fonte ||
             anterior.registro!==politica.registro) {
            throw Error("Cotacoes conflitantes: insercao recusada");
          }
          repetidas++;
          continue;
        }
        inserir.run(hash,v.itemId,v.titulo.trim(),v.vendedorId,v.varianteId,
          v.contexto,v.modalidadePagamento,v.disponibilidade,
          v.centavos,v.precoRegularCentavos,referencia,observado,
          v.proveniencia,politica.fonte,politica.registro);
        inseridas++;
      }
      this.db.exec("COMMIT");
      return {inseridas,repetidas};
    } catch(e) { this.db.exec("ROLLBACK");throw e; }
  }
  /** A consulta nunca aceita licenca vencida; dados de outra licenca ficam invisiveis. */
  consultar(
    politica: PoliticaFonteMarketplace | null, agoraIso=new Date().toISOString()
  ): ItemPrecoGeral[] {
    const agora=Date.parse(dataUtc(agoraIso));
    try { autorizar(politica,agora); } catch { return []; }
    const corte=new Date(agora-politica.retencaoDias*DIA).toISOString();
    const rows=this.db.prepare([
      "SELECT item_id,titulo,vendedor,variante,centavos,regular_centavos,",
      "referencia_utc,observado_utc FROM meli13_preco_geral",
      "WHERE registro=? AND fonte=? AND observado_utc>=? AND observado_utc<=?",
      "ORDER BY observado_utc DESC,item_id ASC LIMIT 8000"
    ].join(" ")).all(
      politica.registro,politica.fonte,corte,new Date(agora).toISOString()
    ) as Array<{item_id:string;titulo:string;vendedor:string;variante:string;
      centavos:number;regular_centavos:number|null;referencia_utc:string;observado_utc:string}>;
    const grupos=new Map<string,ItemPrecoGeral>();
    for(const r of rows){
      const id=[r.item_id,r.vendedor,r.variante].join("|");
      let grupo=grupos.get(id);
      if(!grupo){
        if(grupos.size>=MAX_ITENS)continue;
        grupo={chave:id,itemId:r.item_id,titulo:r.titulo,
          vendedorId:r.vendedor,varianteId:r.variante,
          contexto:"channel_marketplace",modalidadePagamento:"nao_informada",
          disponibilidade:"indeterminada",serie:[]};
        grupos.set(id,grupo);
      }
      if(grupo.serie.length>=MAX_AMOSTRAS)continue;
      grupo.serie.push({observadoEmUtc:r.observado_utc,
        referenciaOficialUtc:r.referencia_utc,centavos:r.centavos,
        precoRegularCentavos:r.regular_centavos,
        disponibilidade:"indeterminada",modalidadePagamento:"nao_informada",
        podePublicar:false,podeCompararComoDesconto:false});
    }
    return [...grupos.values()].map(g=>({...g,serie:g.serie.reverse()}));
  }
  /** Retencao funciona independentemente de licenca ainda vigente. */
  expurgarRetencao(
    politica: PoliticaFonteMarketplace, agoraIso=new Date().toISOString()
  ): number {
    if(!estruturaPolitica(politica)) throw Error("Politica de retencao invalida");
    const corte=new Date(Date.parse(dataUtc(agoraIso))-politica.retencaoDias*DIA).toISOString();
    return Number(this.db.prepare(
      "DELETE FROM meli13_preco_geral WHERE registro=? AND observado_utc<?"
    ).run(politica.registro,corte).changes);
  }
  /** Revogacao: remove definitivamente o acervo daquela concessao. */
  revogarRegistro(registro:string):number {
    if(!CHAVE.test(registro)) throw Error("Registro de fonte invalido");
    return Number(this.db.prepare(
      "DELETE FROM meli13_preco_geral WHERE registro=?"
    ).run(registro).changes);
  }
  contar():number {
    return Number((this.db.prepare(
      "SELECT COUNT(*) AS n FROM meli13_preco_geral"
    ).get() as {n:number}).n);
  }
  fechar():void { this.db.close(); }
}
