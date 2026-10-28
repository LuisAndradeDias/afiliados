import {
  centavosBRL, publicacaoCandidataParaConfirmar,
  type DetalheCatalogoDisponibilidade,
  type PublicacaoCatalogoDisponibilidade
} from "./disponibilidade.js";

/**
 * Investigacao oficial somente leitura: nunca promove publicacoes da lista
 * para "buy box" na ausencia do campo buy_box_winner do catalogo.
 *
 * A documentacao da API distingue publicacoes listadas de concorrentes e
 * informa que buy_box_winner pode ser null sem publicacao competindo.
 */
export type MotivoInvestigacaoSemVencedor =
  | "CATALOGO_INCONSISTENTE"
  | "VENCEDOR_PRESENTE_NAO_APLICAVEL"
  | "NENHUMA_PUBLICACAO_OBSERVADA"
  | "PUBLICACOES_SEM_VENCEDOR"
  | "PUBLICACOES_DADOS_INCOMPLETOS"
  | "LISTAGEM_NAO_ENCONTRADA"
  | "LISTAGEM_SEM_PERMISSAO"
  | "LISTAGEM_LIMITE_429"
  | "LISTAGEM_HTTP_INDISPONIVEL"
  | "LISTAGEM_REDE_INDISPONIVEL"
  | "LISTAGEM_FORMATO_INVALIDO";

export interface InvestigacaoCatalogoSemVencedor {
  status: "pendente_revisao";
  motivo: MotivoInvestigacaoSemVencedor;
  /** Observados na lista recebida, nao total de anuncios do site. */
  publicacoesObservadas?: number;
  /** Com identificador, vendedor, preco em centavos, condicao e status validos. */
  candidatasComDadosMinimos?: number;
  /** Apenas quantidade declarada positiva: nao prova compra no PDP. */
  candidatasComEstoqueDeclarado?: number;
  amostraLimitada: boolean;
  /** Mesmo uma unica publicacao nao prova que ganha a pagina /p/. */
  vencedorConfirmado: false;
  precoConfirmado: false;
  estoqueNaPaginaConfirmado: false;
  modalidadePagamentoConfirmada: false;
  cupomAplicavelConfirmado: false;
  envioPermitido: false;
}

export interface OpcoesInvestigacaoSemVencedor {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const LIMITE_AMOSTRA = 60;

function resumo(
  motivo: MotivoInvestigacaoSemVencedor,
  observed?: {
    count: number;
    validCount: number;
    stockCount: number;
    limited: boolean;
  }
): InvestigacaoCatalogoSemVencedor {
  return {
    status: "pendente_revisao",
    motivo,
    ...(observed ? {
      publicacoesObservadas: observed.count,
      candidatasComDadosMinimos: observed.validCount,
      candidatasComEstoqueDeclarado: observed.stockCount
    } : {}),
    amostraLimitada: observed?.limited ?? false,
    vencedorConfirmado: false,
    precoConfirmado: false,
    estoqueNaPaginaConfirmado: false,
    modalidadePagamentoConfirmada: false,
    cupomAplicavelConfirmado: false,
    envioPermitido: false
  };
}

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function idValido(valor: unknown): valor is string {
  return typeof valor === "string" && /^MLB[0-9]{5,}$/.test(valor);
}

function estoquePositivo(valor: unknown): boolean {
  return typeof valor === "number" &&
    Number.isSafeInteger(valor) && valor > 0;
}

function dadosBasicos(item: PublicacaoCatalogoDisponibilidade): boolean {
  return publicacaoCandidataParaConfirmar(item) &&
    centavosBRL(item.price) !== undefined &&
    idValido(item.item_id);
}

/**
 * Na ausencia de buy box, consulta no maximo UMA vez o endpoint oficial
 * /products/{id}/items, com token ja autorizado. Zero retries; 429 para.
 * Nenhum ID de vendedor, item, link, cookie ou token e devolvido ou logado.
 */
export async function investigarCatalogoSemVencedor(
  produtoId: string,
  catalogo: DetalheCatalogoDisponibilidade,
  token: string,
  opcoes: OpcoesInvestigacaoSemVencedor = {}
): Promise<InvestigacaoCatalogoSemVencedor> {
  if (!idValido(produtoId) || catalogo?.id !== produtoId ||
      catalogo.status !== "active") {
    return resumo("CATALOGO_INCONSISTENTE");
  }
  if (catalogo.buy_box_winner) {
    return resumo("VENCEDOR_PRESENTE_NAO_APLICAVEL");
  }
  if (typeof token !== "string" || token.length < 2) {
    return resumo("LISTAGEM_SEM_PERMISSAO");
  }

  const timeoutMs = Math.max(1000, Math.min(10000, opcoes.timeoutMs ?? 8000));
  let response: Response;
  try {
    response = await (opcoes.fetchImpl ?? fetch)(
      "https://api.mercadolibre.com/products/" +
      encodeURIComponent(produtoId) + "/items",
      {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: "Bearer " + token
        },
        signal: AbortSignal.timeout(timeoutMs)
      }
    );
  } catch {
    return resumo("LISTAGEM_REDE_INDISPONIVEL");
  }
  if (response.status === 429) return resumo("LISTAGEM_LIMITE_429");
  if (response.status === 404) return resumo("LISTAGEM_NAO_ENCONTRADA");
  if (response.status === 401 || response.status === 403) {
    return resumo("LISTAGEM_SEM_PERMISSAO");
  }
  if (!response.ok) return resumo("LISTAGEM_HTTP_INDISPONIVEL");

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return resumo("LISTAGEM_FORMATO_INVALIDO");
  }
  if (!objeto(payload) || !Array.isArray(payload.results)) {
    return resumo("LISTAGEM_FORMATO_INVALIDO");
  }

  const entries: unknown[] = payload.results;
  const limited = entries.length > LIMITE_AMOSTRA;
  const sample = entries.slice(0, LIMITE_AMOSTRA);
  const ids = new Set<string>();
  let validCount = 0;
  let stockCount = 0;
  for (const entry of sample) {
    if (!objeto(entry)) continue;
    const item = entry as PublicacaoCatalogoDisponibilidade;
    if (!idValido(item.item_id) || ids.has(item.item_id)) continue;
    ids.add(item.item_id);
    if (dadosBasicos(item)) {
      validCount += 1;
      if (estoquePositivo(item.available_quantity)) stockCount += 1;
    }
  }
  const observed = {
    count: ids.size,
    validCount,
    stockCount,
    limited
  };

  if (entries.length === 0) {
    return resumo("NENHUMA_PUBLICACAO_OBSERVADA", observed);
  }
  if (validCount === 0) {
    return resumo("PUBLICACOES_DADOS_INCOMPLETOS", observed);
  }
  return resumo("PUBLICACOES_SEM_VENCEDOR", observed);
}
