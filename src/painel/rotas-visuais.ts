/**
 * Rotas exclusivamente visuais da Central de Ofertas (3030).
 *
 * Este módulo NÃO importa estados de monitoramento, ações, tokens OAuth,
 * WhatsApp ou contatos. O servidor mantém a precedência de seus endpoints
 * de integração e chama a função somente para rotas de apresentação.
 */
import { readFile } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { resolve } from "node:path";

const ASSETS_PERMITIDOS: Readonly<Record<string, string>> = Object.freeze({
  "/central/assets/central.css": "central.css",
  "/central/assets/ofertas-v2.css": "ofertas-v2.css",
  "/central/assets/central.tokens.css": "central.tokens.css",
  "/central/assets/central.js": "central.js",
  "/central/assets/shopee.css": "shopee.css",
  "/central/assets/shopee.js": "shopee.js",
});

type RotaVisual = {
  method?: string;
  pathname: string;
  res: ServerResponse;
  raiz: string;
};

/** Devolve true somente quando uma rota visual foi respondida. */
export async function responderRotaVisual({
  method, pathname, res, raiz
}: RotaVisual): Promise<boolean> {
  if (method !== "GET") return false;
  const publicDir = resolve(raiz, "src", "painel", "public");

  if (pathname === "/shopee") {
    const html = await readFile(resolve(publicDir, "shopee.html"), "utf8");
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    });
    res.end(html);
    return true;
  }

  if (pathname === "/central") {
    const html = await readFile(resolve(publicDir, "central.html"), "utf8");
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    });
    res.end(html);
    return true;
  }

  if (pathname.startsWith("/central/assets/")) {
    // Chaves exatas: nunca servir um caminho arbitrário do disco C:.
    const assetName = Object.hasOwn(ASSETS_PERMITIDOS, pathname)
      ? ASSETS_PERMITIDOS[pathname]
      : undefined;
    if (!assetName) {
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, mensagem: "Recurso não encontrado." }));
      return true;
    }
    const content = await readFile(resolve(publicDir, assetName), "utf8");
    res.writeHead(200, {
      "content-type": assetName.endsWith(".css")
        ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    res.end(content);
    return true;
  }

  if (pathname === "/" || pathname === "/ofertas") {
    const html = await readFile(resolve(publicDir, "index.html"), "utf8");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
    return true;
  }

  return false;
}
