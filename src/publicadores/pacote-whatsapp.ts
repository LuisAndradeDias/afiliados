import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Oferta } from "../fontes/types.js";

export interface PacoteWhatsapp {
  mensagem: string;
  imagemUrl?: string;
  produtoId: string;
  titulo: string;
  urlProduto: string;
  urlAfiliado?: string;
}

export async function salvarPacoteWhatsapp(
  oferta: Oferta,
  mensagem: string,
  caminho = "data/ultima-oferta-whatsapp.json"
): Promise<void> {
  const pacote: PacoteWhatsapp = {
    mensagem,
    imagemUrl: oferta.imagem,
    produtoId: oferta.produtoId,
    titulo: oferta.titulo,
    urlProduto: oferta.urlProduto,
    urlAfiliado: oferta.urlAfiliado
  };

  await mkdir(dirname(caminho), { recursive: true });
  await writeFile(caminho, JSON.stringify(pacote, null, 2), "utf8");
}
