import { aplicarAfiliadoAmazon } from "../afiliados/amazon.js";
import { AmazonBrowserFonte } from "../fontes/amazon/browser.js";
import type { Oferta } from "../fontes/types.js";
import { calcularScore } from "../ofertas/score.js";
import { avaliarQualidadeOferta } from "../ofertas/qualidade.js";
import { chaveOferta, chavesBloqueadas } from "../ofertas/historico.js";
import { lerIndiceRotacao, salvarIndiceRotacao } from "../ofertas/rotacao.js";
import {
  estimarComissaoAmazon,
  pesoBuscaPorComissao
} from "../ofertas/comissoes-amazon.js";



function criarFilaPonderada(consultas: string[]): string[] {
  const pesos = consultas.map((consulta) => ({
    consulta,
    peso: pesoBuscaPorComissao(estimarComissaoAmazon(consulta))
  }));
  const maiorPeso = Math.max(...pesos.map(({ peso }) => peso));
  const fila: string[] = [];

  for (let rodada = 0; rodada < maiorPeso; rodada += 1) {
    for (const item of pesos) {
      if (item.peso > rodada) fila.push(item.consulta);
    }
  }

  return fila;
}

function selecionarConsultas(
  fila: string[],
  indiceInicial: number,
  quantidade: number
): { consultas: string[]; proximoIndice: number } {
  const selecionadas: string[] = [];
  let passos = 0;

  while (selecionadas.length < quantidade && passos < fila.length) {
    const consulta = fila[(indiceInicial + passos) % fila.length];
    if (!selecionadas.includes(consulta)) selecionadas.push(consulta);
    passos += 1;
  }

  return {
    consultas: selecionadas,
    proximoIndice: (indiceInicial + Math.max(passos, 1)) % fila.length
  };
}

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
    "smartphone")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (consultas.length === 0) {
    throw new Error("Nenhuma consulta da Amazon foi configurada.");
  }

  const limite = Number(process.env.AMAZON_LIMIT ?? 20);
  const tag = process.env.AMAZON_ASSOCIATE_TAG;
  const porId = new Map<string, Oferta>();

  const filaPonderada = criarFilaPonderada(consultas);
  const indiceInicial = await lerIndiceRotacao(filaPonderada.length);
  const porRodada = Math.max(
    1,
    Math.min(
      consultas.length,
      Number(process.env.AMAZON_QUERIES_PER_RUN ?? 4)
    )
  );
  const selecao = selecionarConsultas(
    filaPonderada,
    indiceInicial,
    porRodada
  );
  const consultasUsadas = selecao.consultas;

  for (const consulta of consultasUsadas) {
    const comissao = estimarComissaoAmazon(consulta);
    console.log(
      `Buscando Amazon: "${consulta}" | comissão estimada ${comissao}%`
    );
    const ofertas = await buscarAmazonComRetry(consulta, limite);

    for (const oferta of ofertas) {
      const categorizada: Oferta = {
        ...oferta,
        categoria: consulta,
        comissaoEstimadaPercentual: comissao
      };
      categorizada.scoreOferta = calcularScore(categorizada);

      const existente = porId.get(oferta.produtoId);
      if (
        !existente ||
        (categorizada.scoreOferta ?? 0) > (existente.scoreOferta ?? 0)
      ) {
        porId.set(oferta.produtoId, categorizada);
      }
    }
  }

  const todas = [...porId.values()];
  const bloqueadasIds = await chavesBloqueadas();

  const elegiveis = todas
    .filter((oferta) => avaliarQualidadeOferta(oferta).elegivel)
    .map((oferta) => ({ oferta, score: calcularScore(oferta) }))
    .sort((a, b) => b.score - a.score);

  const disponiveis = elegiveis.filter(
    ({ oferta }) => !bloqueadasIds.has(chaveOferta(oferta))
  );

  const melhor = disponiveis[0]?.oferta;
  const categoriaEscolhida = melhor?.categoria;

  await salvarIndiceRotacao(
    selecao.proximoIndice,
    filaPonderada.length
  );

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
