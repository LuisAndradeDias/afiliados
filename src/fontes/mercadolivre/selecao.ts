/**
 * Regras TÉCNICAS de qualidade da busca Mercado Livre, sem mudar regras comerciais.
 * Produto novo e vendedor identificado. A falta da quantidade pública NÃO
 * significa estoque esgotado; somente indícios explícitos bloqueiam a oferta.
 */
export interface PublicacaoCandidata {
  item_id: string;
  seller_id: number;
  price: number;
  original_price?: number | null;
  condition?: string;
  available_quantity?: number | null;
  title?: string;
  message?: string;
  status?: string;
  sub_status?: string[];
}

/** Mensagens explícitas do anúncio. O texto é informação, não prova de estoque. */
export function textoDeIndisponibilidade(texto: unknown): boolean {
  if (typeof texto !== "string") return false;
  const normalizado = texto
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return /\b(?:estoque (?:esgotad[oa]s?|indisponivel)|sem estoque|fora de estoque|produto[s]? indisponive(?:l|is)|produto[s]? esgotad[oa]s?|oferta[s]? indisponive(?:l|is)|oferta[s]? esgotad[oa]s?|item indisponivel|anuncio indisponivel|indisponivel para compra|nao disponivel|out of stock|sold out)\b/.test(normalizado);
}

/**
 * null/undefined significa estoque NÃO INFORMADO pela API pública.
 * Zero (ou negativo) é indisponibilidade explicitamente reportada.
 */
export function estoqueEsgotadoReportado(quantidade: number | null | undefined): boolean {
  return typeof quantidade === "number" &&
    Number.isFinite(quantidade) && quantidade <= 0;
}

export function descontoDoAnuncio(
  preco: number,
  original?: number | null
): number {
  if (!Number.isFinite(preco) || preco <= 0 ||
      !Number.isFinite(original) || !original || original <= preco) return 0;
  return Math.round((1 - preco / original) * 100);
}

/**
 * Compatibilidade com o seletor da API: "com estoque" aqui significa
 * "sem evidência de esgotamento". Não afirma disponibilidade confirmada.
 */
export function publicacaoComEstoque(publicacao: PublicacaoCandidata): boolean {
  return /^MLB\d+$/i.test(publicacao.item_id) &&
    Number.isInteger(publicacao.seller_id) && publicacao.seller_id > 0 &&
    Number.isFinite(publicacao.price) && publicacao.price > 0 &&
    publicacao.condition === "new" &&
    !estoqueEsgotadoReportado(publicacao.available_quantity) &&
    !textoDeIndisponibilidade(publicacao.title) &&
    !textoDeIndisponibilidade(publicacao.message) &&
    !textoDeIndisponibilidade(publicacao.status) &&
    !(publicacao.sub_status || []).some(textoDeIndisponibilidade);
}

export interface ResumoTriagemPublicacoes {
  total: number;
  tecnicamenteValidas: number;
  estoqueNaoInformado: number;
  esgotadasExplicitamente: number;
  mensagensIndisponibilidade: number;
  condicaoNaoNova: number;
  vendedoresInvalidos: number;
  precosInvalidos: number;
  identificadoresInvalidos: number;
}

/**
 * Diagnóstico somente leitura. Contagens de motivo podem se sobrepor:
 * a mesma publicação pode apresentar mais de um problema.
 * Estoque ausente não significa indisponibilidade nem confirmação de compra.
 */
export function resumirPublicacoes(
  publicacoes: PublicacaoCandidata[]
): ResumoTriagemPublicacoes {
  const resumo: ResumoTriagemPublicacoes = {
    total: 0, tecnicamenteValidas: 0, estoqueNaoInformado: 0,
    esgotadasExplicitamente: 0, mensagensIndisponibilidade: 0,
    condicaoNaoNova: 0, vendedoresInvalidos: 0, precosInvalidos: 0,
    identificadoresInvalidos: 0
  };
  for (const item of publicacoes) {
    resumo.total += 1;
    if (item.available_quantity == null) resumo.estoqueNaoInformado += 1;
    if (estoqueEsgotadoReportado(item.available_quantity)) {
      resumo.esgotadasExplicitamente += 1;
    }
    if ([item.title, item.message, item.status, ...(item.sub_status || [])]
      .some(textoDeIndisponibilidade)) {
      resumo.mensagensIndisponibilidade += 1;
    }
    if (item.condition !== "new") resumo.condicaoNaoNova += 1;
    if (!Number.isInteger(item.seller_id) || item.seller_id <= 0) {
      resumo.vendedoresInvalidos += 1;
    }
    if (!Number.isFinite(item.price) || item.price <= 0) {
      resumo.precosInvalidos += 1;
    }
    if (!/^MLB\d+$/i.test(item.item_id)) resumo.identificadoresInvalidos += 1;
    if (publicacaoComEstoque(item)) resumo.tecnicamenteValidas += 1;
  }
  return resumo;
}

export function ordenarPublicacoes(
  publicacoes: PublicacaoCandidata[]
): PublicacaoCandidata[] {
  return publicacoes
    .filter(publicacaoComEstoque)
    .sort((a, b) => descontoDoAnuncio(b.price, b.original_price) -
      descontoDoAnuncio(a.price, a.original_price) ||
      a.price - b.price);
}

export function validarPermalinkOficial(
  link: unknown,
  itemId: string
): string | null {
  if (typeof link !== "string" || !/^MLB\d+$/i.test(itemId)) return null;
  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase();
    const permitido = host === "mercadolivre.com.br" ||
      host.endsWith(".mercadolivre.com.br");
    const id = itemId.slice(3);
    const token = new RegExp("^/MLB-" + id + "(?=$|[-/_])", "i");
    if (url.protocol !== "https:" || !permitido || url.username ||
        url.password || url.port || !token.test(url.pathname)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function limiteInteiro(
  valor: string | undefined,
  padrao: number,
  minimo: number,
  maximo: number
): number {
  const numero = Number(valor);
  return valor !== undefined && Number.isInteger(numero)
    ? Math.max(minimo, Math.min(maximo, numero))
    : padrao;
}
