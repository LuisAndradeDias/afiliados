import type { Oferta } from "../fontes/types.js";

export function aplicarAfiliadoAmazon(
  oferta: Oferta,
  tag?: string
): Oferta {
  const associateTag = tag?.trim();
  if (!associateTag) return oferta;

  const url = new URL(oferta.urlProduto);
  url.searchParams.set("tag", associateTag);

  return {
    ...oferta,
    urlAfiliado: url.toString()
  };
}
