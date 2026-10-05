import type { Oferta } from "../fontes/types.js";

function moedaBR(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
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
  const linhas = [
    cabecalho(oferta),
    "",
    `*${oferta.titulo}*`,
    "",
    oferta.precoAnterior
      ? `De ~${moedaBR(oferta.precoAnterior)}~`
      : undefined,
    `💰 Por *${moedaBR(oferta.precoAtual)}*`,
    oferta.descontoPercentual
      ? `🔥 *${oferta.descontoPercentual}% OFF*`
      : undefined,
    oferta.cupom ? `🎟️ ${oferta.cupom}` : undefined,
    "",
    "🛒 Comprar:",
    oferta.urlAfiliado ?? oferta.urlProduto,
    "",
    "⚠️ Preço e disponibilidade podem mudar."
  ];

  return linhas.filter((linha) => linha !== undefined).join("\n");
}
