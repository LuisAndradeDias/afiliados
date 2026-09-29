import { aplicarAfiliadoAmazon } from "../afiliados/amazon.js";
import { AmazonBrowserFonte } from "../fontes/amazon/browser.js";
import type { Oferta } from "../fontes/types.js";
import { calcularScore } from "../ofertas/score.js";
import { chaveOferta, chavesBloqueadas } from "../ofertas/historico.js";
import { lerIndiceRotacao, salvarIndiceRotacao } from "../ofertas/rotacao.js";


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
  bloqueadas: number;
  disponiveis: number;
  melhorDesconto: number;
  categoriaEscolhida?: string;
  consultasUsadas: string[];
  melhor?: Oferta;
}

export async function buscarMelhorOferta(): Promise<ResultadoBusca> {
  const consultas = (process.env.AMAZON_QUERIES ??
    process.env.AMAZON_QUERY ??
    "ofertas")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (consultas.length === 0) {
    throw new Error("Nenhuma consulta da Amazon foi configurada.");
  }

  const limite = Number(process.env.AMAZON_LIMIT ?? 20);
  const descontoMinimo = Number(process.env.MIN_DISCOUNT_PERCENT ?? 20);
  const tag = process.env.AMAZON_ASSOCIATE_TAG;
  const porId = new Map<string, Oferta>();

  const indiceInicial = await lerIndiceRotacao(consultas.length);
  const porRodada = Math.max(
    1,
    Math.min(
      consultas.length,
      Number(process.env.AMAZON_QUERIES_PER_RUN ?? 4)
    )
  );
  const consultasUsadas = Array.from(
    { length: porRodada },
    (_, offset) => consultas[(indiceInicial + offset) % consultas.length]
  );

  for (const consulta of consultasUsadas) {
    console.log(`Buscando Amazon: "${consulta}"`);
    const ofertas = await buscarAmazonComRetry(consulta, limite);

    for (const oferta of ofertas) {
      const categorizada = { ...oferta, categoria: consulta };
      const existente = porId.get(oferta.produtoId);
      if (!existente || oferta.precoAtual < existente.precoAtual) {
        porId.set(oferta.produtoId, categorizada);
      }
    }
  }

  const todas = [...porId.values()];
  const bloqueadasIds = await chavesBloqueadas();

  const elegiveis = todas
    .filter((oferta) => (oferta.descontoPercentual ?? 0) >= descontoMinimo)
    .map((oferta) => ({ oferta, score: calcularScore(oferta) }))
    .sort((a, b) => b.score - a.score);

  const disponiveis = elegiveis.filter(
    ({ oferta }) => !bloqueadasIds.has(chaveOferta(oferta))
  );

  let melhor: Oferta | undefined;
  let categoriaEscolhida: string | undefined;

  for (const consulta of consultasUsadas) {
    const candidato = disponiveis.find(
      ({ oferta }) => oferta.categoria === consulta
    );
    if (candidato) {
      melhor = candidato.oferta;
      categoriaEscolhida = consulta;
      break;
    }
  }

  if (!melhor) {
    melhor = disponiveis[0]?.oferta;
    categoriaEscolhida = melhor?.categoria;
  }

  const indiceEscolhido = categoriaEscolhida
    ? consultas.indexOf(categoriaEscolhida)
    : indiceInicial;
  await salvarIndiceRotacao(indiceEscolhido + 1, consultas.length);

  const melhorDesconto = Math.max(
    0,
    ...todas.map((oferta) => oferta.descontoPercentual ?? 0)
  );

  return {
    analisadas: todas.length,
    elegiveis: elegiveis.length,
    bloqueadas: elegiveis.length - disponiveis.length,
    disponiveis: disponiveis.length,
    melhorDesconto,
    categoriaEscolhida,
    consultasUsadas,
    melhor: melhor ? aplicarAfiliadoAmazon(melhor, tag) : undefined
  };
}
