import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class ErroRascunhoShopee extends Error {
  constructor(mensagem: string, readonly statusCode = 400) {
    super(mensagem);
    this.name = "ErroRascunhoShopee";
  }
}

export interface RascunhoShopee {
  id: string;
  titulo: string;
  urlAfiliado: string;
  preco: number | null;
  origem: "manual";
  status: "rascunho";
  criadoEm: string;
}

export type NovoRascunhoShopee = Pick<RascunhoShopee, "titulo" | "urlAfiliado" | "preco">;

export function validarLinkShopee(input: unknown): string {
  if (typeof input !== "string" || input.length > 2048) {
    throw new ErroRascunhoShopee("Informe um link HTTPS da Shopee válido.");
  }
  let url: URL;
  try { url = new URL(input.trim()); } catch {
    throw new ErroRascunhoShopee("Link da Shopee inválido.");
  }
  const host = url.hostname.toLowerCase();
  const dominioPermitido = host === "shopee.com.br" ||
    host.endsWith(".shopee.com.br") || host === "shope.ee";
  if (!dominioPermitido || url.protocol !== "https:" ||
      url.username !== "" || url.password !== "" ||
      url.port !== "" || url.pathname === "/") {
    throw new ErroRascunhoShopee("Use um link HTTPS de produto ou loja da Shopee.");
  }
  return url.toString();
}

export function validarRascunhoShopee(input: unknown): NovoRascunhoShopee {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ErroRascunhoShopee("Dados do rascunho inválidos.");
  }
  const dados = input as Record<string, unknown>;
  const titulo = typeof dados.titulo === "string"
    ? dados.titulo.trim().replace(/\s+/g, " ") : "";
  if (titulo.length < 3 || titulo.length > 120 ||
      /[\x00-\x1f\x7f]/.test(titulo)) {
    throw new ErroRascunhoShopee("Informe um título entre 3 e 120 caracteres.");
  }
  if (dados.confirmado !== true) {
    throw new ErroRascunhoShopee(
      "Confirme que o link foi gerado no seu portal de afiliado Shopee."
    );
  }
  const urlAfiliado = validarLinkShopee(dados.url ?? dados.urlAfiliado);
  let preco: number | null = null;
  if (dados.preco !== undefined && dados.preco !== null &&
      dados.preco !== "") {
    const texto = String(dados.preco).trim();
    if (!/^\d{1,6}([.,]\d{1,2})?$/.test(texto)) {
      throw new ErroRascunhoShopee("Preço inválido. Use um valor em reais.");
    }
    preco = Number(texto.replace(",", "."));
    if (!Number.isFinite(preco) || preco <= 0 || preco > 999999.99) {
      throw new ErroRascunhoShopee("Preço inválido. Informe um valor positivo.");
    }
  }
  return { titulo, urlAfiliado, preco };
}

function erroArquivo(): ErroRascunhoShopee {
  return new ErroRascunhoShopee(
    "Não foi possível ler o arquivo local de rascunhos Shopee.", 500
  );
}

export function criarRepositorioShopee(caminho: string) {
  let pendente: Promise<unknown> = Promise.resolve();

  async function ler(): Promise<RascunhoShopee[]> {
    let texto: string;
    try { texto = await readFile(caminho, "utf8"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw erroArquivo();
    }
    try {
      const dados: unknown = JSON.parse(texto);
      if (typeof dados !== "object" || dados === null || Array.isArray(dados)) {
        throw Error("formato");
      }
      const registro = dados as { versao?: unknown; rascunhos?: unknown };
      if (registro.versao !== 1 || !Array.isArray(registro.rascunhos) ||
          registro.rascunhos.length > 100 ||
          registro.rascunhos.some((x: unknown) => {
            if (!x || typeof x !== "object") return true;
            const item = x as RascunhoShopee;
            return typeof item.id !== "string" ||
              typeof item.titulo !== "string" ||
              typeof item.urlAfiliado !== "string";
          })) throw Error("formato");
      return registro.rascunhos as RascunhoShopee[];
    } catch { throw erroArquivo(); }
  }

  async function gravar(items: RascunhoShopee[]): Promise<void> {
    const temporario = caminho + "." + randomUUID() + ".tmp";
    try {
      await mkdir(dirname(caminho), { recursive: true });
      await writeFile(temporario, JSON.stringify({
        versao: 1, rascunhos: items
      }, null, 2), { encoding: "utf8", mode: 0o600 });
      await rename(temporario, caminho);
    } finally {
      await rm(temporario, { force: true }).catch(() => undefined);
    }
  }

  function serializar<T>(fn: () => Promise<T>): Promise<T> {
    const result = pendente.then(fn);
    pendente = result.catch(() => undefined);
    return result;
  }

  return {
    listar: () => serializar(ler),
    salvar: (entrada: unknown) => serializar(async () => {
      const dados = validarRascunhoShopee(entrada);
      const atual = await ler();
      if (atual.some(item => item.urlAfiliado === dados.urlAfiliado)) {
        throw new ErroRascunhoShopee("Este link já está cadastrado.");
      }
      if (atual.length >= 100) {
        throw new ErroRascunhoShopee("Limite local de 100 rascunhos atingido.", 409);
      }
      const item: RascunhoShopee = {
        id: randomUUID(), ...dados, origem: "manual",
        status: "rascunho", criadoEm: new Date().toISOString()
      };
      await gravar([item, ...atual]);
      return item;
    }),
    excluir: (id: string) => serializar(async () => {
      const atual = await ler();
      const novos = atual.filter(item => item.id !== id);
      if (novos.length === atual.length) return false;
      await gravar(novos);
      return true;
    })
  };
}
