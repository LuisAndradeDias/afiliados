import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Oferta } from "../fontes/types.js";

const CUPONS_URL =
  process.env.MERCADOLIVRE_COUPON_SOURCE_URL?.trim() ||
  "https://www.mercadolivre.com.br/l/promocoes";
const CACHE_PATH = "data/cupons-mercadolivre.json";

export interface CupomMercadoLivre {
  codigo: string;
  percentual?: number;
  valorFixo?: number;
  compraMinima?: number;
  descontoMaximo?: number;
  validoDe?: string;
  validoAte?: string;
  limiteCupons?: number;
  naoCumulativo: boolean;
  somenteItensElegiveis: boolean;
  termos: string;
  origem: "mercadolivre-promocoes";
  coletadoEm: string;
}

interface CacheCuponsMercadoLivre {
  coletadoEm: string;
  fonte: string;
  cupons: CupomMercadoLivre[];
}

function numeroBR(valor: string | undefined): number | undefined {
  if (!valor) return undefined;
  const normalizado = valor.replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : undefined;
}

function limparHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;|&#38;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ccedil;/gi, "ç")
    .replace(/\s+/g, " ")
    .trim();
}

function isoDataBrasil(
  dia: string,
  mes: string,
  anoRecebido: string,
  fimDoDia = false
): string | undefined {
  const anoNumero = Number(anoRecebido);
  const ano = anoRecebido.length === 2 ? 2000 + anoNumero : anoNumero;
  const d = Number(dia);
  const m = Number(mes);

  if (
    !Number.isFinite(ano) ||
    !Number.isFinite(d) ||
    !Number.isFinite(m) ||
    d < 1 ||
    d > 31 ||
    m < 1 ||
    m > 12
  ) {
    return undefined;
  }

  const horario = fimDoDia ? "23:59:59" : "00:00:00";
  return `${String(ano).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${horario}-03:00`;
}

function datasDoTermo(termos: string): {
  validoDe?: string;
  validoAte?: string;
} {
  const inicio = termos.match(
    /(?:Cupom\s+)?válido\s+de\s+(\d{2})\/(\d{2})\/(\d{2,4})/i
  );
  if (!inicio) return {};

  const validoDe = isoDataBrasil(inicio[1], inicio[2], inicio[3]);
  const restante = termos.slice((inicio.index ?? 0) + inicio[0].length);
  const fim = restante.match(
    /(?:até|a)\s+(\d{2})\/(\d{2})\/(\d{2,4})/i
  );

  if (fim) {
    return {
      validoDe,
      validoAte: isoDataBrasil(fim[1], fim[2], fim[3], true)
    };
  }

  if (/até\s+(?:às?|as)\s*23h59/i.test(termos)) {
    return {
      validoDe,
      validoAte: isoDataBrasil(inicio[1], inicio[2], inicio[3], true)
    };
  }

  return { validoDe };
}

function parsearCupom(codigo: string, termos: string): CupomMercadoLivre | null {
  const percentualMatch = termos.match(
    /Desconto(?:\s+de)?(?:\s+até)?\s*(\d+(?:[.,]\d+)?)\s*%/i
  );

  const valorFixoMatch = percentualMatch
    ? null
    : termos.match(
        /(?:Desconto(?:\s+de)?|Ganhe)\s+R\$\s*([\d.]+(?:,\d+)?)/i
      );

  const compraMinimaMatch = termos.match(
    /compra(?:s)?\s+a\s+partir\s+de\s+R\$\s*([\d.]+(?:,\d+)?)/i
  );
  const descontoMaximoMatch = termos.match(
    /desconto\s+máximo\s+de\s+R\$\s*([\d.]+(?:,\d+)?)/i
  );
  const limiteMatch = termos.match(
    /limite\s+de\s+([\d.]+)\s+cupons/i
  );

  const percentual = numeroBR(percentualMatch?.[1]);
  const valorFixo = numeroBR(valorFixoMatch?.[1]);

  if (!percentual && !valorFixo) return null;

  const datas = datasDoTermo(termos);

  return {
    codigo,
    percentual,
    valorFixo,
    compraMinima: numeroBR(compraMinimaMatch?.[1]),
    descontoMaximo: numeroBR(descontoMaximoMatch?.[1]),
    validoDe: datas.validoDe,
    validoAte: datas.validoAte,
    limiteCupons: numeroBR(limiteMatch?.[1]),
    naoCumulativo: /não\s+(?:é\s+)?cumulativ[oa]/i.test(termos),
    somenteItensElegiveis: /itens?\s+elegíveis?/i.test(termos),
    termos: termos.slice(0, 2_500),
    origem: "mercadolivre-promocoes",
    coletadoEm: new Date().toISOString()
  };
}

export function extrairCuponsMercadoLivre(html: string): CupomMercadoLivre[] {
  const texto = limparHtml(html);
  const marcador = /\bCupom\s+([A-Z0-9][A-Z0-9_-]{3,29})\b/g;
  const marcadores = [...texto.matchAll(marcador)];
  const porCodigo = new Map<string, CupomMercadoLivre>();

  for (let i = 0; i < marcadores.length; i += 1) {
    const atual = marcadores[i];
    const codigo = atual[1].toUpperCase();
    const inicio = atual.index ?? 0;
    const fim =
      i + 1 < marcadores.length
        ? (marcadores[i + 1].index ?? texto.length)
        : Math.min(texto.length, inicio + 3_500);

    const termos = texto.slice(inicio, Math.min(fim, inicio + 3_500));
    if (!/válido|desconto|compra/i.test(termos)) continue;

    const cupom = parsearCupom(codigo, termos);
    if (!cupom) continue;

    const existente = porCodigo.get(codigo);
    if (!existente || cupom.termos.length > existente.termos.length) {
      porCodigo.set(codigo, cupom);
    }
  }

  return [...porCodigo.values()];
}

function cupomAtivo(cupom: CupomMercadoLivre, agora = Date.now()): boolean {
  const inicio = cupom.validoDe ? new Date(cupom.validoDe).getTime() : Number.NaN;
  const fim = cupom.validoAte ? new Date(cupom.validoAte).getTime() : Number.NaN;

  if (Number.isFinite(inicio) && agora < inicio) return false;
  if (Number.isFinite(fim) && agora > fim) return false;
  return true;
}

function refreshMs(): number {
  const minutos = Number(
    process.env.MERCADOLIVRE_COUPON_REFRESH_MINUTES ?? 2
  );
  return Math.max(1, Number.isFinite(minutos) ? minutos : 2) * 60_000;
}

async function lerCache(): Promise<CacheCuponsMercadoLivre | null> {
  return readFile(CACHE_PATH, "utf8")
    .then((texto) => JSON.parse(texto.replace(/^\uFEFF/, "")) as CacheCuponsMercadoLivre)
    .catch(() => null);
}

async function gravarCache(cupons: CupomMercadoLivre[]): Promise<void> {
  const cache: CacheCuponsMercadoLivre = {
    coletadoEm: new Date().toISOString(),
    fonte: CUPONS_URL,
    cupons
  };

  await mkdir(dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
}

async function baixarCupons(): Promise<CupomMercadoLivre[]> {
  const resposta = await fetch(CUPONS_URL, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "pt-BR,pt;q=0.9",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141 Safari/537.36"
    },
    signal: AbortSignal.timeout(20_000)
  });

  if (!resposta.ok) {
    throw new Error(
      `Mercado Livre cupons HTTP ${resposta.status}: não foi possível atualizar o catálogo.`
    );
  }

  const html = await resposta.text();
  const cupons = extrairCuponsMercadoLivre(html);

  if (cupons.length === 0) {
    throw new Error(
      "A página oficial de promoções não retornou cupons reconhecíveis."
    );
  }

  await gravarCache(cupons);
  return cupons;
}

export async function obterCuponsMercadoLivre(
  opcoes: { forcarAtualizacao?: boolean } = {}
): Promise<CupomMercadoLivre[]> {
  const cache = await lerCache();
  const idade =
    cache?.coletadoEm
      ? Date.now() - new Date(cache.coletadoEm).getTime()
      : Number.POSITIVE_INFINITY;

  let cupons = cache?.cupons ?? [];

  if (opcoes.forcarAtualizacao || idade >= refreshMs() || cupons.length === 0) {
    try {
      cupons = await baixarCupons();
    } catch (error) {
      if (cupons.length === 0) throw error;

      const mensagem = error instanceof Error ? error.message : String(error);
      console.warn(
        `Mercado Livre: usando cache de cupons porque a atualização falhou: ${mensagem}`
      );
    }
  }

  return cupons.filter((cupom) => cupomAtivo(cupom));
}

export async function statusCuponsMercadoLivre(): Promise<{
  total: number;
  ativos: number;
  coletadoEm?: string;
}> {
  const cache = await lerCache();
  const cupons = cache?.cupons ?? [];
  return {
    total: cupons.length,
    ativos: cupons.filter((cupom) => cupomAtivo(cupom)).length,
    coletadoEm: cache?.coletadoEm
  };
}

function textoNormalizado(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function exclusaoConhecida(oferta: Oferta): boolean {
  const texto = textoNormalizado(
    `${oferta.categoria ?? ""} ${oferta.titulo}`
  );

  const termosExcluidos = [
    "perfume",
    "fragrancia",
    "videogame",
    "video game",
    "playstation",
    "xbox",
    "nintendo switch",
    "console",
    "smart tv",
    "televisor",
    "televisao"
  ];

  return termosExcluidos.some((termo) => texto.includes(termo));
}

function descontoCupom(
  base: number,
  cupom: CupomMercadoLivre
): number | undefined {
  if (cupom.compraMinima && base + 0.001 < cupom.compraMinima) {
    return undefined;
  }

  let desconto = 0;

  if (cupom.percentual) {
    desconto = base * (cupom.percentual / 100);
  } else if (cupom.valorFixo) {
    desconto = cupom.valorFixo;
  }

  if (cupom.descontoMaximo) {
    desconto = Math.min(desconto, cupom.descontoMaximo);
  }

  if (desconto <= 0) return undefined;
  return Math.min(desconto, Math.max(0, base - 0.01));
}

function limparCupomOferta(oferta: Oferta): Oferta {
  return {
    ...oferta,
    cupom: undefined,
    cupomCodigo: undefined,
    cupomPercentual: undefined,
    cupomValor: undefined,
    cupomCompraMinima: undefined,
    cupomDescontoMaximo: undefined,
    cupomValidoAte: undefined,
    cupomValidacao: undefined,
    precoComCupomEstimado: undefined,
    descontoEfetivoPercentual: oferta.descontoPercentual ?? 0
  };
}

function aplicarCupom(
  ofertaOriginal: Oferta,
  cupom: CupomMercadoLivre
): Oferta | null {
  const oferta = limparCupomOferta(ofertaOriginal);

  if (exclusaoConhecida(oferta)) return null;

  const precoReferencia =
    cupom.naoCumulativo &&
    oferta.precoAnterior &&
    oferta.precoAnterior > oferta.precoAtual
      ? oferta.precoAnterior
      : oferta.precoAtual;

  const descontoValor = descontoCupom(precoReferencia, cupom);
  if (!descontoValor) return null;

  const precoCupom = Math.max(0.01, precoReferencia - descontoValor);
  const melhorPreco = Math.min(oferta.precoAtual, precoCupom);
  const referencia =
    oferta.precoAnterior && oferta.precoAnterior > melhorPreco
      ? oferta.precoAnterior
      : precoReferencia;

  const descontoEfetivo = Math.round(
    ((referencia - melhorPreco) / referencia) * 100
  );

  const descontoBase = oferta.descontoPercentual ?? 0;
  if (descontoEfetivo <= descontoBase) return null;

  const descricao = cupom.percentual
    ? `${cupom.percentual}% OFF`
    : `R$ ${cupom.valorFixo?.toFixed(2)} OFF`;

  return {
    ...oferta,
    cupom: `Cupom ${cupom.codigo}: ${descricao}`,
    cupomCodigo: cupom.codigo,
    cupomPercentual: cupom.percentual,
    cupomValor: cupom.valorFixo,
    cupomCompraMinima: cupom.compraMinima,
    cupomDescontoMaximo: cupom.descontoMaximo,
    cupomValidoAte: cupom.validoAte,
    cupomValidacao: "catalogo-oficial-estimado",
    precoComCupomEstimado: precoCupom,
    descontoEfetivoPercentual: descontoEfetivo
  };
}

export function aplicarMelhorCupomMercadoLivre(
  oferta: Oferta,
  cupons: CupomMercadoLivre[]
): Oferta {
  let melhor = limparCupomOferta(oferta);

  for (const cupom of cupons) {
    const candidata = aplicarCupom(oferta, cupom);
    if (!candidata) continue;

    if (
      (candidata.descontoEfetivoPercentual ?? 0) >
      (melhor.descontoEfetivoPercentual ?? 0)
    ) {
      melhor = candidata;
    }
  }

  return melhor;
}

export async function revalidarCupomMercadoLivre(
  oferta: Oferta
): Promise<Oferta> {
  if (!oferta.cupomCodigo) {
    return {
      ...oferta,
      descontoEfetivoPercentual:
        oferta.descontoEfetivoPercentual ?? oferta.descontoPercentual ?? 0
    };
  }

  const cupons = await obterCuponsMercadoLivre({
    forcarAtualizacao: true
  });
  const cupom = cupons.find(
    (atual) => atual.codigo === oferta.cupomCodigo
  );

  if (!cupom) {
    console.warn(
      `Mercado Livre: cupom ${oferta.cupomCodigo} não aparece mais no catálogo oficial; removendo da oferta.`
    );
    return limparCupomOferta(oferta);
  }

  return aplicarCupom(oferta, cupom) ?? limparCupomOferta(oferta);
}
