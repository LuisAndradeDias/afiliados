import type { Oferta } from "../fontes/types.js";

/**
 * Unified coupon policy for Mercado Livre, Amazon and future Shopee.
 * Discovering a generic code is not proof it applies to a given product.
 * A valid coupon for public promotion requires fresh, product-specific proof
 * at checkout (without executing a purchase).
 */
export type SituacaoCupom = "ausente" | "condicionado" | "confirmado" | "nao-verificado";
const CONFIRMACAO_MAX_MS = 10 * 60_000;

export interface AvaliacaoCupom {
  situacao: SituacaoCupom;
  motivo: string;
  podeAnunciar: boolean;
}

type OfertaCupom = Pick<Oferta,
  "produtoId" | "anuncioId" | "precoAtual" |
  "cupomCodigo" | "cupomValidacao" | "cupomConfirmadoEm" |
  "cupomProdutoIdConfirmado" | "cupomAnuncioIdConfirmado" |
  "cupomFonteConfirmacao" | "cupomValidoAte" | "cupomColetadoEm" |
  "precoComCupomEstimado"
>;

function instante(valor: string | undefined): number {
  if (!valor) return Number.NaN;
  const time = Date.parse(valor);
  return Number.isFinite(time) ? time : Number.NaN;
}

export function avaliarCupomParaDivulgacao(
  oferta: OfertaCupom,
  agora = Date.now()
): AvaliacaoCupom {
  const retorno = (situacao: SituacaoCupom, motivo: string): AvaliacaoCupom => ({
    situacao, motivo, podeAnunciar: situacao === "confirmado"
  });
  if (!oferta.cupomCodigo) return retorno("ausente", "sem cupom");
  if (!/^[A-Z0-9][A-Z0-9_-]{3,29}$/i.test(oferta.cupomCodigo)) {
    return retorno("nao-verificado", "codigo fora do formato aceito");
  }

  const validade = instante(oferta.cupomValidoAte);
  if (Number.isFinite(validade) && agora > validade) {
    return retorno("nao-verificado", "cupom expirado");
  }

  if (oferta.cupomValidacao !== "produto-confirmado") {
    const coleta = instante(oferta.cupomColetadoEm);
    const recente = Number.isFinite(coleta) &&
      agora >= coleta && agora - coleta <= 30 * 60_000;
    if (oferta.cupomValidacao === "catalogo-oficial-estimado" && recente &&
        Number.isFinite(validade) && agora <= validade) {
      return retorno("condicionado", "codigo observado na campanha; aplicabilidade ao produto desconhecida");
    }
    return retorno("nao-verificado", "sem confirmacao recente do cupom");
  }

  const confirmado = instante(oferta.cupomConfirmadoEm);
  const recente = Number.isFinite(confirmado) &&
    agora >= confirmado && agora - confirmado <= CONFIRMACAO_MAX_MS;
  if (!recente) {
    return retorno("nao-verificado", "confirmacao do produto ausente ou vencida");
  }
  if (oferta.cupomFonteConfirmacao !== "checkout") {
    return retorno("nao-verificado", "beneficio nao foi comprovado no checkout");
  }
  if (!oferta.produtoId || oferta.cupomProdutoIdConfirmado !== oferta.produtoId) {
    return retorno("nao-verificado", "cupom confirmado para outro produto");
  }
  if (oferta.anuncioId && oferta.cupomAnuncioIdConfirmado !== oferta.anuncioId) {
    return retorno("nao-verificado", "cupom confirmado para outro anuncio");
  }
  const estimado = oferta.precoComCupomEstimado;
  if (!Number.isFinite(oferta.precoAtual) ||
      !Number.isFinite(estimado) || !estimado ||
      estimado <= 0 || estimado >= oferta.precoAtual) {
    return retorno("nao-verificado", "preco final com desconto nao comprovado");
  }
  return retorno("confirmado", "desconto do produto confirmado recentemente no checkout");
}

/** Remove all public-facing coupon fields, never changes base price/stock. */
export function removerCupomNaoConfirmado<T extends Oferta>(
  oferta: T,
  agora = Date.now()
): T {
  if (avaliarCupomParaDivulgacao(oferta, agora).podeAnunciar) return oferta;
  return {
    ...oferta,
    cupom: undefined,
    cupomCodigo: undefined,
    cupomPercentual: undefined,
    cupomValor: undefined,
    cupomCompraMinima: undefined,
    cupomDescontoMaximo: undefined,
    cupomValidoAte: undefined,
    cupomValidacao: undefined,
    cupomConfirmadoEm: undefined,
    cupomProdutoIdConfirmado: undefined,
    cupomAnuncioIdConfirmado: undefined,
    cupomFonteConfirmacao: undefined,
    cupomColetadoEm: undefined,
    precoComCupomEstimado: undefined,
    descontoEfetivoPercentual: oferta.descontoPercentual ?? 0
  };
}
