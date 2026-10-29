import { chromium, type BrowserContext } from "playwright";
import { normalizarLinkAfiliadoMercadoLivre } from "./mercadolivre.js";

export interface AuditoriaDestinoNavegador {
  estado: "confirmado" | "inconclusivo" | "divergente";
  motivo: string;
  saltos: number;
  atribuicaoComprovada: false;
}

interface OpcoesNavegador {
  timeoutMs?: number;
  esperaMs?: number;
  // So usado por testes isolados. O servidor nunca passa fixtures.
  prepararFixtures?: (context: BrowserContext) => Promise<void> | void;
}

function resposta(
  estado: AuditoriaDestinoNavegador["estado"],
  motivo: string,
  saltos: number
): AuditoriaDestinoNavegador {
  return { estado, motivo, saltos, atribuicaoComprovada: false };
}

function hostOficial(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "meli.la" ||
    host === "mercadolivre.com.br" ||
    host.endsWith(".mercadolivre.com.br") ||
    host === "mercadolivre.com" ||
    host.endsWith(".mercadolivre.com");
}

function hostRecursoOficial(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return hostOficial(host) || host === "mlstatic.com" ||
    host.endsWith(".mlstatic.com");
}

function rotaRisco(path: string): boolean {
  return /(?:^|\/)(?:checkout|cart|carrinho|purchase|comprar|payment|pagamento|orders?|pedidos?)(?:\/|$)/i
    .test(path);
}

function idCatalogo(path: string): string | null {
  const match = path.match(
    /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)+\/)?p\/(MLB\d+)\/?$/i
  );
  return match ? match[1].toUpperCase() : null;
}

/**
 * Valida apenas o catalogo final em Chrome isolado e temporario.
 * Nao utiliza perfil, cookies, tokens ou sessao do Chrome do usuario.
 * Nao registra URL, query, conteudo HTML, screenshots ou dados pessoais.
 * Nao comprova atribuicao de comissao, estoque ou elegibilidade.
 */
export async function auditarDestinoLinkMercadoLivreNavegador(
  link: string,
  produtoId: string,
  opcoes: OpcoesNavegador = {}
): Promise<AuditoriaDestinoNavegador> {
  if (!/^MLB\d{5,}$/i.test(produtoId)) {
    return resposta("inconclusivo", "NAVEGADOR_PRODUTO_INVALIDO", 0);
  }

  let linkOficial: URL;
  try {
    linkOficial = new URL(normalizarLinkAfiliadoMercadoLivre(link));
    if (linkOficial.protocol !== "https:" ||
        !hostOficial(linkOficial.hostname) ||
        linkOficial.username || linkOficial.password || linkOficial.port ||
        rotaRisco(linkOficial.pathname)) {
      throw new Error("link nao autorizado");
    }
  } catch {
    return resposta("inconclusivo", "NAVEGADOR_LINK_INVALIDO", 0);
  }

  const timeoutMs = Math.max(2000, Math.min(15000, opcoes.timeoutMs ?? 10500));
  const esperaMs = Math.max(0, Math.min(2500, opcoes.esperaMs ?? 1500));
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let saltos = 0;
  let destinoExternoBloqueado = false;
  let rotaBloqueada = false;
  let navegacaoLimitada = false;
  let ultimoStatusDocumento = 0;

  try {
    browser = await chromium.launch({
      channel: "chrome",
      headless: true,
      timeout: timeoutMs,
      args: ["--disable-background-networking", "--no-first-run"]
    });
    const context = await browser.newContext({
      acceptDownloads: false,
      serviceWorkers: "block",
      ignoreHTTPSErrors: false,
      javaScriptEnabled: true,
      permissions: [],
      viewport: { width: 1000, height: 700 }
    });
    if (opcoes.prepararFixtures) await opcoes.prepararFixtures(context);

    const page = await context.newPage();
    page.on("dialog", dialog => { void dialog.dismiss().catch(() => undefined); });
    page.on("popup", popup => { void popup.close().catch(() => undefined); });
    page.on("response", response => {
      try {
        const request = response.request();
        if (request.isNavigationRequest() &&
            request.frame() === page.mainFrame()) {
          ultimoStatusDocumento = response.status();
        }
      } catch {
        // O navegador pode cancelar uma navegacao durante um redirect.
      }
    });

    await context.route("**/*", async route => {
      const request = route.request();
      let url: URL;
      try {
        url = new URL(request.url());
      } catch {
        await route.abort().catch(() => undefined);
        return;
      }

      let documentoPrincipal = false;
      try {
        documentoPrincipal = request.isNavigationRequest() &&
          request.frame() === page.mainFrame();
      } catch {
        // Requisicoes sem frame principal nao sao navegacao de documento.
      }

      const permitido = url.protocol === "https:" &&
        !url.username && !url.password && !url.port &&
        hostRecursoOficial(url.hostname) &&
        !rotaRisco(url.pathname) &&
        ["GET", "HEAD"].includes(request.method());

      if (!permitido || (documentoPrincipal && !hostOficial(url.hostname))) {
        if (documentoPrincipal && !hostOficial(url.hostname)) {
          destinoExternoBloqueado = true;
        }
        if (documentoPrincipal && rotaRisco(url.pathname)) {
          rotaBloqueada = true;
        }
        await route.abort().catch(() => undefined);
        return;
      }

      if (documentoPrincipal) {
        saltos++;
        if (saltos > 6) {
          navegacaoLimitada = true;
          await route.abort().catch(() => undefined);
          return;
        }
      }
      await route.fallback().catch(() => undefined);
    });

    await page.goto(linkOficial.toString(), {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs
    }).catch(() => null);
    if (esperaMs) await page.waitForTimeout(esperaMs);

    if (destinoExternoBloqueado) {
      return resposta("inconclusivo", "NAVEGADOR_DESTINO_EXTERNO_BLOQUEADO", saltos);
    }
    if (rotaBloqueada) {
      return resposta("inconclusivo", "NAVEGADOR_CAMINHO_COMPRA_BLOQUEADO", saltos);
    }
    if (navegacaoLimitada) {
      return resposta("inconclusivo", "NAVEGADOR_LIMITE_NAVEGACAO", saltos);
    }

    let urlFinal: URL;
    try {
      urlFinal = new URL(page.url());
    } catch {
      return resposta("inconclusivo", "NAVEGADOR_SEM_DESTINO_FINAL", saltos);
    }
    if (!hostOficial(urlFinal.hostname) ||
        urlFinal.hostname === "meli.la" ||
        ultimoStatusDocumento < 200 || ultimoStatusDocumento >= 300) {
      return resposta("inconclusivo", "NAVEGADOR_RESPOSTA_NAO_CONFIRMADA", saltos);
    }

    const idUrl = idCatalogo(urlFinal.pathname);
    // Canonical serve como indicio apenas em paginas oficiais e com HTTP 2xx.
    const canonical = await page.locator('link[rel="canonical"]').first()
      .getAttribute("href", { timeout: 1200 }).catch(() => null);
    let idCanonical: string | null = null;
    if (canonical) {
      try {
        const c = new URL(canonical, urlFinal);
        if (c.protocol === "https:" && hostOficial(c.hostname) &&
            c.hostname !== "meli.la" &&
            !c.username && !c.password && !c.port) {
          idCanonical = idCatalogo(c.pathname);
        }
      } catch {
        // Ignorar canonical malformada ou nao oficial.
      }
    }

    const esperado = produtoId.toUpperCase();
    if (idUrl && idUrl !== esperado) {
      return resposta("divergente", "NAVEGADOR_CATALOGO_DIVERGENTE", saltos);
    }
    if (idUrl === esperado || idCanonical === esperado) {
      return resposta("confirmado", "NAVEGADOR_CATALOGO_CORRESPONDENTE", saltos);
    }
    if (idCanonical && idCanonical !== esperado) {
      return resposta("divergente", "NAVEGADOR_CATALOGO_DIVERGENTE", saltos);
    }
    return resposta("inconclusivo", "NAVEGADOR_SEM_ID_CATALOGO", saltos);
  } catch {
    return resposta("inconclusivo", "NAVEGADOR_INDISPONIVEL_OU_TIMEOUT", saltos);
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}
