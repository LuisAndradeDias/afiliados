import type { Oferta } from "../fontes/types.js";
import { removerCupomNaoConfirmado } from "../ofertas/cupons-politica.js";

function moedaBR(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function linhasCupom(oferta: Oferta): Array<string | undefined> {
  if (oferta.cupomCodigo) {
    const beneficio = oferta.cupomPercentual
      ? `${oferta.cupomPercentual}% OFF`
      : oferta.cupomValor
        ? `${moedaBR(oferta.cupomValor)} OFF`
        : undefined;

    const condicoes = [
      oferta.cupomCompraMinima
        ? `compra mínima ${moedaBR(oferta.cupomCompraMinima)}`
        : undefined,
      oferta.cupomDescontoMaximo
        ? `desconto máximo ${moedaBR(oferta.cupomDescontoMaximo)}`
        : undefined
    ].filter(Boolean).join(" · ");

    return [
      `🎟️ Cupom: *${oferta.cupomCodigo}*`,
      beneficio ? `🏷️ ${beneficio}${condicoes ? ` · ${condicoes}` : ""}` : undefined,
      oferta.precoComCupomEstimado
        ? `💳 Se elegível no checkout: *~${moedaBR(oferta.precoComCupomEstimado)}*`
        : undefined,
      "ℹ️ Cupom sujeito à elegibilidade e disponibilidade no checkout; pode não acumular com outras promoções."
    ];
  }

  return oferta.cupom ? [`🎟️ ${oferta.cupom}`] : [];
}

function cabecalho(oferta: Oferta): string {
  const plataforma = oferta.plataforma
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (plataforma.includes("mercado livre")) {
    return "🟡 *OFERTA MERCADO LIVRE*";
  }

  if (plataforma.includes("amazon")) {
    return "🔥 *OFERTA AMAZON*";
  }

  return `🔥 *OFERTA ${oferta.plataforma.toUpperCase()}*`;
}

export function formatarOfertaWhatsapp(oferta: Oferta): string {
  const ehMercadoLivre = oferta.plataforma.trim().toLowerCase() === "mercado livre";
  const linhas = [
    cabecalho(oferta),
    "",
    `*${oferta.titulo}*`,
    "",
    oferta.precoAnterior
      ? ehMercadoLivre
        ? `Referência anunciada: ~${moedaBR(oferta.precoAnterior)}~`
        : `De ~${moedaBR(oferta.precoAnterior)}~`
      : undefined,
    ehMercadoLivre
      ? `💰 Preço informado no catálogo: *${moedaBR(oferta.precoAtual)}*`
      : `💰 Por *${moedaBR(oferta.precoAtual)}*`,
    oferta.descontoPercentual
      ? ehMercadoLivre
        ? `🏷️ Desconto anunciado: *${oferta.descontoPercentual}% OFF*`
        : `🔥 *${oferta.descontoPercentual}% OFF*`
      : undefined,
    ...linhasCupom(removerCupomNaoConfirmado(oferta)),
    "",
    "🛒 Comprar:",
    oferta.urlAfiliado ?? oferta.urlProduto,
    "",
    ehMercadoLivre
      ? "⚠️ Confira vendedor, estoque e valor final no link. Preço pode depender de Pix, cartão ou benefícios da conta."
      : "⚠️ Preço e disponibilidade podem mudar."
  ];

  return linhas.filter((linha) => linha !== undefined).join("\n");
}
