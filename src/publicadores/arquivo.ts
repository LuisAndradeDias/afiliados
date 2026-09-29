import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Publicador } from "./types.js";

export class PublicadorArquivo implements Publicador {
  nome = "arquivo";

  constructor(
    private readonly caminho = "data/ultima-mensagem-whatsapp.txt"
  ) {}

  async publicar(mensagem: string): Promise<void> {
    await mkdir(dirname(this.caminho), { recursive: true });
    await writeFile(this.caminho, mensagem, "utf8");
    console.log(`Mensagem salva em ${this.caminho}`);
  }
}
