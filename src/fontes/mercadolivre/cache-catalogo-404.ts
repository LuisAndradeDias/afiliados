import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const TTL_MS = 30 * 60_000;
const MAX_ENTRIES = 500;

function catalogoValido(id: string): boolean {
  return /^MLB[A-Z0-9_-]{3,60}$/i.test(id);
}

/**
 * Guarda apenas IDs publicos cujo endpoint /products/{id} retornou 404.
 * Um 404 em /products/{id}/items nao invalida o vencedor do catalogo.
 * Versao 2 descarta caches antigos que confundiam os dois endpoints.
 * Jamais armazena dados de usuarios, tokens, precos ou resultados 429/403.
 */
export class CacheCatalogo404 {
  private readonly entries = new Map<string, number>();
  private carregado = false;
  private alterado = false;

  constructor(
    private readonly arquivo = resolve(
      process.env.MERCADOLIVRE_CATALOG_404_CACHE_PATH ??
        "data/mercadolivre-catalogo-404.json"
    ),
    private readonly agora: () => number = Date.now
  ) {}

  private valido(instante: number): boolean {
    const agora = this.agora();
    return Number.isFinite(instante) && instante > agora - TTL_MS && instante <= agora;
  }

  private async carregar(): Promise<void> {
    if (this.carregado) return;
    this.carregado = true;
    try {
      const texto = await readFile(this.arquivo, "utf8");
      const dados = JSON.parse(texto) as {
        versao?: unknown;
        entries?: Record<string, unknown>;
      };
      if (dados?.versao !== 2 || !dados.entries ||
          typeof dados.entries !== "object" || Array.isArray(dados.entries)) {
        return;
      }
      for (const [id, instante] of Object.entries(dados.entries).slice(0, MAX_ENTRIES)) {
        if (catalogoValido(id) && typeof instante === "number" &&
            this.valido(instante)) {
          this.entries.set(id, instante);
        }
      }
    } catch {
      // Arquivo ausente ou malformado: continuar a busca sem cache.
    }
  }

  async contem(id: string): Promise<boolean> {
    if (!catalogoValido(id)) return false;
    await this.carregar();
    const instante = this.entries.get(id);
    if (instante === undefined) return false;
    if (this.valido(instante)) return true;
    this.entries.delete(id);
    this.alterado = true;
    return false;
  }

  async registrar404(id: string): Promise<void> {
    if (!catalogoValido(id)) return;
    await this.carregar();
    this.entries.set(id, this.agora());
    this.alterado = true;
  }

  async persistir(): Promise<void> {
    if (!this.alterado) return;
    const recentes = [...this.entries.entries()]
      .filter(([, instante]) => this.valido(instante))
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_ENTRIES);
    const arquivoTemp = this.arquivo + "." +
      randomBytes(6).toString("hex") + ".tmp";
    try {
      await mkdir(dirname(this.arquivo), { recursive: true });
      await writeFile(arquivoTemp, JSON.stringify({
        versao: 2,
        entries: Object.fromEntries(recentes)
      }), { encoding: "utf8", mode: 0o600 });
      await rename(arquivoTemp, this.arquivo);
      this.alterado = false;
    } catch {
      console.warn("Mercado Livre: cache de catalogo indisponivel; consulta continua sem ele.");
    } finally {
      await rm(arquivoTemp, { force: true }).catch(() => undefined);
    }
  }
}
