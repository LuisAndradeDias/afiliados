import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const CAMINHO = "data/rotacao-categorias.json";

interface EstadoRotacao {
  indice: number;
}

export async function lerIndiceRotacao(total: number): Promise<number> {
  if (total <= 0) return 0;

  try {
    const texto = await readFile(CAMINHO, "utf8");
    const estado = JSON.parse(texto.replace(/^\uFEFF/, "")) as EstadoRotacao;
    const indice = Number(estado.indice);
    if (!Number.isFinite(indice)) return 0;
    return ((Math.trunc(indice) % total) + total) % total;
  } catch {
    return 0;
  }
}
export async function salvarIndiceRotacao(
  indice: number,
  total: number
): Promise<void> {
  if (total <= 0) return;

  const normalizado = ((Math.trunc(indice) % total) + total) % total;
  await mkdir(dirname(CAMINHO), { recursive: true });
  await writeFile(
    CAMINHO,
    JSON.stringify({ indice: normalizado }, null, 2),
    "utf8"
  );
}
