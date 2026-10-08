import { randomBytes } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Oferta } from "../fontes/types.js";

const CAMINHO = "data/historico-ofertas.json";
const CAMINHO_TRAVA = "data/historico-ofertas.lock";
const UM_DIA = 24 * 60 * 60 * 1000;

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
  return (plataformaCanonica(oferta.plataforma) + ":" + oferta.produtoId).toLowerCase();
}

export function cooldownHoras(): number {
  const valor = Number(process.env.OFFER_COOLDOWN_HOURS ?? 168);
  return Number.isFinite(valor) && valor > 0 ? valor : 168;
}

export function previewCooldownMinutos(): number {
  const valor = Number(process.env.OFFER_PREVIEW_COOLDOWN_MINUTES ?? 120);
  return Number.isFinite(valor) && valor > 0 ? valor : 120;
}

const palavrasGenericas = new Set([
  "a", "as", "o", "os", "um", "uma", "e", "de", "do", "da", "dos", "das",
  "com", "sem", "para", "por", "em", "na", "no", "nas", "nos", "mais",
  "modelo", "original", "produto", "novo", "nova", "kit", "conjunto",
  "cor", "versao", "unidades", "unidade", "pecas", "oferta"
]);

export function normalizarTituloProduto(titulo: string): string {
  return titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function palavrasRelevantes(titulo: string): Set<string> {
  return new Set(
    normalizarTituloProduto(titulo)
      .split(" ")
      .filter((token) =>
        token.length >= 3 &&
        !palavrasGenericas.has(token)
      )
      .concat(
        normalizarTituloProduto(titulo)
          .split(" ")
          .filter((token) => /^\d+$/.test(token))
      )
  );
}

function especificacoesNumericas(tokens: Set<string>): string[] {
  return [...tokens].filter((token) => /\d/.test(token)).sort();
}

/**
 * Compara o produto principal, não apenas o ID/ASIN do anúncio.
 * Conserva números de modelo, tamanho e capacidade para não confundir variantes.
 */
export function mesmoProdutoHistorico(
  primeira: OfertaHistoricoInput,
  segunda: OfertaHistoricoInput
): boolean {
  if (
    primeira.produtoId &&
    segunda.produtoId &&
    chaveOferta(primeira) === chaveOferta(segunda)
  ) return true;

  const tituloA = normalizarTituloProduto(primeira.titulo);
  const tituloB = normalizarTituloProduto(segunda.titulo);
  if (tituloA.length < 8 || tituloB.length < 8) return false;
  if (tituloA === tituloB) return true;

  const palavrasA = palavrasRelevantes(tituloA);
  const palavrasB = palavrasRelevantes(tituloB);
  const numerosA = especificacoesNumericas(palavrasA);
  const numerosB = especificacoesNumericas(palavrasB);

  if (
    numerosA.length > 0 && numerosB.length > 0 &&
    numerosA.join("|") !== numerosB.join("|")
  ) return false;

  const emComum = [...palavrasA].filter((palavra) => palavrasB.has(palavra)).length;
  const menor = Math.min(palavrasA.size, palavrasB.size);
  const uniao = new Set([...palavrasA, ...palavrasB]).size;

  // Requer ao menos quatro palavras significativas em comum e alta
  // correspondência com o nome mais curto; evita bloquear itens genéricos.
  return emComum >= 4 && menor > 0 &&
    emComum / menor >= 0.78 &&
    emComum / uniao >= 0.56;
}

async function lerHistorico(): Promise<RegistroHistoricoOferta[]> {
  let texto: string;
  try {
    texto = await readFile(CAMINHO, "utf8");
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new Error("Histórico de ofertas indisponível: não é seguro liberar novos envios.", {
      cause: erro
    });
  }

  try {
    const dados: unknown = JSON.parse(texto.replace(/^\uFEFF/, ""));
    if (!Array.isArray(dados) ||
        !dados.every((item) =>
          typeof item === "object" && item !== null &&
          typeof item.chave === "string" &&
          typeof item.titulo === "string"
        )) {
      throw new Error("formato inesperado");
    }
    return dados as RegistroHistoricoOferta[];
  } catch (erro) {
    throw new Error(
      "Histórico de ofertas inválido. Envio bloqueado para evitar publicação repetida.",
      { cause: erro }
    );
  }
}

async function gravarHistorico(registros: RegistroHistoricoOferta[]): Promise<void> {
  await mkdir(dirname(CAMINHO), { recursive: true });
  const temporario = CAMINHO + "." + process.pid + "." +
    randomBytes(6).toString("hex") + ".tmp";
  try {
    await writeFile(temporario, JSON.stringify(registros, null, 2), "utf8");
    await rename(temporario, CAMINHO);
  } finally {
    await rm(temporario, { force: true });
  }
}

async function comTravaHistorico<T>(funcao: () => Promise<T>): Promise<T> {
  await mkdir(dirname(CAMINHO_TRAVA), { recursive: true });
  const fim = Date.now() + 12_000;

  while (Date.now() < fim) {
    try {
      const trava = await open(CAMINHO_TRAVA, "wx");
      try {
        return await funcao();
      } finally {
        await trava.close();
        await rm(CAMINHO_TRAVA, { force: true });
      }
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code !== "EEXIST") throw erro;
      const informacoes = await stat(CAMINHO_TRAVA).catch(() => null);
      if (informacoes && Date.now() - informacoes.mtimeMs > 90_000) {
        await rm(CAMINHO_TRAVA, { force: true });
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Histórico de ofertas ocupado; envio bloqueado por segurança.");
}

function timestamp(valor?: string): number {
  if (!valor) return Number.NaN;
  return new Date(valor).getTime();
}

function enviadoRecentemente(registro: RegistroHistoricoOferta): boolean {
  const enviado = timestamp(registro.enviadoEm);
  return Number.isFinite(enviado) &&
    enviado >= Date.now() - cooldownHoras() * 60 * 60 * 1000;
}

function dentroDoCooldown(registro: RegistroHistoricoOferta): boolean {
  const visto = timestamp(registro.vistoEm);
  return enviadoRecentemente(registro) ||
    (Number.isFinite(visto) &&
      visto >= Date.now() - previewCooldownMinutos() * 60 * 1000);
}

export async function chavesBloqueadas(): Promise<Set<string>> {
  const registros = await lerHistorico();
  return new Set(
    registros.filter((registro) => dentroDoCooldown(registro)).map((registro) => registro.chave)
  );
}

export async function contarBloqueadas(): Promise<number> {
  const registros = await lerHistorico();
  return registros.filter((registro) => dentroDoCooldown(registro)).length;
}

/** Últimas postagens confirmadas, usadas somente para diversificar o grupo. */
export async function ultimasOfertasEnviadas(limite = 5): Promise<RegistroHistoricoOferta[]> {
  const registros = await lerHistorico();
  return registros
    .filter((registro) => registro.enviadoEm && Number.isFinite(Date.parse(registro.enviadoEm)))
    .sort((a, b) => Date.parse(b.enviadoEm!) - Date.parse(a.enviadoEm!))
    .slice(0, Math.max(0, Math.trunc(limite)));
}

/** Usado na seleção das duas plataformas, inclusive anúncios com IDs diferentes. */
export async function filtroHistoricoOfertas(): Promise<
  (oferta: OfertaHistoricoInput) => boolean
> {
  const registros = (await lerHistorico()).filter((registro) => dentroDoCooldown(registro));
  return (oferta) => registros.some((registro) =>
    mesmoProdutoHistorico(oferta, registro)
  );
}

/**
 * Checagem feita imediatamente antes do clique em Enviar.
 * Uma simples visualização da própria oferta NÃO conta como envio.
 */
export async function ofertaJaEnviadaRecentemente(
  oferta: OfertaHistoricoInput
): Promise<boolean> {
  const registros = await lerHistorico();
  return registros.some((registro) =>
    enviadoRecentemente(registro) &&
    mesmoProdutoHistorico(oferta, registro)
  );
}

async function salvarRegistro(
  oferta: OfertaHistoricoInput,
  tipo: "visto" | "enviado"
): Promise<void> {
  await comTravaHistorico(async () => {
    const registros = await lerHistorico();
    const chave = chaveOferta(oferta);
    const existente = registros.find((registro) => registro.chave === chave);
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

    const semDuplicado = registros.filter((registro) => registro.chave !== chave);
    semDuplicado.push(novo);

    const limiteAntigo = Date.now() - 30 * UM_DIA;
    const recentes = semDuplicado
      .filter((registro) => {
        const enviado = timestamp(registro.enviadoEm);
        const visto = timestamp(registro.vistoEm);
        const ultimo = Math.max(
          Number.isFinite(enviado) ? enviado : 0,
          Number.isFinite(visto) ? visto : 0
        );
        return ultimo >= limiteAntigo;
      })
      .slice(-1000);

    await gravarHistorico(recentes);
  });
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
  await comTravaHistorico(() => gravarHistorico([]));
}
