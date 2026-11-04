/**
 * Revisão técnica somente leitura. Não decide elegibilidade comercial,
 * não publica ofertas e não aplica políticas paralelas ao motor autorizado.
 */
import { readFile, stat } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { resolve } from "node:path";

type JsonRecord = Record<string, unknown>;
export interface FichaTecnica {
  id: string;
  titulo: string;
  plataforma: string;
  produtoId: string;
  origem: "oferta-preparada" | "observacao-mercado-livre";
  precoAtual: number | null;
  descontoPercentual: number | null;
  cupomCodigo: string | null;
  link: string | null;
  verificacoes: { nome: string; observacao: string }[];
}
export interface RevisaoTecnica {
  modo: "somente-leitura";
  consultadoEm: string;
  resumo: { ofertasObservadas: number; enviosConfirmados: number | null; ultimoEnvioEm: string | null };
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
export async function consultarRevisaoTecnica(raiz: string): Promise<RevisaoTecnica> {
  const avisos: string[] = [];
  const base = resolve(raiz, "data");
  const [pacote, observado, historico] = await Promise.all([
    lerJson(resolve(base, "ultima-oferta-whatsapp.json"), 128 * 1024, avisos, "Oferta preparada"),
    lerJson(resolve(base, "ultima-oferta-mercadolivre.json"), 128 * 1024, avisos, "Mercado Livre"),
    lerJson(resolve(base, "historico-ofertas.json"), 1024 * 1024, avisos, "Histórico")
  ]);
  const fichas = [
    ficha(pacote, "oferta-preparada"),
    ficha(observado, "observacao-mercado-livre")
  ].filter((f): f is FichaTecnica => f !== null);
  // Evita mostrar duas fichas idênticas da mesma oferta.
  if (fichas.length === 2 && fichas[0].produtoId &&
      fichas[0].produtoId === fichas[1].produtoId &&
      fichas[0].plataforma.toLowerCase().includes("mercado")) fichas.pop();

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
    resumo: { ofertasObservadas: fichas.length, enviosConfirmados: enviados, ultimoEnvioEm: ultimo },
    fichas,
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
