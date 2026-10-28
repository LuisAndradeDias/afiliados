import type { Oferta } from "../types.js";
import { obterTokenMercadoLivreValido } from "../../afiliados/mercadolivre-token.js";
import { centavosBRL, revalidarDisponibilidadeMercadoLivre,
  type OpcoesRevalidacaoDisponibilidade } from "./disponibilidade.js";

/**
 * /items/{item_id}/sale_price?context=channel_marketplace e o preco
 * calculado para este canal. Nao revela, por si so, condicao Pix/cartao,
 * elegibilidade pessoal, frete ou um cupom aplicavel no checkout.
 *
 * O catalogo/buy_box_winner precisa ser confirmado separadamente
 * ANTES de usar esta auditoria: a resposta de sale_price nao contem
 * seller_id confiavel para essa comparacao.
 */
export type SituacaoPrecoContextual = "coerente" | "divergente" | "inconclusivo";
export type MotivoPrecoContextual =
  | "PRECO_CANAL_CORRESPONDENTE"
  | "PRECO_CANAL_DIVERGENTE"
  | "PRECO_OFERTA_INVALIDA"
  | "PRECO_API_SEM_PERMISSAO"
  | "PRECO_API_LIMITE_429"
  | "PRECO_API_INDISPONIVEL"
  | "PRECO_RESPOSTA_INCOMPLETA"
  | "PRECO_MOEDA_NAO_BRL"
  | "PRECO_REFERENCIA_DESATUALIZADA"
  | "PRECO_ERRO_REDE";

export interface AuditoriaPrecoContextual {
  situacao: SituacaoPrecoContextual;
  motivo: MotivoPrecoContextual;
  precoDaOferta?: number;
  precoDoCanal?: number;
  consultadoEm: string;
  /** Nunca usar esta auditoria para declarar Pix, cartao ou parcelamento. */
  modalidadePagamentoConfirmada: false;
  /** Nao atribuir ao endpoint prova de cupom ou comissao. */
  cupomAplicavelConfirmado: false;
  atribuicaoComprovada: false;
}

type OfertaParaAuditoria = Pick<Oferta,
  "plataforma" | "produtoId" | "anuncioId" | "vendedorId" |
  "precoAtual" | "estoqueDisponivel" | "disponibilidadeConfirmada"
>;

interface RespostaPrecoMercadoLivre {
  price_id?: unknown;
  amount?: unknown;
  currency_id?: unknown;
  reference_date?: unknown;
  regular_amount?: unknown;
}

export interface OpcoesAuditoriaPreco {
  obterToken?: () => Promise<string>;
  fetchImpl?: typeof fetch;
  agora?: () => number;
  /** Intervalo maximo de seguranca; nao confundir com a validade de cupons. */
  validadeMs?: number;
}

function retorno(
  situacao: SituacaoPrecoContextual,
  motivo: MotivoPrecoContextual,
  instante: number,
  precoDaOferta?: number,
  precoDoCanal?: number
): AuditoriaPrecoContextual {
  return {
    situacao, motivo,
    precoDaOferta, precoDoCanal,
    consultadoEm: new Date(instante).toISOString(),
    modalidadePagamentoConfirmada: false,
    cupomAplicavelConfirmado: false,
    atribuicaoComprovada: false
  };
}

function validarOferta(oferta: OfertaParaAuditoria): boolean {
  return oferta.plataforma === "Mercado Livre" &&
    /^MLB[0-9]{5,}$/.test(oferta.produtoId) &&
    /^MLB[0-9]{5,}$/.test(oferta.anuncioId ?? "") &&
    Number.isSafeInteger(oferta.vendedorId) &&
    (oferta.vendedorId ?? 0) > 0 &&
    Number.isSafeInteger(oferta.estoqueDisponivel) &&
    (oferta.estoqueDisponivel ?? 0) > 0 &&
    oferta.disponibilidadeConfirmada === true &&
    centavosBRL(oferta.precoAtual) !== undefined;
}

/** Uma unica leitura GET, sem retry em HTTP 429 e sem gravar tokens/URLs. */
export async function auditarPrecoContextualMercadoLivre(
  oferta: OfertaParaAuditoria,
  opcoes: OpcoesAuditoriaPreco = {}
): Promise<AuditoriaPrecoContextual> {
  const agora = (opcoes.agora ?? Date.now)();
  if (!Number.isFinite(agora)) {
    throw new Error("Instante de auditoria invalido.");
  }
  if (!validarOferta(oferta)) {
    return retorno("inconclusivo", "PRECO_OFERTA_INVALIDA", agora);
  }
  const precoAtual = centavosBRL(oferta.precoAtual)! / 100;
  let response: Response;
  try {
    const token = await (opcoes.obterToken ?? obterTokenMercadoLivreValido)();
    if (!token || typeof token !== "string") {
      return retorno("inconclusivo", "PRECO_API_SEM_PERMISSAO", agora, precoAtual);
    }
    response = await (opcoes.fetchImpl ?? fetch)(
      "https://api.mercadolibre.com/items/" +
        encodeURIComponent(oferta.anuncioId!) +
        "/sale_price?context=channel_marketplace",
      {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: "Bearer " + token
        },
        signal: AbortSignal.timeout(10_000)
      }
    );
  } catch {
    return retorno("inconclusivo", "PRECO_ERRO_REDE", agora, precoAtual);
  }

  if (response.status === 429) {
    return retorno("inconclusivo", "PRECO_API_LIMITE_429", agora, precoAtual);
  }
  if ([401, 403].includes(response.status)) {
    return retorno("inconclusivo", "PRECO_API_SEM_PERMISSAO", agora, precoAtual);
  }
  if (!response.ok) {
    return retorno("inconclusivo", "PRECO_API_INDISPONIVEL", agora, precoAtual);
  }

  let json: RespostaPrecoMercadoLivre;
  try {
    json = await response.json() as RespostaPrecoMercadoLivre;
  } catch {
    return retorno("inconclusivo", "PRECO_RESPOSTA_INCOMPLETA", agora, precoAtual);
  }

  if (!json || json.currency_id !== "BRL") {
    return retorno("inconclusivo", "PRECO_MOEDA_NAO_BRL", agora, precoAtual);
  }
  const centavosCanal = centavosBRL(json.amount);
  if (centavosCanal === undefined) {
    return retorno("inconclusivo", "PRECO_RESPOSTA_INCOMPLETA", agora, precoAtual);
  }

  const referencia = typeof json.reference_date === "string"
    ? Date.parse(json.reference_date)
    : Number.NaN;
  const validade = Math.min(15 * 60_000,
    Math.max(1000, opcoes.validadeMs ?? 10 * 60_000));
  if (!Number.isFinite(referencia) ||
      referencia > agora + 60_000 ||
      agora - referencia > validade) {
    return retorno("inconclusivo", "PRECO_REFERENCIA_DESATUALIZADA",
      agora, precoAtual, centavosCanal / 100);
  }

  if (centavosBRL(oferta.precoAtual) !== centavosCanal) {
    return retorno("divergente", "PRECO_CANAL_DIVERGENTE",
      agora, precoAtual, centavosCanal / 100);
  }
  return retorno("coerente", "PRECO_CANAL_CORRESPONDENTE",
    agora, precoAtual, centavosCanal / 100);
}

/**
 * Guarda final para link, pacote e clique: primeiro mesmo item/seller/estoque
 * no buy_box_winner e DEPOIS sale_price do anuncio para marketplace.
 * Nao habilita autoenvio nem confirma forma de pagamento.
 */
export async function revalidarEstoqueEPrecoMercadoLivre(
  oferta: OfertaParaAuditoria,
  opcoes: OpcoesRevalidacaoDisponibilidade & OpcoesAuditoriaPreco = {}
): Promise<{
  estoqueDisponivel: number;
  verificadoEm: string;
  precoMercadoLivreConfirmadoEm: string;
}> {
  const disponibilidade = await revalidarDisponibilidadeMercadoLivre(oferta, opcoes);
  // Limitar rajadas no mesmo anuncio antes do segundo GET oficial.
  await new Promise<void>((resolve) => setTimeout(resolve, 300));
  const auditoria = await auditarPrecoContextualMercadoLivre(oferta, opcoes);
  if (auditoria.situacao !== "coerente") {
    throw new Error(
      "PRECO_CONTEXTUAL_NAO_CONFIRMADO: " + auditoria.motivo +
      ". Preparacao e envio bloqueados."
    );
  }
  return {
    estoqueDisponivel: disponibilidade.estoqueDisponivel,
    verificadoEm: disponibilidade.verificadoEm,
    precoMercadoLivreConfirmadoEm: auditoria.consultadoEm
  };
}
