import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Oferta } from "../fontes/types.js";

const CAMINHO_PADRAO = "data/ultima-oferta-mercadolivre.json";

type OfertaPersistida = Omit<Oferta, "encontradoEm"> & {
  encontradoEm?: string | Date;
};

function hostMercadoLivre(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "mercadolivre.com.br" ||
    host.endsWith(".mercadolivre.com.br") ||
    host === "mercadolivre.com" ||
    host.endsWith(".mercadolivre.com")
  );
}

function hostMeli(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "meli.la" || host.endsWith(".meli.la");
}

export function normalizarLinkAfiliadoMercadoLivre(valor: string): string {
  const recebido = valor.trim();
  if (!recebido) {
    throw new Error("Cole o link gerado pelo Gerador de Links do Mercado Livre.");
  }

  let url: URL;
  try {
    url = new URL(recebido);
  } catch {
    throw new Error("O link informado não é uma URL válida.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Use somente links HTTPS gerados pelo Mercado Livre.");
  }

  const encurtado = hostMeli(url.hostname);
  const compartilhamentoOficial =
    hostMercadoLivre(url.hostname) &&
    /^\/sec(?:\/|$)/i.test(url.pathname);

  if (!encurtado && !compartilhamentoOficial) {
    throw new Error(
      "Cole o link oficial de afiliado gerado pelo Mercado Livre (meli.la ou /sec/)."
    );
  }

  url.hash = "";
  return url.toString();
}

export async function lerOfertaMercadoLivre(
  caminho = CAMINHO_PADRAO
): Promise<Oferta> {
  const texto = await readFile(caminho, "utf8").catch(() => {
    throw new Error(
      "Nenhuma oferta do Mercado Livre foi encontrada. Busque uma oferta primeiro."
    );
  });

  const dados = JSON.parse(texto.replace(/^\uFEFF/, "")) as OfertaPersistida;
  if (!dados.produtoId || !dados.titulo || !dados.urlProduto) {
    throw new Error("A oferta salva do Mercado Livre está incompleta.");
  }

  const encontradoEm = dados.encontradoEm
    ? new Date(dados.encontradoEm)
    : new Date();

  return {
    ...dados,
    encontradoEm: Number.isNaN(encontradoEm.getTime())
      ? new Date()
      : encontradoEm
  };
}

export async function salvarLinkAfiliadoMercadoLivre(
  valor: string,
  caminho = CAMINHO_PADRAO
): Promise<Oferta> {
  const link = normalizarLinkAfiliadoMercadoLivre(valor);
  const oferta = await lerOfertaMercadoLivre(caminho);
  const atualizada: Oferta = {
    ...oferta,
    urlAfiliado: link
  };

  await mkdir(dirname(caminho), { recursive: true });
  await writeFile(caminho, JSON.stringify(atualizada, null, 2), "utf8");
  return atualizada;
}
