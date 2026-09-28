import type { Oferta } from "../fontes/types.js";

export function calcularScore(oferta: Oferta): number {
  let score = 0;
  const desconto = oferta.descontoPercentual ?? 0;

  if (desconto >= 20) score += 20;
  if (desconto >= 30) score += 15;
  if (desconto >= 40) score += 15;
  if (oferta.cupom) score += 15;
  if (oferta.precoAnterior && oferta.precoAtual < oferta.precoAnterior) score += 15;

  return Math.min(score, 100);
}
