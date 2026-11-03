import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Journal sem dados de grupo, contato ou mensagem.
 * Falha fechada: arquivo inacessivel ou invalido e tratado como pendente.
 */
export function criarPendenciaWhatsapp(arquivo: string) {
  return {
    async pendente(): Promise<boolean> {
      let raw: string;
      try { raw = await readFile(arquivo, "utf8"); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        return true;
      }
      // Qualquer arquivo existente, inclusive truncado, exige conferencia.
      // Nao precisamos expor o conteudo para saber que o ultimo envio e incerto.
      return true;
    },
    async marcar(): Promise<void> {
      await mkdir(dirname(arquivo), { recursive: true });
      const temporario = arquivo + "." + randomUUID() + ".tmp";
      try {
        await writeFile(temporario, JSON.stringify({
          versao: 1,
          tipo: "envio-nao-confirmado",
          registradoEm: new Date().toISOString()
        }), { encoding: "utf8", mode: 0o600 });
        await rename(temporario, arquivo);
      } finally {
        await rm(temporario, { force: true }).catch(() => undefined);
      }
    },
    async limpar(): Promise<void> {
      await rm(arquivo, { force: true });
    }
  };
}
