import type { Locator, Page } from "playwright";
import { termoBuscaGrupoWhatsapp } from "./whatsapp-grupo.js";

export type EstadoDestinoWhatsapp =
  | "grupo-pronto" | "grupo-nao-localizado" | "identidade-divergente"
  | "compositor-ausente" | "busca-ausente" | "interacao-falhou";

function nomeNormalizado(valor: string): string {
  return termoBuscaGrupoWhatsapp(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function caixaBusca(page: Page): Promise<Locator | null> {
  const candidatos = [
    page.getByRole("textbox", { name: /pesquisar|search/i }),
    page.locator('#side div[contenteditable="true"][role="textbox"]'),
    page.locator('#pane-side div[contenteditable="true"][role="textbox"]'),
    page.locator('div[contenteditable="true"][data-tab="3"]')
  ];
  const limite = Date.now() + 7_000;
  while (Date.now() < limite && !page.isClosed()) {
    for (const locator of candidatos) {
      if (await locator.first().isVisible().catch(() => false)) {
        return locator.first();
      }
    }
    await page.waitForTimeout(250);
  }
  return null;
}

/** Nao copia dados de conversa e nao preenche nem clica em Enviar. */
export async function verificarDestinoWhatsapp(
  page: Page,
  nomeExato: string
): Promise<EstadoDestinoWhatsapp> {
  if (page.isClosed() || !nomeExato.trim()) return "busca-ausente";
  console.log("DESTINO_VERIFICACAO:AGUARDANDO_BUSCA");
  const busca = await caixaBusca(page);
  if (!busca) return "busca-ausente";

  try {
    await busca.fill(termoBuscaGrupoWhatsapp(nomeExato), { timeout: 8_000 });
  } catch {
    console.warn("DESTINO_VERIFICACAO:BUSCA_NAO_INTERATIVA");
    return "busca-ausente";
  }
  console.log("DESTINO_VERIFICACAO:BUSCA_PREENCHIDA");
  // Nome do grupo pode variar apenas em emojis, espacos ou maiusculas.
  // Exigir correspondencia normalizada UNICA e revalidar o cabecalho,
  // jamais selecionar um contato por substring.
  const sidebar = page.locator("#side, #pane-side").first();
  const titulos = sidebar.locator("[title]");
  const identidade = nomeNormalizado(nomeExato);
  let correspondente: Locator | null = null;
  const limite = Date.now() + 9_000;
  while (Date.now() < limite) {
    // Coletar uma fotografia atomica do DOM: centenas de chamadas individuais
    // em pagina com lista virtualizada podem ficar presas em elementos reciclados.
    const instantaneo = await titulos.evaluateAll((nodes) => {
      const itens: Array<{ nome: string; visivel: boolean }> = [];
      for (const node of nodes) {
        const nome = node.getAttribute("title");
        if (nome) itens.push({
          nome,
          visivel: node.getClientRects().length > 0
        });
      }
      return itens;
    }).catch(() => []);
    const unicos = instantaneo.filter(item =>
      item.visivel && nomeNormalizado(item.nome) === identidade
    );
    if (unicos.length > 1) return "grupo-nao-localizado";
    if (unicos.length === 1) {
      const titulosExatos = sidebar.getByTitle(unicos[0]!.nome, { exact: true });
      const total = await titulosExatos.count();
      for (let i = 0; i < total; i++) {
        const alvo = titulosExatos.nth(i);
        if (await alvo.isVisible().catch(() => false)) {
          correspondente = alvo;
          break;
        }
      }
      if (correspondente) break;
    }
    await page.waitForTimeout(350);
  }
  if (!correspondente) return "grupo-nao-localizado";

  // A coluna de resultados pode interceptar cliques em spans internos;
  // priorizar a linha clicavel que o proprio WhatsApp declara.
  const linha = correspondente.locator(
    'xpath=ancestor::*[@role="button" or @tabindex="0"][1]'
  );
  const alvo = await linha.count() > 0 ? linha.first() : correspondente;
  console.log("DESTINO_VERIFICACAO:CANDIDATO_UNICO");
  try {
    await alvo.click({ timeout: 7_000 });
  } catch {
    console.warn("DESTINO_VERIFICACAO:INTERACAO_FALHOU");
    return "interacao-falhou";
  }
  console.log("DESTINO_VERIFICACAO:ABERTURA_SOLICITADA");
  const header = page.locator("#main header").first();
  const abriu = await header.waitFor({ state: "visible", timeout: 7_000 })
    .then(() => true).catch(() => false);
  if (!abriu) return "identidade-divergente";
  const nomesAbertos = await header.locator("[title]").evaluateAll(
    nodes => nodes.map(node => node.getAttribute("title"))
  );
  const confirmado = nomesAbertos.some(value =>
    typeof value === "string" && nomeNormalizado(value) === identidade
  ) || await header.getByText(nomeExato, { exact: true })
    .isVisible().catch(() => false);
  if (!confirmado) return "identidade-divergente";

  const compositor = page.locator(
    '#main footer [contenteditable="true"][role="textbox"], ' +
    '#main footer div[contenteditable="true"]'
  ).first();
  if (!(await compositor.isVisible().catch(() => false))) {
    return "compositor-ausente";
  }
  return "grupo-pronto";
}
