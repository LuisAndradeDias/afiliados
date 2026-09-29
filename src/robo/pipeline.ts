import { aplicarAfiliadoAmazon } from "../afiliados/amazon.js";
import { AmazonBrowserFonte } from "../fontes/amazon/browser.js";
import type { Oferta } from "../fontes/types.js";
import { calcularScore } from "../ofertas/score.js";

export interface ResultadoBusca {
  analisadas: number;
  elegiveis: number;
  melhorDesconto: number;
  melhor?: Oferta;
}

export async function buscarMelhorOferta(): Promise<ResultadoBusca> {
  const consultas = (process.env.AMAZON_QUERIES ??
    process.env.AMAZON_QUERY ??
    "ofertas")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const limite = Number(process.env.AMAZON_LIMIT ?? 20);
  const descontoMinimo = Number(process.env.MIN_DISCOUNT_PERCENT ?? 20);
  const tag = process.env.AMAZON_ASSOCIATE_TAG;
  const porId = new Map<string, Oferta>();

  for (const consulta of consultas) {
    console.log(`Buscando Amazon: "${consulta}"`);
    const fonte = new AmazonBrowserFonte(consulta, limite);
    const ofertas = await fonte.buscar();

    for (const oferta of ofertas) {
      const existente = porId.get(oferta.produtoId);
      if (!existente || oferta.precoAtual < existente.precoAtual) {
        porId.set(oferta.produtoId, oferta);
      }
    }
  }

  const todas = [...porId.values()];
  const elegiveis = todas
    .filter((oferta) => (oferta.descontoPercentual ?? 0) >= descontoMinimo)
    .map((oferta) => ({ oferta, score: calcularScore(oferta) }))
    .sort((a, b) => b.score - a.score);

  const melhor = elegiveis[0]?.oferta;
  const melhorDesconto = Math.max(
    0,
    ...todas.map((oferta) => oferta.descontoPercentual ?? 0)
  );

  return {    analisadas: todas.length,
    elegiveis: elegiveis.length,
    melhorDesconto,
    melhor: melhor ? aplicarAfiliadoAmazon(melhor, tag) : undefined
  };
}
