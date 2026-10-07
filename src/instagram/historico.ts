import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Oferta } from "../fontes/types.js";
import type {
  ClassificacaoInstagram
} from "./classificador.js";

export interface RegistroInstagram {
  chave: string;
  plataforma: string;
  produtoId: string;
  titulo: string;
  classificacao: ClassificacaoInstagram;
  score: number;
  geradoEm: string;
}

export interface CooldownInstagram {
  bloquearTudo: boolean;
  permitirReel: boolean;
  motivo?: string;
}

export function diretorioInstagram(): string {
  return process.env.INSTAGRAM_DATA_DIR?.trim() ||
    "data/instagram";
}

function caminhoHistorico(): string {
  return resolve(diretorioInstagram(), "historico.json");
}

function plataformaCanonica(valor?: string): string {
  const normalizada = (valor ?? "desconhecida")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalizada.includes("amazon")) return "amazon";
  if (normalizada.includes("mercado-livre")) {
    return "mercado-livre";
  }

  return normalizada || "desconhecida";
}

export function chaveInstagram(
  oferta: Pick<Oferta, "plataforma" | "produtoId">
): string {
  return `${plataformaCanonica(oferta.plataforma)}:${oferta.produtoId}`
    .toLowerCase();
}

async function lerHistorico(): Promise<RegistroInstagram[]> {
  try {
    const texto = await readFile(
      caminhoHistorico(),
      "utf8"
    );
    const dados = JSON.parse(
      texto.replace(/^\uFEFF/, "")
    );
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

function timestamp(valor?: string): number {
  if (!valor) return Number.NaN;
  return new Date(valor).getTime();
}

export async function verificarCooldownInstagram(
  oferta: Pick<Oferta, "plataforma" | "produtoId">
): Promise<CooldownInstagram> {
  const registros = await lerHistorico();
  const chave = chaveInstagram(oferta);
  const agora = Date.now();
  const storyDias = Number(
    process.env.INSTAGRAM_STORY_COOLDOWN_DAYS ?? 3
  );
  const reelDias = Number(
    process.env.INSTAGRAM_REEL_COOLDOWN_DAYS ?? 14
  );

  const doProduto = registros
    .filter((registro) => registro.chave === chave)
    .sort(
      (a, b) =>
        timestamp(b.geradoEm) - timestamp(a.geradoEm)
    );

  const ultimo = doProduto[0];
  if (!ultimo) {
    return {
      bloquearTudo: false,
      permitirReel: true
    };
  }

  const ultimoEm = timestamp(ultimo.geradoEm);
  if (!Number.isFinite(ultimoEm)) {
    return {
      bloquearTudo: false,
      permitirReel: true
    };
  }

  const storyMs =
    Math.max(1, storyDias) * 24 * 60 * 60 * 1000;
  if (ultimoEm >= agora - storyMs) {
    return {
      bloquearTudo: true,
      permitirReel: false,
      motivo: `produto já gerou conteúdo nos últimos ${storyDias} dias`
    };
  }

  const ultimoReel = doProduto.find(
    (registro) =>
      registro.classificacao === "premium" ||
      registro.classificacao === "destaque"
  );
  const ultimoReelEm = timestamp(
    ultimoReel?.geradoEm
  );
  const reelMs =
    Math.max(1, reelDias) * 24 * 60 * 60 * 1000;

  return {
    bloquearTudo: false,
    permitirReel:
      !Number.isFinite(ultimoReelEm) ||
      ultimoReelEm < agora - reelMs,
    motivo:
      Number.isFinite(ultimoReelEm) &&
      ultimoReelEm >= agora - reelMs
        ? `Reel do produto em cooldown de ${reelDias} dias; somente Story permitido`
        : undefined
  };
}

export async function registrarConteudoInstagram(
  oferta: Oferta,
  classificacao: ClassificacaoInstagram,
  score: number
): Promise<void> {
  const caminho = caminhoHistorico();
  const registros = await lerHistorico();
  const novo: RegistroInstagram = {
    chave: chaveInstagram(oferta),
    plataforma: plataformaCanonica(
      oferta.plataforma
    ),
    produtoId: oferta.produtoId,
    titulo: oferta.titulo,
    classificacao,
    score,
    geradoEm: new Date().toISOString()
  };

  const limite =
    Date.now() - 180 * 24 * 60 * 60 * 1000;
  const recentes = [...registros, novo]
    .filter(
      (registro) =>
        timestamp(registro.geradoEm) >= limite
    )
    .slice(-1500);

  await mkdir(dirname(caminho), {
    recursive: true
  });
  await writeFile(
    caminho,
    JSON.stringify(recentes, null, 2),
    "utf8"
  );
}
