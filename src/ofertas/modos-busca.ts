import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  CONSULTAS_AMAZON_AUTORIZADAS,
  CONSULTAS_MERCADOLIVRE_AUTORIZADAS
} from "./regras-autorizadas.js";

export type ModoBusca = "media" | "longa";
export const MODO_BUSCA_PADRAO: ModoBusca = "media";

export function modoBuscaValido(valor: unknown): valor is ModoBusca {
  return valor === "media" || valor === "longa";
}

export function normalizarModoBusca(valor: unknown): ModoBusca {
  return modoBuscaValido(valor) ? valor : MODO_BUSCA_PADRAO;
}

/** Estado local isolado do .env: credenciais OAuth nunca são regravadas. */
export function lerModoBusca(caminho: string): ModoBusca {
  try {
    const valor = JSON.parse(readFileSync(caminho, "utf8")) as { modo?: unknown };
    return normalizarModoBusca(valor.modo);
  } catch {
    return MODO_BUSCA_PADRAO;
  }
}

export async function salvarModoBusca(caminho: string, modo: ModoBusca): Promise<void> {
  if (!modoBuscaValido(modo)) throw new Error("Perfil de busca inválido.");
  await mkdir(dirname(caminho), { recursive: true });
  const temporario = caminho + "." + randomBytes(6).toString("hex") + ".tmp";
  try {
    await writeFile(temporario, JSON.stringify({ modo }, null, 2) + "\n", {
      encoding: "utf8", mode: 0o600
    });
    await rename(temporario, caminho);
  } finally {
    await rm(temporario, { force: true });
  }
}

function inteiro(
  valor: string | undefined,
  padrao: number,
  minimo: number,
  maximo: number
): number {
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero >= minimo
    ? Math.min(maximo, numero)
    : padrao;
}

export interface OrcamentoBusca {
  amazonCategorias: number;
  amazonLimitePorCategoria: number;
  meliCategoriasIniciais: number;
  meliCategoriasExtrasSemOferta: number;
  meliItensPorPagina: number;
  meliPaginasPorCategoria: number;
  meliProdutosPorCategoria: number;
}

/**
 * A busca média mantém a configuração operacional existente.
 * A longa aumenta a profundidade, nunca o ritmo de envio ou a cadência do monitor.
 * Tetos preservam as restrições técnicas da fonte e as categorias autorizadas.
 */
export function orcamentoBusca(
  modo: ModoBusca,
  ambiente: NodeJS.ProcessEnv = process.env
): OrcamentoBusca {
  const amazonMaximo = CONSULTAS_AMAZON_AUTORIZADAS.length;
  const meliMaximo = CONSULTAS_MERCADOLIVRE_AUTORIZADAS.length;
  const media: OrcamentoBusca = {
    amazonCategorias: inteiro(ambiente.AMAZON_QUERIES_PER_RUN, 4, 1, amazonMaximo),
    amazonLimitePorCategoria: inteiro(ambiente.AMAZON_LIMIT, 20, 1, 60),
    meliCategoriasIniciais: inteiro(
      ambiente.MERCADOLIVRE_QUERIES_PER_RUN, 1, 1, meliMaximo
    ),
    meliCategoriasExtrasSemOferta: inteiro(
      ambiente.MERCADOLIVRE_EXTRA_QUERIES_ON_EMPTY, 2, 0, 2
    ),
    meliItensPorPagina: inteiro(ambiente.MERCADOLIVRE_LIMIT, 10, 1, 50),
    meliPaginasPorCategoria: inteiro(
      ambiente.MERCADOLIVRE_SEARCH_PAGES_PER_QUERY, 3, 1, 5
    ),
    meliProdutosPorCategoria: inteiro(
      ambiente.MERCADOLIVRE_PRODUCTS_CHECKED_PER_QUERY, 25, 5, 60
    )
  };
  if (modo === "media") return media;
  return {
    ...media,
    amazonCategorias: Math.min(amazonMaximo, media.amazonCategorias + 2),
    meliCategoriasIniciais: Math.min(meliMaximo, media.meliCategoriasIniciais + 1),
    meliPaginasPorCategoria: Math.min(5, media.meliPaginasPorCategoria + 2),
    meliProdutosPorCategoria: Math.min(60, media.meliProdutosPorCategoria + 15)
  };
}

/** Somente processos de pesquisa recebem estas variáveis; outras tarefas não mudam. */
export function variaveisBusca(
  modo: ModoBusca,
  ambiente: NodeJS.ProcessEnv = process.env
): Record<string, string> {
  if (modo === "media") return { BUSCA_MODO: modo };
  const plano = orcamentoBusca(modo, ambiente);
  return {
    BUSCA_MODO: modo,
    AMAZON_QUERIES_PER_RUN: String(plano.amazonCategorias),
    MERCADOLIVRE_QUERIES_PER_RUN: String(plano.meliCategoriasIniciais),
    MERCADOLIVRE_SEARCH_PAGES_PER_QUERY: String(plano.meliPaginasPorCategoria),
    MERCADOLIVRE_PRODUCTS_CHECKED_PER_QUERY: String(plano.meliProdutosPorCategoria)
  };
}
