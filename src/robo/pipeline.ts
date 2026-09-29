import { aplicarAfiliadoAmazon } from "../afiliados/amazon.js";
import { AmazonBrowserFonte } from "../fontes/amazon/browser.js";
import type { Oferta } from "../fontes/types.js";
import { calcularScore } from "../ofertas/score.js";


async function buscarAmazonComRetry(
  consulta: string,
  limite: number
): Promise<Oferta[]> {
  let ultimoErro: unknown;

  for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
    try {
      return await new AmazonBrowserFonte(consulta, limite).buscar();
    } catch (error) {
      ultimoErro = error;
      const mensagem = error instanceof Error ? error.message : String(error);
      console.warn(`Amazon "${consulta}" falhou (${tentativa}/2): ${mensagem}`);
      if (tentativa < 2) {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }
  }

  console.warn(`Pulando "${consulta}" após duas falhas.`, ultimoErro);
  return [];
}

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
    const ofertas = await buscarAmazonComRetry(consulta, limite);

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
