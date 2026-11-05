/**
 * Regras TÉCNICAS de qualidade da busca Mercado Livre, sem mudar regras comerciais.
 * Somente publicação nova, com estoque confirmado e vendedor identificável.
 */
export interface PublicacaoCandidata {
  item_id: string;
  seller_id: number;
  price: number;
  original_price?: number | null;
  condition?: string;
  available_quantity?: number | null;
}

export function descontoDoAnuncio(
  preco: number,
  original?: number | null
): number {
  if (!Number.isFinite(preco) || preco <= 0 ||
      !Number.isFinite(original) || !original || original <= preco) return 0;
  return Math.round((1 - preco / original) * 100);
}

export function publicacaoComEstoque(publicacao: PublicacaoCandidata): boolean {
  return /^MLB\d+$/i.test(publicacao.item_id) &&
    Number.isInteger(publicacao.seller_id) && publicacao.seller_id > 0 &&
    Number.isFinite(publicacao.price) && publicacao.price > 0 &&
    publicacao.condition === "new" &&
    Number.isInteger(publicacao.available_quantity) &&
    Number(publicacao.available_quantity) > 0;
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
