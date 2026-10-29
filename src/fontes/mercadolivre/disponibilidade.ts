import type { Oferta } from "../types.js";
import { obterTokenMercadoLivreValido } from "../../afiliados/mercadolivre-token.js";

/**
 * Catalogo ativo nao comprova publicacao compravel.
 * Caso estoque ou vencedor nao possam ser verificados, bloquear a oferta.
 */
export interface PublicacaoCatalogoDisponibilidade {
  item_id?: string;
  seller_id?: number;
  price?: number;
  original_price?: number | null;
  condition?: string;
  status?: string;
  available_quantity?: number | null;
  currency_id?: string;
}

export interface DetalheCatalogoDisponibilidade {
  id?: string;
  status?: string;
  buy_box_winner?: {
    item_id?: string;
    seller_id?: number;
    price?: number;
    original_price?: number | null;
    available_quantity?: number | null;
    currency_id?: string;
    condition?: string;
  } | null;
}

export type OfertaParaRevalidarMercadoLivre = Pick<
  Oferta,
  "plataforma" | "produtoId" | "anuncioId" | "vendedorId" |
  "precoAtual" | "estoqueDisponivel" | "disponibilidadeConfirmada"
>;

function positivo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0;
}

function inteiroPositivo(valor: unknown): valor is number {
  return positivo(valor) && Number.isSafeInteger(valor);
}

/** Evita truncar ou anunciar precos de moeda com fracao de centavo. */
export function centavosBRL(valor: unknown): number | undefined {
  if (!positivo(valor) || valor > 1_000_000) return undefined;
  const centavos = Math.round(valor * 100);
  return Number.isSafeInteger(centavos) &&
    Math.abs(valor * 100 - centavos) < 0.000001
      ? centavos
      : undefined;
}

function moedaBRLOuAusente(valor: string | undefined): boolean {
  return valor == null || valor === "BRL";
}

/**
 * A lista publica /products/{id}/items nem sempre expõe available_quantity.
 * A ficha do catalogo/buy_box_winner pode comprovar a disponibilidade.
 * Quando a lista afirma explicitamente zero (ou traz dado invalido), rejeitar.
 */
export function publicacaoCandidataParaConfirmar(
  publicacao: PublicacaoCatalogoDisponibilidade
): boolean {
  return Boolean(
    publicacao &&
    typeof publicacao.item_id === "string" &&
    publicacao.item_id.trim() &&
    inteiroPositivo(publicacao.seller_id) &&
    publicacao.condition === "new" &&
    (publicacao.status == null || publicacao.status === "active") &&
    centavosBRL(publicacao.price) !== undefined &&
    moedaBRLOuAusente(publicacao.currency_id) &&
    (publicacao.available_quantity == null ||
      inteiroPositivo(publicacao.available_quantity))
  );
}

/** Esta verificacao isolada exige estoque explicito na publicacao. */
export function publicacaoComEstoqueConfirmado(
  publicacao: PublicacaoCatalogoDisponibilidade
): boolean {
  return publicacaoCandidataParaConfirmar(publicacao) &&
    inteiroPositivo(publicacao.available_quantity);
}

export function catalogoComCompraConfirmada(
  produtoId: string,
  publicacao: PublicacaoCatalogoDisponibilidade,
  detalhe: DetalheCatalogoDisponibilidade
): boolean {
  if (!publicacaoCandidataParaConfirmar(publicacao)) return false;
  if (detalhe?.id !== produtoId || detalhe.status !== "active") return false;

  // Se nao existe buy box ou o vencedor e outro anuncio, o link /p/...
  // pode abrir um catalogo sem opcao de compra para a oferta escolhida.
  const vencedor = detalhe.buy_box_winner;
  if (!vencedor || vencedor.item_id !== publicacao.item_id) return false;
  if (!inteiroPositivo(vencedor.available_quantity)) return false;
  if (vencedor.condition != null && vencedor.condition !== "new") return false;
  const precoVencedor = centavosBRL(vencedor.price);
  const precoPublicacao = centavosBRL(publicacao.price);
  if (precoVencedor === undefined || precoVencedor !== precoPublicacao) return false;
  // Sem o id do vendedor vencedor nao ha como garantir quem recebera o pedido.
  if (!inteiroPositivo(vencedor.seller_id) ||
      vencedor.seller_id !== publicacao.seller_id) return false;
  if (!moedaBRLOuAusente(vencedor.currency_id) ||
      !moedaBRLOuAusente(publicacao.currency_id)) return false;

  return true;
}

/**
 * Seleciona o vencedor real da pagina /p/, nunca o maior desconto concorrente.
 * Se a lista /items omitir o vencedor, o proprio buy_box_winner pode servir de
 * comprovacao APENAS quando traz condicao, vendedor, preco e estoque completos.
 * Dados contraditorios entre listagem e ficha nunca podem ser ignorados.
 */
export function selecionarPublicacaoVencedora<T extends PublicacaoCatalogoDisponibilidade>(
  produtoId: string,
  publicacoes: T[],
  detalhe: DetalheCatalogoDisponibilidade
): PublicacaoCatalogoDisponibilidade | undefined {
  if (detalhe?.id !== produtoId || detalhe.status !== "active" ||
      !detalhe.buy_box_winner?.item_id) return undefined;
  const vencedor = detalhe.buy_box_winner;
  const listadas = publicacoes.filter((item) => item.item_id === vencedor.item_id);
  if (listadas.length > 0) {
    return listadas.find((item) =>
      catalogoComCompraConfirmada(produtoId, item, detalhe)
    );
  }

  // Sem linha publica para o vencedor, exigir todos os campos do cadastro
  // oficial em /products/{id}. Nao presumir que o vencedor seja novo.
  const exclusivamenteCatalogo: PublicacaoCatalogoDisponibilidade = {
    item_id: vencedor.item_id,
    seller_id: vencedor.seller_id,
    price: vencedor.price,
    original_price: vencedor.original_price,
    currency_id: vencedor.currency_id,
    condition: vencedor.condition,
    status: "active",
    available_quantity: vencedor.available_quantity
  };
  return catalogoComCompraConfirmada(produtoId, exclusivamenteCatalogo, detalhe)
    ? exclusivamenteCatalogo
    : undefined;
}

export function disponibilidadeMercadoLivreRecente(
  oferta: Oferta,
  agora = Date.now()
): boolean {
  if (oferta.plataforma !== "Mercado Livre") return true;
  const verificadoEm = Date.parse(oferta.disponibilidadeVerificadaEm ?? "");
  return oferta.disponibilidadeConfirmada === true &&
    Boolean(oferta.anuncioId) &&
    inteiroPositivo(oferta.estoqueDisponivel) &&
    Boolean(inteiroPositivo(oferta.vendedorId)) &&
    Number.isFinite(verificadoEm) &&
    verificadoEm <= agora &&
    agora - verificadoEm <= 10 * 60_000;
}

/**
 * Reconsulta o catalogo oficial antes de preparar ou enviar no WhatsApp.
 * Sem buy_box_winner/estoque a disponibilidade nao esta confirmada.
 * So faz uma chamada GET; nunca envia mensagem.
 */
export interface OpcoesRevalidacaoDisponibilidade {
  obterToken?: () => Promise<string>;
  fetchImpl?: typeof fetch;
}

export async function revalidarDisponibilidadeMercadoLivre(
  oferta: OfertaParaRevalidarMercadoLivre,
  opcoes: OpcoesRevalidacaoDisponibilidade = {}
): Promise<{ estoqueDisponivel: number; verificadoEm: string }> {
  if (oferta.plataforma !== "Mercado Livre") {
    throw new Error("Revalidacao solicitada para plataforma incorreta.");
  }
  if (
    oferta.disponibilidadeConfirmada !== true ||
    !/^MLB[0-9]+$/.test(oferta.produtoId) ||
    !/^MLB[0-9]+$/.test(oferta.anuncioId ?? "") ||
    !inteiroPositivo(oferta.vendedorId) ||
    !inteiroPositivo(oferta.estoqueDisponivel) ||
    centavosBRL(oferta.precoAtual) === undefined
  ) {
    throw new Error(
      "DISPONIBILIDADE_NAO_CONFIRMADA: oferta sem anuncio e estoque verificados. Envio bloqueado."
    );
  }

  const token = await (opcoes.obterToken ?? obterTokenMercadoLivreValido)();
  const response = await (opcoes.fetchImpl ?? fetch)(
    "https://api.mercadolibre.com/products/" + encodeURIComponent(oferta.produtoId),
    {
      method: "GET",
      headers: { accept: "application/json", authorization: "Bearer " + token },
      signal: AbortSignal.timeout(10_000)
    }
  );
  if (!response.ok) {
    throw new Error(
      "DISPONIBILIDADE_NAO_CONFIRMADA: API Mercado Livre HTTP " +
        response.status + ". Envio bloqueado."
    );
  }

  const detalhe = await response.json() as DetalheCatalogoDisponibilidade;
  const anuncio: PublicacaoCatalogoDisponibilidade = {
    item_id: oferta.anuncioId,
    seller_id: oferta.vendedorId,
    price: oferta.precoAtual,
    condition: "new",
    status: "active",
    available_quantity: oferta.estoqueDisponivel
  };
  if (!catalogoComCompraConfirmada(oferta.produtoId, anuncio, detalhe)) {
    throw new Error(
      "PRODUTO_INDISPONIVEL: anuncio sem compra ou estoque comprovado na API oficial. Envio bloqueado."
    );
  }

  return {
    estoqueDisponivel: Math.min(
      oferta.estoqueDisponivel, detalhe.buy_box_winner!.available_quantity!
    ),
    verificadoEm: new Date().toISOString()
  };
}
