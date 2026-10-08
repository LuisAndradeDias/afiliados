import { calcularDesconto, parsePrecoBR } from "./preco.js";

export interface CandidatoPrecoAmazon {
  texto: string;
  contexto?: string;
  riscado?: boolean;
  unidade?: boolean;
}

export interface PrecosAnuncioAmazon {
  precoAtual?: number;
  precoAnterior?: number;
  descontoPercentual?: number;
}

const PRECO_POR_MEDIDA =
  /(?:\/\s*(?:kg|quilo|g|grama|100\s*g|ml|100\s*ml|l|litro|unid(?:ade)?s?)\b|\bpor\s+(?:kg|quilo|100\s*g|100\s*ml|litro|unidade)\b|\bpre[cç]o\s+(?:por|unit[aá]rio)\b)/iu;

function precoPorMedida(candidato: CandidatoPrecoAmazon): boolean {
  return Boolean(
    candidato.unidade ||
      PRECO_POR_MEDIDA.test(candidato.texto) ||
      PRECO_POR_MEDIDA.test(candidato.contexto ?? "")
  );
}

function valorReal(candidato: CandidatoPrecoAmazon): number | undefined {
  if (precoPorMedida(candidato)) return undefined;
  const numero = parsePrecoBR(candidato.texto);
  return numero && numero > 0 ? numero : undefined;
}

function referenciaConfirmada(candidato: CandidatoPrecoAmazon): boolean {
  if (candidato.riscado) return true;
  return /(?:^|\s)(?:de:|pre[cç]o\s+anterior:|pre[cç]o\s+recomendado:)/iu.test(
    candidato.contexto ?? ""
  );
}

/**
 * Busca preços da UNIDADE do produto, nunca o preço proporcional a kg/litro.
 * Um preço anterior só é confiável com marcação de riscado/valor "De".
 * Não inventa desconto quando a referência não pode ser confirmada.
 */
export function extrairPrecosAnuncioAmazon(
  atuais: CandidatoPrecoAmazon[],
  anteriores: CandidatoPrecoAmazon[]
): PrecosAnuncioAmazon {
  const precoAtual = atuais
    .map(valorReal)
    .find((numero): numero is number => numero !== undefined);

  if (!precoAtual) return {};

  for (const candidato of anteriores) {
    if (!referenciaConfirmada(candidato)) continue;
    const precoAnterior = valorReal(candidato);
    if (!precoAnterior || precoAnterior <= precoAtual) continue;
    const descontoPercentual = calcularDesconto(precoAtual, precoAnterior);
    if (descontoPercentual === undefined) continue;
    return { precoAtual, precoAnterior, descontoPercentual };
  }

  return { precoAtual };
}
