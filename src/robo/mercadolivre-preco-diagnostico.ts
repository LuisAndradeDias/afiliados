import "dotenv/config";
import type { Oferta } from "../fontes/types.js";
import { obterTokenMercadoLivreValido } from "../afiliados/mercadolivre-token.js";
import {
  centavosBRL, catalogoComCompraConfirmada,
  type DetalheCatalogoDisponibilidade
} from "../fontes/mercadolivre/disponibilidade.js";
import { auditarPrecoContextualMercadoLivre } from "../fontes/mercadolivre/preco-contextual.js";

/**
 * Etapa 54: diagnostico manual SOMENTE LEITURA.
 * Um GET /products/{id} + no maximo um GET /items/{winner}/sale_price.
 * Nao gera links de afiliado, nao coleta cookies, nao abre WhatsApp.
 * Imprime somente preco, estado e codigo sanitizado: sem token, seller ID
 * nem URL de afiliado. Requer Central pausada.
 */
const produtoId = process.argv[2] ?? "";
if (!/^MLB[0-9]{5,}$/.test(produtoId)) {
  console.log("DIAGNOSTICO=INVALIDO MOTIVO=PRODUTO_ID_INVALIDO");
  process.exitCode = 2;
} else {
  let motivo = "NAO_INICIADO";
  let criteriosCatalogo: Record<string, boolean> | undefined;
  try {
    const estadoResponse = await fetch("http://127.0.0.1:3030/api/status", {
      method: "GET", signal: AbortSignal.timeout(4_000)
    });
    const estado = estadoResponse.ok
      ? await estadoResponse.json() as Record<string, unknown>
      : {};
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
      motivo = "CATALOGO_ATIVO_SEM_VENCEDOR_OFICIAL";
      throw new Error("STOP_WINNER");
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
      catalogoProdutoCorrespondente:false,
      situacaoPrecoCanal:"inconclusivo",
      motivo,
      criteriosCatalogo,
      modalidadePagamentoConfirmada:false,
      cupomAplicavelConfirmado:false,
      atribuicaoComprovada:false
    }));
    process.exitCode = 2;
  }
}
