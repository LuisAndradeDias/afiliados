/**
 * Revisão técnica somente leitura. Não decide elegibilidade comercial,
 * não publica ofertas e não aplica políticas paralelas ao motor autorizado.
 */
import { readFile, stat } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { resolve } from "node:path";
import { urlProdutoIndividual } from "./mercadolivre-assistido.js";
import { normalizarLinkAfiliadoMercadoLivre } from "../afiliados/mercadolivre.js";

type JsonRecord = Record<string, unknown>;
export interface FichaTecnica {
  id: string;
  titulo: string;
  plataforma: string;
  produtoId: string;
  origem: "oferta-preparada" | "observacao-mercado-livre" | "rascunho-assistido-meli";
  conferidoEm?: string;
  revisaoNecessaria?: boolean;
  precoAtual: number | null;
  descontoPercentual: number | null;
  cupomCodigo: string | null;
  link: string | null;
  verificacoes: { nome: string; observacao: string }[];
}
export interface RevisaoTecnica {
  modo: "somente-leitura";
  consultadoEm: string;
  resumo: {
    ofertasObservadas: number;
    enviosConfirmados: number | null;
    ultimoEnvioEm: string | null;
    rascunhosAssistidos: number;
    rascunhosParaRever: number;
  };
  fichas: FichaTecnica[];
  avisos: string[];
}

function objeto(v: unknown): JsonRecord | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? v as JsonRecord : null;
}
function texto(v: unknown, limite = 180): string {
  return typeof v === "string"
    ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limite) : "";
}
function numero(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0
    ? Math.round(v * 100) / 100 : null;
}
function linkAparente(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 2048) return null;
  try {
    const parsed = new URL(v);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    const dom = parsed.hostname.toLowerCase();
    const hosts = [
      "amazon.com.br", "amzn.to", "mercadolivre.com.br",
      "mercadolibre.com", "meli.la", "shopee.com.br"
    ];
    return hosts.some(host => dom === host || dom.endsWith("." + host)) ? parsed.href : null;
  } catch { return null; }
}
async function lerJson(arquivo: string, limiteBytes: number, avisos: string[], nome: string): Promise<unknown> {
  try {
    const info = await stat(arquivo);
    if (info.size > limiteBytes) {
      avisos.push(nome + ": arquivo grande demais para a visualização.");
      return null;
    }
    return JSON.parse((await readFile(arquivo, "utf8")).replace(/^\uFEFF/, "")) as unknown;
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code !== "ENOENT") {
      avisos.push(nome + ": leitura indisponível; nenhum arquivo foi modificado.");
    }
    return null;
  }
}
function ficha(dado: unknown, origem: FichaTecnica["origem"]): FichaTecnica | null {
  const d = objeto(dado);
  if (!d) return null;
  const titulo = texto(d.titulo);
  if (!titulo) return null;
  const plataforma = texto(d.plataforma, 50) || (origem === "observacao-mercado-livre" ? "Mercado Livre" : "Não identificada");
  const produtoId = texto(d.produtoId, 60);
  const precoAtual = numero(d.precoAtual);
  const descontoPercentual = numero(d.descontoPercentual);
  const link = linkAparente(d.urlAfiliado) ?? linkAparente(d.urlProduto);
  const verificacoes: FichaTecnica["verificacoes"] = [
    { nome: "Preço observado", observacao: precoAtual !== null ? "Valor registrado no arquivo local; consulte a loja antes de publicar." : "Sem preço observado neste arquivo." },
    { nome: "Link", observacao: link ? "Endereço HTTPS de marketplace registrado, sem garantia de atribuição." : "Link de marketplace não disponível neste registro." }
  ];
  const cupomCodigo = texto(d.cupomCodigo, 45) || null;
  if (cupomCodigo) {
    verificacoes.push({ nome: "Cupom", observacao: "Código registrado; aplicabilidade e validade não são presumidas." });
  }
  return {
    id: origem + ":" + (produtoId || titulo.slice(0, 35)),
    titulo, plataforma, produtoId, origem,
    precoAtual, descontoPercentual, cupomCodigo, link, verificacoes
  };
}
const PRAZO_RECONFERENCIA_MINUTOS = 120;

/**
 * Registro manual é exibido como rascunho, nunca como oferta validada.
 * Falha fechada ao detectar JSON adulterado ou URL não permitida.
 */
function fichaRascunhoAssistido(entrada: unknown, agoraMs: number): FichaTecnica | null {
  const d = objeto(entrada);
  if (!d || d.origem !== "conferencia-manual" ||
      d.status !== "rascunho-nao-publicado" ||
      typeof d.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(d.id)) {
    return null;
  }
  const titulo = texto(d.titulo, 160);
  const precoAtual = numero(d.precoAtual);
  const precoAnterior = numero(d.precoAnterior);
  const descontoPercentual = numero(d.descontoPercentual);
  if (titulo.length < 5 || precoAtual === null || precoAtual <= 0 ||
      precoAnterior === null || precoAnterior <= precoAtual ||
      descontoPercentual === null || descontoPercentual < 20 ||
      Math.abs((1 - precoAtual / precoAnterior) * 100 - descontoPercentual) > 0.03) {
    return null;
  }
  let produto: string;
  let afiliado: string;
  try {
    produto = urlProdutoIndividual(d.urlProduto);
    afiliado = normalizarLinkAfiliadoMercadoLivre(String(d.urlAfiliado ?? ""));
    const u = new URL(afiliado);
    if (u.username || u.password || u.port) return null;
    if (linkAparente(afiliado) !== afiliado) return null;
  } catch { return null; }
  const verificadoEm = typeof d.conferidoEm === "string"
    ? Date.parse(d.conferidoEm) : NaN;
  const diferencaMinutos = (agoraMs - verificadoEm) / 60000;
  const revisaoNecessaria = !Number.isFinite(diferencaMinutos) ||
    diferencaMinutos < 0 || diferencaMinutos >= PRAZO_RECONFERENCIA_MINUTOS;
  const produtoId = /\/p\/(MLB[0-9]+)/i.exec(produto)?.[1] ??
    /\/(MLB)-([0-9]+)/i.exec(produto)?.slice(1).join("") ?? "";
  const observacao = revisaoNecessaria
    ? "Conferência com mais de 120 minutos, futura ou inválida: revise preço, estoque, reputação e link."
    : "Conferência declarada recentemente pelo usuário; NÃO validada pela API do Mercado Livre.";
  return {
    id: "rascunho-assistido-meli:" + d.id,
    titulo,
    plataforma: "Mercado Livre",
    produtoId,
    origem: "rascunho-assistido-meli",
    precoAtual,
    descontoPercentual,
    cupomCodigo: null,
    link: afiliado,
    conferidoEm: Number.isFinite(verificadoEm)
      ? new Date(verificadoEm).toISOString() : undefined,
    revisaoNecessaria,
    verificacoes: [
      { nome: "Origem", observacao: "Rascunho criado manualmente; não publicado, não enviado e não aprovado automaticamente." },
      { nome: "Frescor", observacao },
      { nome: "Disponibilidade", observacao: "Estoque e reputação verde apenas declarados na criação; reabra o anúncio." },
      { nome: "Canal", observacao: "Divulgue somente em canal público permitido e declarado ao Programa de Afiliados. Grupos privados não são permitidos." },
      { nome: "Link", observacao: "Link oficial registrado pelo usuário; não houve verificação de atribuição pela API." }
    ]
  };
}

export async function consultarRevisaoTecnica(
  raiz: string,
  agoraMs: number = Date.now()
): Promise<RevisaoTecnica> {
  const avisos: string[] = [];
  const base = resolve(raiz, "data");
  const [pacote, observado, historico, assistidos] = await Promise.all([
    lerJson(resolve(base, "ultima-oferta-whatsapp.json"), 128 * 1024, avisos, "Oferta preparada"),
    lerJson(resolve(base, "ultima-oferta-mercadolivre.json"), 128 * 1024, avisos, "Mercado Livre"),
    lerJson(resolve(base, "historico-ofertas.json"), 1024 * 1024, avisos, "Histórico"),
    lerJson(resolve(base, "mercadolivre-rascunhos-assistidos.json"), 128 * 1024, avisos, "Rascunhos Mercado Livre")
  ]);
  const fichas = [
    ficha(pacote, "oferta-preparada"),
    ficha(observado, "observacao-mercado-livre")
  ].filter((f): f is FichaTecnica => f !== null);
  // Evita mostrar duas fichas idênticas da mesma oferta.
  if (fichas.length === 2 && fichas[0].produtoId &&
      fichas[0].produtoId === fichas[1].produtoId &&
      fichas[0].plataforma.toLowerCase().includes("mercado")) fichas.pop();

  let rascunhos: FichaTecnica[] = [];
  if (assistidos !== null) {
    const container = objeto(assistidos);
    if (container?.versao === 1 && Array.isArray(container.rascunhos) &&
        container.rascunhos.length <= 100) {
      const itens = container.rascunhos.map((item: unknown) =>
        fichaRascunhoAssistido(item, agoraMs)
      );
      if (itens.every((item): item is FichaTecnica => item !== null)) {
        rascunhos = itens as FichaTecnica[];
      } else {
        avisos.push("Rascunhos Mercado Livre: dados inconsistentes; nenhum foi incorporado à revisão.");
      }
    } else {
      avisos.push("Rascunhos Mercado Livre: arquivo inválido; nenhum registro incorporado.");
    }
  }

  let enviados: number | null = null;
  let ultimo: string | null = null;
  if (Array.isArray(historico)) {
    enviados = 0;
    let maior = 0;
    for (const item of historico) {
      const r = objeto(item);
      const data = typeof r?.enviadoEm === "string" ? Date.parse(r.enviadoEm) : NaN;
      if (!Number.isFinite(data)) continue;
      enviados += 1;
      if (data > maior) { maior = data; ultimo = new Date(data).toISOString(); }
    }
  }
  return {
    modo: "somente-leitura",
    consultadoEm: new Date().toISOString(),
    resumo: {
      ofertasObservadas: fichas.length,
      enviosConfirmados: enviados,
      ultimoEnvioEm: ultimo,
      rascunhosAssistidos: rascunhos.length,
      rascunhosParaRever: rascunhos.filter(f => f.revisaoNecessaria).length
    },
    fichas: [...fichas, ...rascunhos],
    avisos
  };
}
export async function responderRotaRevisao(args: {
  method?: string; pathname: string; res: ServerResponse; raiz: string;
}): Promise<boolean> {
  if (args.method !== "GET" || args.pathname !== "/api/revisao") return false;
  const dados = await consultarRevisaoTecnica(args.raiz);
  args.res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  args.res.end(JSON.stringify(dados));
  return true;
}
