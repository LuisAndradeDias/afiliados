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
  condition?: string;
  status?: string;
  available_quantity?: number | null;
}

export interface DetalheCatalogoDisponibilidade {
  id?: string;
  status?: string;
  buy_box_winner?: {
    item_id?: string;
    seller_id?: number;
    price?: number;
    available_quantity?: number | null;
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
    positivo(publicacao.seller_id) &&
    publicacao.condition === "new" &&
    (publicacao.status == null || publicacao.status === "active") &&
    positivo(publicacao.price) &&
    (publicacao.available_quantity == null ||
      positivo(publicacao.available_quantity))
  );
}

/** Esta verificacao isolada exige estoque explicito na publicacao. */
export function publicacaoComEstoqueConfirmado(
  publicacao: PublicacaoCatalogoDisponibilidade
): boolean {
  return publicacaoCandidataParaConfirmar(publicacao) &&
    positivo(publicacao.available_quantity);
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
  if (!positivo(vencedor.available_quantity)) return false;
  if (!positivo(vencedor.price)) return false;
  if (vencedor.seller_id != null &&
      vencedor.seller_id !== publicacao.seller_id) return false;
  if (Math.abs(vencedor.price - publicacao.price!) > 0.01) return false;

  return true;
}

export function disponibilidadeMercadoLivreRecente(
  oferta: Oferta,
  agora = Date.now()
): boolean {
  if (oferta.plataforma !== "Mercado Livre") return true;
  const verificadoEm = Date.parse(oferta.disponibilidadeVerificadaEm ?? "");
  return oferta.disponibilidadeConfirmada === true &&
    Boolean(oferta.anuncioId) &&
    positivo(oferta.estoqueDisponivel) &&
    Boolean(oferta.vendedorId && oferta.vendedorId > 0) &&
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
    !positivo(oferta.vendedorId) ||
    !positivo(oferta.estoqueDisponivel) ||
    !positivo(oferta.precoAtual)
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
