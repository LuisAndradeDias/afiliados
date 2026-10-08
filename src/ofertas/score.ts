import type { Oferta } from "../fontes/types.js";
import { bonusComissao } from "./comissoes-amazon.js";
import { economiaRealOferta, produtoPrioritario } from "./qualidade.js";

export function calcularScorePromocao(oferta: Oferta): number {
  const desconto =
    oferta.descontoEfetivoPercentual ??
    oferta.descontoPercentual ??
    0;
  const economia = economiaRealOferta(oferta);
  let score = 0;

  if (desconto >= 20) score += 20;
  if (desconto >= 30) score += 15;
  if (desconto >= 40) score += 15;
  if (oferta.cupom) score += 6;
  if (oferta.precoAnterior && economia > 0) score += 10;
  if (economia >= 35) score += 7;
  if (economia >= 70) score += 8;
  if (economia >= 150) score += 9;
  if (economia >= 350) score += 10;

  return Math.min(score, 100);
}

export function calcularScore(oferta: Oferta): number {
  const promocao = calcularScorePromocao(oferta);
  const comissao = oferta.comissaoEstimadaPercentual ?? 7;
  const economia = economiaRealOferta(oferta);
  const bonusRelevancia = produtoPrioritario(oferta) ? 23 : 0;
  const bonusEconomia =
    economia >= 350 ? 26 :
    economia >= 150 ? 21 :
    economia >= 70 ? 14 :
    economia >= 35 ? 8 : 0;
  // Comissao e criterio secundario: a economia do seguidor vem primeiro.
  const bonusComissaoLimitado = Math.min(8, Math.round(bonusComissao(comissao) / 6));

  return Math.min(
    100,
    Math.round(promocao * 0.62 + bonusRelevancia + bonusEconomia + bonusComissaoLimitado)
  );
}
