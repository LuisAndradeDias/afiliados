import "dotenv/config";
import type { Oferta } from "../fontes/types.js";
import { obterTokenMercadoLivreValido } from "../afiliados/mercadolivre-token.js";
import {
  centavosBRL, catalogoComCompraConfirmada,
  type DetalheCatalogoDisponibilidade
} from "../fontes/mercadolivre/disponibilidade.js";
import { auditarPrecoContextualMercadoLivre } from "../fontes/mercadolivre/preco-contextual.js";
import { auditarAnuncioDiretoMercadoLivre,
  type AuditoriaAnuncioDireto
} from "../fontes/mercadolivre/auditoria-anuncio-direto.js";
import { investigarCatalogoSemVencedor,
  type InvestigacaoCatalogoSemVencedor
} from "../fontes/mercadolivre/investigacao-sem-vencedor.js";

/**
 * Etapas 54 e 55: diagnostico manual SOMENTE LEITURA.
 * Um GET /products/{id} e UMA de duas alternativas, nunca ambas:
 * - sem buy box: GET /products/{id}/items (classificacao, sem vendedor);
 * - com buy box: GET /items/{winner}/sale_price (preco do canal).
 * - sem buy box + anuncio especifico: GET /items/{id} e no maximo
 *   um GET /items/{id}/sale_price. Nao seleciona como vencedor.
 * Nao gera links de afiliado, nao coleta cookies, nao abre WhatsApp.
 * Imprime somente preco, estado e codigo sanitizado: sem token, seller ID
 * nem URL de afiliado. Requer Central pausada.
 */
const produtoId = process.argv[2] ?? "";
const anuncioSolicitado = process.argv[3] ?? "";
if (!/^MLB[0-9]{5,}$/.test(produtoId) ||
    (anuncioSolicitado !== "" && !/^MLB[0-9]{5,}$/.test(anuncioSolicitado))) {
  console.log("DIAGNOSTICO=INVALIDO MOTIVO=PRODUTO_OU_ANUNCIO_ID_INVALIDO");
  process.exitCode = 2;
} else {
  let motivo = "NAO_INICIADO";
  let criteriosCatalogo: Record<string, boolean> | undefined;
  let investigacaoSemVencedor: InvestigacaoCatalogoSemVencedor | undefined;
  let investigacaoAnuncioDireto: AuditoriaAnuncioDireto | undefined;
  try {
    motivo = "CENTRAL_INACESSIVEL";
    const estadoResponse = await fetch("http://127.0.0.1:3030/api/status", {
      method: "GET", signal: AbortSignal.timeout(4_000)
    });
    const estado = estadoResponse.ok
      ? await estadoResponse.json() as Record<string, unknown>
      : {};
    motivo = "CENTRAL_NAO_ESTA_PAUSADA";
    if (estado.operacaoEstado !== "paused" ||
        estado.whatsappAutoEnvioAtivo === true ||
        estado.whatsappEnvioPendente === true ||
        estado.monitorAlternadoAtivo === true ||
        estado.mercadoLivreMonitorAtivo === true ||
        estado.mercadoLivreLinkJob ||
        estado.mercadoLivreTesteLinkJob) {
      motivo = "CENTRAL_NAO_ESTA_PAUSADA";
      throw new Error("STOP_SAFE");
    }

    let token = "";
    try {
      token = await obterTokenMercadoLivreValido();
    } catch {
      motivo = "TOKEN_INDISPONIVEL";
      throw new Error("STOP_AUTH");
    }
    if (!token) {
      motivo = "TOKEN_AUSENTE";
      throw new Error("STOP_AUTH");
    }

    let response: Response;
    try {
      response = await fetch(
        "https://api.mercadolibre.com/products/" + produtoId, {
          method: "GET",
          headers: {
            accept: "application/json",
            authorization: "Bearer " + token
          },
          signal: AbortSignal.timeout(9_000)
        }
      );
    } catch {
      motivo = "CATALOGO_SEM_RESPOSTA";
      throw new Error("STOP_NETWORK");
    }
    if (!response.ok) {
      motivo = response.status === 429
        ? "CATALOGO_LIMITE_429"
        : [401, 403].includes(response.status)
          ? "CATALOGO_SEM_PERMISSAO"
          : "CATALOGO_HTTP_NAO_CONFIRMADO";
      throw new Error("STOP_HTTP");
    }

    let catalogo: DetalheCatalogoDisponibilidade;
    try {
      catalogo = await response.json() as DetalheCatalogoDisponibilidade;
    } catch {
      motivo = "CATALOGO_INVALIDO";
      throw new Error("STOP_JSON");
    }
    const vencedor = catalogo.buy_box_winner;
    criteriosCatalogo = {
      idCatalogoCorrespondente: catalogo.id === produtoId,
      catalogoAtivo: catalogo.status === "active",
      vencedorPresente: Boolean(vencedor),
      idAnuncioPresente: /^MLB[0-9]{5,}$/.test(vencedor?.item_id ?? ""),
      vendedorIdentificado: Number.isSafeInteger(vencedor?.seller_id) &&
        (vencedor?.seller_id ?? 0) > 0,
      precoCatalogoValido: centavosBRL(vencedor?.price) !== undefined,
      estoqueInteiroPositivo: Number.isSafeInteger(vencedor?.available_quantity) &&
        (vencedor?.available_quantity ?? 0) > 0,
      condicaoNovo: vencedor?.condition === "new",
      moedaBRLOuNaoInformada: vencedor?.currency_id == null ||
        vencedor.currency_id === "BRL"
    };
    const item = {
      item_id:vencedor?.item_id,
      seller_id:vencedor?.seller_id,
      price:vencedor?.price,
      condition:vencedor?.condition,
      currency_id:vencedor?.currency_id,
      available_quantity:vencedor?.available_quantity,
      status:"active"
    };
    if (!vencedor) {
      if (catalogo.id === produtoId && catalogo.status === "active") {
        // Somente uma leitura adicional para distinguir listagem vazia,
        // listagem sem vencedor e erro de permissao. NUNCA escolher
        // candidato da lista como se fosse buy_box_winner.
        if (anuncioSolicitado) {
          // Este anuncio nao vira vencedor: apenas verificamos sua ficha,
          // vinculo catalogo/seller e preco do mesmo item, se autorizados.
          investigacaoAnuncioDireto = await auditarAnuncioDiretoMercadoLivre(
            produtoId, anuncioSolicitado, token
          );
        } else {
          investigacaoSemVencedor = await investigarCatalogoSemVencedor(
            produtoId, catalogo, token
          );
        }
        motivo = "CATALOGO_ATIVO_SEM_VENCEDOR_OFICIAL";
      } else {
        motivo = "CATALOGO_NAO_ATIVO_OU_ID_DIVERGENTE";
      }
      throw new Error("STOP_WINNER");
    }
    if (anuncioSolicitado && vencedor.item_id !== anuncioSolicitado) {
      motivo = "ANUNCIO_SOLICITADO_NAO_EH_VENCEDOR_OFICIAL";
      throw new Error("STOP_DIFFERENT_WINNER");
    }
    if (!catalogoComCompraConfirmada(produtoId,item,catalogo) ||
        centavosBRL(item.price) === undefined) {
      motivo = "VENCEDOR_PRECO_OU_ESTOQUE_NAO_CONFIRMADO";
      throw new Error("STOP_INCOMPLETE");
    }
    const oferta: Oferta = {
      plataforma: "Mercado Livre",
      produtoId,
      anuncioId: vencedor.item_id,
      vendedorId: vencedor.seller_id,
      precoAtual: vencedor.price!,
      titulo: "Produto verificado na API oficial",
      estoqueDisponivel: vencedor.available_quantity!,
      disponibilidadeConfirmada: true,
      urlProduto: "https://www.mercadolivre.com.br/p/" + produtoId,
      encontradoEm: new Date()
    };
    const audit = await auditarPrecoContextualMercadoLivre(oferta,{
      obterToken: async () => token
    });
    console.log(JSON.stringify({
      catalogoProdutoCorrespondente:true,
      vencedorComEstoque:true,
      ofertaAnuncioCorrespondeAoVencedor:true,
      situacaoPrecoCanal:audit.situacao,
      motivo:audit.motivo,
      precoAnuncio:audit.precoDaOferta,
      precoCanalMarketplace:audit.precoDoCanal,
      modalidadePagamentoConfirmada:false,
      cupomAplicavelConfirmado:false,
      atribuicaoComprovada:false
    }));
    if (audit.situacao !== "coerente") process.exitCode = 2;
  } catch {
    console.log(JSON.stringify({
      catalogoProdutoCorrespondente:criteriosCatalogo?.idCatalogoCorrespondente === true,
      catalogoAtivo:criteriosCatalogo?.catalogoAtivo === true,
      vencedorConfirmado:false,
      situacaoPrecoCanal:"inconclusivo",
      motivo,
      criteriosCatalogo,
      investigacaoSemVencedor,
      investigacaoAnuncioDireto,
      modalidadePagamentoConfirmada:false,
      cupomAplicavelConfirmado:false,
      atribuicaoComprovada:false
    }));
    process.exitCode = 2;
  }
}
