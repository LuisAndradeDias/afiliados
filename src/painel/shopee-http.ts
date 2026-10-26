import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import { criarRepositorioShopee, ErroRascunhoShopee } from "./shopee-rascunhos.js";

type RotaShopee = {
  req: IncomingMessage;
  res: ServerResponse;
  pathname: string;
  raiz: string;
};

const repositorios = new Map<string, ReturnType<typeof criarRepositorioShopee>>();
const MAX_CORPO = 12 * 1024;

function json(res: ServerResponse, code: number, obj: unknown): void {
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  });
  res.end(JSON.stringify(obj));
}

function origemLocalAutorizada(req: IncomingMessage): boolean {
  const host = req.headers.host ?? "";
  const origin = req.headers.origin ?? "";
  if (!/^(?:localhost|127\.0\.0\.1):\d{1,5}$/.test(host)) return false;
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  try {
    const referencia = new URL(origin);
    return referencia.protocol === "http:" &&
      referencia.host === host &&
      referencia.username === "" && referencia.password === "";
  } catch { return false; }
}

async function lerCorpo(req: IncomingMessage): Promise<unknown> {
  if (!/^application\/json\s*(?:;|$)/i.test(req.headers["content-type"] ?? "")) {
    throw new ErroRascunhoShopee("Envie dados no formato JSON.", 415);
  }
  const blocos: Buffer[] = [];
  let tamanho = 0;
  for await (const parte of req) {
    const atual = Buffer.isBuffer(parte) ? parte : Buffer.from(parte);
    tamanho += atual.length;
    if (tamanho > MAX_CORPO) {
      throw new ErroRascunhoShopee("Rascunho excede o limite permitido.", 413);
    }
    blocos.push(atual);
  }
  try { return JSON.parse(Buffer.concat(blocos).toString("utf8")); }
  catch { throw new ErroRascunhoShopee("JSON inválido."); }
}

export async function responderRotaShopee({
  req, res, pathname, raiz
}: RotaShopee): Promise<boolean> {
  if (!pathname.startsWith("/api/shopee/")) return false;
  const file = resolve(raiz, "data", "shopee-rascunhos.json");
  let repo = repositorios.get(file);
  if (!repo) {
    repo = criarRepositorioShopee(file);
    repositorios.set(file, repo);
  }

  if (req.method === "GET" && pathname === "/api/shopee/status") {
    json(res, 200, {
      ok: true, conta: "aguardando",
      apiAtiva: false, modo: "manual",
      mesmoGrupoFuturo: true, envioAutomatico: false
    });
    return true;
  }
  if (req.method === "GET" && pathname === "/api/shopee/rascunhos") {
    try { json(res, 200, { ok: true, rascunhos: await repo.listar() }); }
    catch { json(res, 500, { ok: false, mensagem: "Rascunhos locais indisponíveis." }); }
    return true;
  }

  const idMatch = /^\/api\/shopee\/rascunhos\/([0-9a-f-]{36})$/.exec(pathname);
  if ((req.method === "POST" && pathname === "/api/shopee/rascunhos") ||
      (req.method === "DELETE" && idMatch !== null)) {
    if (!origemLocalAutorizada(req)) {
      json(res, 403, { ok: false, mensagem: "Operação permitida somente nesta Central local." });
      return true;
    }
    try {
      if (req.method === "POST") {
        const item = await repo.salvar(await lerCorpo(req));
        json(res, 201, { ok: true, rascunho: item });
      } else {
        const excluido = await repo.excluir(idMatch![1]);
        json(res, excluido ? 200 : 404, { ok: excluido });
      }
    } catch (error) {
      const esperado = error instanceof ErroRascunhoShopee;
      json(res, esperado ? error.statusCode : 500, {
        ok: false, mensagem: esperado ? error.message : "Erro ao salvar o rascunho local."
      });
    }
    return true;
  }

  return false;
}
