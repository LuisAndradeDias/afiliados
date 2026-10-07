import type { Oferta } from "../fontes/types.js";
import type { AvaliacaoInstagram } from "./classificador.js";

export interface CopyInstagram {
  tituloCurto: string;
  roteiro: string;
  legenda: string;
  hashtags: string[];
  cta: string;
}

function moeda(valor?: number): string {
  if (
    valor === undefined ||
    !Number.isFinite(valor)
  ) {
    return "";
  }

  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function encurtar(texto: string, maximo = 72): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= maximo) return limpo;
  return `${limpo.slice(0, maximo - 1).trim()}…`;
}

function hashtagCategoria(valor?: string): string | undefined {
  if (!valor) return undefined;
  const normalizada = valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
  return normalizada ? `#${normalizada}` : undefined;
}

export function criarCopyInstagram(
  oferta: Oferta,
  avaliacao: AvaliacaoInstagram
): CopyInstagram {
  const tituloCurto = encurtar(oferta.titulo);
  const desconto = Math.round(avaliacao.descontoConsiderado);
  const precoAtual = moeda(oferta.precoAtual);
  const precoAnterior = moeda(oferta.precoAnterior);
  const plataforma = /mercado livre/i.test(oferta.plataforma)
    ? "Mercado Livre"
    : "Amazon";

  const roteiro = [
    "0–2s — Gancho:",
    `“Olha esse achado: ${desconto}% OFF.”`,
    "",
    "2–5s — Produto:",
    `Mostrar: ${tituloCurto}`,
    "",
    "5–9s — Preço:",
    precoAnterior
      ? `“De ${precoAnterior} por ${precoAtual}.”`
      : `“Agora por ${precoAtual}.”`,
    "",
    "9–12s — Reforço:",
    `“Oferta encontrada na ${plataforma}.”`,
    "",
    "12–15s — CTA:",
    "“Quer receber mais ofertas assim? Entre no Grupo VIP pelo link da bio.”"
  ].join("\n");

  const legenda = [
    `🔥 ACHADO DO DIA — ${desconto}% OFF`,
    "",
    tituloCurto,
    "",
    precoAnterior ? `De: ~${precoAnterior}~` : undefined,
    `Por: ${precoAtual}`,
    "",
    `📦 Oferta encontrada na ${plataforma}.`,
    "📲 Quer receber promoções selecionadas todos os dias?",
    "Entre no Grupo VIP pelo link da bio.",
    "",
    "⚠️ Preço e disponibilidade podem mudar.",
    "Publicidade/afiliado: podemos receber comissão em compras qualificadas."
  ]
    .filter(Boolean)
    .join("\n");

  const hashtags = [
    "#ofertas",
    "#promocao",
    "#achadinhos",
    "#desconto",
    "#ofertasdodia",
    plataforma === "Amazon" ? "#amazon" : "#mercadolivre",
    hashtagCategoria(oferta.categoria)
  ].filter((item): item is string => Boolean(item));

  return {
    tituloCurto,
    roteiro,
    legenda,
    hashtags: [...new Set(hashtags)].slice(0, 8),
    cta: "Entre no Grupo VIP pelo link da bio"
  };
}
