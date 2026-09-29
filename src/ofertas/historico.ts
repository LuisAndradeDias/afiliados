import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Oferta } from "../fontes/types.js";

const CAMINHO = "data/historico-ofertas.json";

export interface RegistroHistoricoOferta {
  chave: string;
  plataforma: string;
  produtoId: string;
  titulo: string;
  precoAtual?: number;
  descontoPercentual?: number;
  vistoEm?: string;
  enviadoEm?: string;
}

export interface OfertaHistoricoInput {
  plataforma?: string;
  produtoId: string;
  titulo: string;
  precoAtual?: number;
  descontoPercentual?: number;
}


function plataformaCanonica(valor?: string): string {
  const normalizada = (valor ?? "amazon")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalizada.includes("amazon")) return "amazon";
  if (normalizada.includes("mercado-livre")) return "mercado-livre";
  if (normalizada.includes("shopee")) return "shopee";
  if (normalizada.includes("aliexpress")) return "aliexpress";

  return normalizada || "desconhecida";
}

export function chaveOferta(
  oferta: Pick<OfertaHistoricoInput, "plataforma" | "produtoId">
): string {
  return `${plataformaCanonica(oferta.plataforma)}:${oferta.produtoId}`.toLowerCase();
}
export function cooldownHoras(): number {
  const valor = Number(process.env.OFFER_COOLDOWN_HOURS ?? 24);
  return Number.isFinite(valor) && valor > 0 ? valor : 24;
}

export function previewCooldownMinutos(): number {
  const valor = Number(process.env.OFFER_PREVIEW_COOLDOWN_MINUTES ?? 120);
  return Number.isFinite(valor) && valor > 0 ? valor : 120;
}

async function lerHistorico(): Promise<RegistroHistoricoOferta[]> {
  try {
    const texto = await readFile(CAMINHO, "utf8");
    const dados = JSON.parse(texto.replace(/^\uFEFF/, ""));
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

async function gravarHistorico(
  registros: RegistroHistoricoOferta[]
): Promise<void> {
  await mkdir(dirname(CAMINHO), { recursive: true });
  await writeFile(CAMINHO, JSON.stringify(registros, null, 2), "utf8");
}

function timestamp(valor?: string): number {
  if (!valor) return Number.NaN;
  return new Date(valor).getTime();
}

function dentroDoCooldown(registro: RegistroHistoricoOferta): boolean {
  const agora = Date.now();
  const enviadoEm = timestamp(registro.enviadoEm);
  const vistoEm = timestamp(registro.vistoEm);

  const enviadoRecente =
    Number.isFinite(enviadoEm) &&
    enviadoEm >= agora - cooldownHoras() * 60 * 60 * 1000;

  const vistoRecente =
    Number.isFinite(vistoEm) &&
    vistoEm >= agora - previewCooldownMinutos() * 60 * 1000;

  return enviadoRecente || vistoRecente;
}

export async function chavesBloqueadas(): Promise<Set<string>> {
  const registros = await lerHistorico();
  return new Set(
    registros.filter((r) => dentroDoCooldown(r)).map((r) => r.chave)
  );
}

export async function contarBloqueadas(): Promise<number> {
  const registros = await lerHistorico();
  return registros.filter((r) => dentroDoCooldown(r)).length;
}

async function salvarRegistro(
  oferta: OfertaHistoricoInput,
  tipo: "visto" | "enviado"
): Promise<void> {
  const registros = await lerHistorico();
  const chave = chaveOferta(oferta);
  const existente = registros.find((r) => r.chave === chave);
  const agora = new Date().toISOString();

  const novo: RegistroHistoricoOferta = {
    ...existente,
    chave,
    plataforma: plataformaCanonica(oferta.plataforma),
    produtoId: oferta.produtoId,
    titulo: oferta.titulo,
    precoAtual: oferta.precoAtual,
    descontoPercentual: oferta.descontoPercentual,
    vistoEm: tipo === "visto" ? agora : existente?.vistoEm,
    enviadoEm: tipo === "enviado" ? agora : existente?.enviadoEm
  };

  const semDuplicado = registros.filter((r) => r.chave !== chave);
  semDuplicado.push(novo);

  const limiteAntigo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentes = semDuplicado
    .filter((r) => {
      const enviado = timestamp(r.enviadoEm);
      const visto = timestamp(r.vistoEm);
      const ultimo = Math.max(
        Number.isFinite(enviado) ? enviado : 0,
        Number.isFinite(visto) ? visto : 0
      );
      return ultimo >= limiteAntigo;
    })
    .slice(-1000);

  await gravarHistorico(recentes);
}

export async function registrarOfertaVista(
  oferta: OfertaHistoricoInput
): Promise<void> {
  await salvarRegistro(oferta, "visto");
}

export async function registrarOfertaEnviada(
  oferta: OfertaHistoricoInput
): Promise<void> {
  await salvarRegistro(oferta, "enviado");
}

export async function limparHistoricoOfertas(): Promise<void> {
  await gravarHistorico([]);
}
