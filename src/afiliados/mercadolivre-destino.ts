import { normalizarLinkAfiliadoMercadoLivre } from "./mercadolivre.js";

export type EstadoDestino = "confirmado" | "inconclusivo" | "divergente";
export interface AuditoriaDestinoLink {
  estado: EstadoDestino;
  motivo: string;
  saltos: number;
  /** Atribuicao de comissao so pode ser confirmada nos relatorios oficiais. */
  atribuicaoComprovada: false;
}
interface OpcoesAuditoria {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maxSaltos?: number;
}

function permitido(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return url.protocol === "https:" && !url.username &&
    !url.password && !url.port &&
    (host === "meli.la" ||
      host === "mercadolivre.com.br" ||
      host.endsWith(".mercadolivre.com.br") ||
      host === "mercadolivre.com" ||
      host.endsWith(".mercadolivre.com"));
}

function resultado(
  estado: EstadoDestino, motivo: string, saltos: number
): AuditoriaDestinoLink {
  return { estado, motivo, saltos, atribuicaoComprovada: false };
}

/**
 * Follows only public HTTPS redirects (HEAD, manual), without cookies,
 * browser profiles, credentials, form actions, checkout or purchase.
 * Never returns the affiliate URL or tracking parameters.
 * If a redirect is opaque or blocked, return "inconclusivo", never success.
 */
export async function auditarDestinoLinkMercadoLivre(
  link: string,
  produtoId: string,
  opcoes: OpcoesAuditoria = {}
): Promise<AuditoriaDestinoLink> {
  if (!/^MLB\d{5,}$/i.test(produtoId)) {
    return resultado("inconclusivo", "id do produto invalido", 0);
  }
  let url: URL;
  try {
    url = new URL(normalizarLinkAfiliadoMercadoLivre(link));
  } catch {
    return resultado("inconclusivo", "link nao possui formato de afiliado oficial", 0);
  }

  const fetcher = opcoes.fetcher ?? fetch;
  const maxSaltos = Math.max(0, Math.min(4, opcoes.maxSaltos ?? 3));
  const timeoutMs = Math.max(100, Math.min(5000, opcoes.timeoutMs ?? 2500));
  const vistos = new Set<string>();

  for (let saltos = 0; saltos <= maxSaltos; saltos++) {
    if (!permitido(url)) {
      return resultado("divergente", "redirecionamento para dominio nao permitido", saltos);
    }
    if (vistos.has(url.toString())) {
      return resultado("inconclusivo", "redirecionamento ciclico", saltos);
    }
    vistos.add(url.toString());

    // Aceita somente uma rota de produto, nunca /checkout/.../p/ID.
    const catalogo = url.pathname.match(/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)+\/)?p\/(MLB\d+)\/?$/i);
    if (catalogo) {
      return resultado(
        catalogo[1].toUpperCase() === produtoId.toUpperCase() ?
          "confirmado" : "divergente",
        catalogo[1].toUpperCase() === produtoId.toUpperCase() ?
          "redirecionamento identificou o mesmo catalogo" :
          "redirecionamento identificou catalogo diferente",
        saltos
      );
    }
    if (saltos === maxSaltos) {
      return resultado("inconclusivo", "limite de redirecionamentos atingido", saltos);
    }

    // HEAD pode ser recusado por encurtadores. Um GET publico e permitido
    // apenas como fallback, sem cookies e sem ler conteudo HTML ou executar JS.
    // Todos os saltos passam novamente pelo filtro de dominios antes do acesso.
    let proxima: URL | undefined;
    for (const method of ["HEAD", "GET"] as const) {
      let response: Response;
      try {
        response = await fetcher(url.toString(), {
          method,
          redirect: "manual",
          credentials: "omit",
          cache: "no-store",
          signal: AbortSignal.timeout(timeoutMs)
        });
      } catch {
        if (method === "HEAD") continue;
        return resultado("inconclusivo", "site nao permitiu validar redirecionamento", saltos);
      }
      await response.body?.cancel().catch(() => undefined);
      if (![301, 302, 303, 307, 308].includes(response.status)) {
        if (method === "HEAD") continue;
        return resultado("inconclusivo", "destino nao foi exposto por redirecionamento", saltos);
      }
      const location = response.headers.get("location");
      if (!location || location.length > 2500) {
        return resultado("inconclusivo", "resposta sem endereco de destino valido", saltos);
      }
      try {
        proxima = new URL(location, url);
      } catch {
        return resultado("inconclusivo", "endereco de destino invalido", saltos);
      }
      break;
    }
    if (!proxima) {
      return resultado("inconclusivo", "redirecionamento nao resolvido", saltos);
    }
    url = proxima;
  }
  return resultado("inconclusivo", "redirecionamento nao resolvido", maxSaltos);
}
