import type { Oferta } from "../fontes/types.js";

export type ClassificacaoInstagram =
  | "normal"
  | "story"
  | "premium"
  | "destaque";

export interface AvaliacaoInstagram {
  produtoId: string;
  plataforma: string;
  score: number;
  classificacao: ClassificacaoInstagram;
  elegivel: boolean;
  descontoConsiderado: number;
  motivos: string[];
  bloqueios: string[];
  avaliadoEm: string;
}

const MARCAS_RECONHECIDAS = [
  "amazon",
  "fire tv",
  "kindle",
  "echo",
  "alexa",
  "johnson",
  "johnson's",
  "samsung",
  "motorola",
  "xiaomi",
  "philips",
  "electrolux",
  "mondial",
  "oster",
  "lenovo",
  "acer",
  "asus",
  "logitech",
  "jbl",
  "lego",
  "play-doh",
  "fisher-price",
  "nike",
  "adidas",
  "puma",
  "nescafe",
  "nestle",
  "nestlé",
  "pampers",
  "huggies"
];

const TERMOS_APELO = [
  "eletron",
  "informat",
  "celular",
  "fone",
  "headset",
  "smart",
  "beleza",
  "perfume",
  "shampoo",
  "bebe",
  "bebê",
  "brinquedo",
  "cozinha",
  "air fryer",
  "fritadeira",
  "casa",
  "limpeza",
  "pet",
  "livro",
  "game",
  "gamer"
];

function textoNormalizado(oferta: Oferta): string {
  return `${oferta.titulo} ${oferta.categoria ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function pontuarDesconto(desconto: number): number {
  if (desconto >= 70) return 35;
  if (desconto >= 60) return 32;
  if (desconto >= 50) return 28;
  if (desconto >= 40) return 24;
  if (desconto >= 35) return 20;
  if (desconto >= 25) return 12;
  return Math.max(0, Math.round(desconto / 3));
}

function pontuarPreco(preco: number): number {
  if (preco <= 50) return 15;
  if (preco <= 100) return 13;
  if (preco <= 200) return 10;
  if (preco <= 500) return 7;
  if (preco <= 1_000) return 4;
  return 2;
}

function pontuarMarca(texto: string): number {
  return MARCAS_RECONHECIDAS.some((marca) =>
    texto.includes(
      marca
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
    )
  )
    ? 15
    : 4;
}

function pontuarComissao(comissao?: number): number {
  if (comissao === undefined || !Number.isFinite(comissao)) return 5;
  if (comissao >= 13) return 10;
  if (comissao >= 10) return 8;
  if (comissao >= 7) return 6;
  if (comissao >= 4) return 4;
  return 2;
}

function pontuarApelo(texto: string): number {
  return TERMOS_APELO.some((termo) =>
    texto.includes(
      termo
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
    )
  )
    ? 10
    : 6;
}

function classificacaoPorScore(score: number): ClassificacaoInstagram {
  if (score >= 85) return "destaque";
  if (score >= 75) return "premium";
  if (score >= 60) return "story";
  return "normal";
}

export function avaliarOfertaInstagram(
  oferta: Oferta
): AvaliacaoInstagram {
  const desconto =
    oferta.descontoEfetivoPercentual ??
    oferta.descontoPercentual ??
    0;
  const minimo = Number(
    process.env.INSTAGRAM_MIN_DISCOUNT_PERCENT ?? 35
  );
  const texto = textoNormalizado(oferta);

  const scoreDesconto = pontuarDesconto(desconto);
  const scorePreco = pontuarPreco(oferta.precoAtual);
  const scoreMarca = pontuarMarca(texto);
  const scoreImagem = oferta.imagem ? 15 : 0;
  const scoreComissao = pontuarComissao(
    oferta.comissaoEstimadaPercentual
  );
  const scoreApelo = pontuarApelo(texto);

  const score = Math.max(
    0,
    Math.min(
      100,
      scoreDesconto +
        scorePreco +
        scoreMarca +
        scoreImagem +
        scoreComissao +
        scoreApelo
    )
  );

  const motivos: string[] = [
    `${Math.round(desconto)}% de desconto`,
    oferta.imagem ? "imagem disponível" : "sem imagem",
    scoreMarca >= 15 ? "marca/produto reconhecível" : "produto genérico",
    oferta.precoAtual <= 100
      ? "preço final muito atrativo"
      : oferta.precoAtual <= 200
        ? "preço final atrativo"
        : "preço final moderado"
  ];

  if (
    oferta.comissaoEstimadaPercentual !== undefined
  ) {
    motivos.push(
      `comissão estimada ${oferta.comissaoEstimadaPercentual}%`
    );
  }

  const bloqueios: string[] = [];
  if (!oferta.imagem) {
    bloqueios.push("a oferta não possui imagem utilizável");
  }
  if (desconto < minimo) {
    bloqueios.push(
      `desconto abaixo do mínimo de ${minimo}% para Instagram`
    );
  }

  const elegivel = bloqueios.length === 0;
  const classificacao = elegivel
    ? classificacaoPorScore(score)
    : "normal";

  return {
    produtoId: oferta.produtoId,
    plataforma: oferta.plataforma,
    score,
    classificacao,
    elegivel,
    descontoConsiderado: desconto,
    motivos,
    bloqueios,
    avaliadoEm: new Date().toISOString()
  };
}
