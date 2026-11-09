/**
 * Aguarda o campo de pesquisa de conversas do WhatsApp Web.
 * Uma espera GLOBAL, não sequencial por seletores, para suportar carregamento
 * lento do input real e do contenteditable antigo.
 * Nenhuma interação aqui envia mensagens ou seleciona destinatários.
 */
import type { Locator, Page } from "playwright";

export async function localizarBuscaWhatsapp(
  page: Page,
  timeoutMs = 90_000
): Promise<Locator> {
  // Limitar ao painel de conversas: nunca confundir com o compositor no rodapé.
  const campo = page.locator([
    '[data-testid="chat-list-search-container"] input',
    '#side input[role="textbox"][data-tab="3"]',
    '#side input[aria-label*="pesquisar" i]',
    '#side input[placeholder*="pesquisar" i]',
    '#side input[aria-label*="search" i]',
    '#side input[placeholder*="search" i]',
    '#side [contenteditable="true"][role="textbox"][data-tab="3"]',
    '#side [contenteditable="true"][role="textbox"][aria-label*="pesquisar" i]',
    '#side [contenteditable="true"][role="textbox"][aria-label*="search" i]'
  ].join(", ")).first();

  try {
    await campo.waitFor({ state: "visible", timeout: Math.max(100, timeoutMs) });
    return campo;
  } catch {
    throw new Error(
      "O WhatsApp Web não apresentou o campo de pesquisa de conversas. " +
      "Verifique se a sessão está autenticada, se a lista de chats carregou " +
      "e se a conexão está estável. Nenhuma mensagem foi enviada."
    );
  }
}

/**
 * O layout atual exibe nomes sem atributo title. Aceitar somente nome EXATO
 * dentro da lista de conversas, nunca no painel de mensagens.
 */
export async function localizarGrupoWhatsapp(
  page: Page,
  nomeGrupo: string,
  timeoutMs = 12_000
): Promise<Locator> {
  const alvo = nomeGrupo.trim();
  if (!alvo) throw new Error("Grupo WhatsApp não configurado.");
  const lista = page.locator("#side");
  const item = lista.getByTitle(alvo, { exact: true })
    .or(lista.getByText(alvo, { exact: true })).first();
  try {
    await item.waitFor({ state: "visible", timeout: Math.max(100,timeoutMs) });
    return item;
  } catch {
    throw new Error(
      "O grupo WhatsApp configurado não apareceu com nome exato na pesquisa. " +
      "Não será escolhida uma conversa parecida e nenhuma mensagem foi enviada."
    );
  }
}

/** Recusa a preparação caso o cabeçalho não confirme o destino exato. */
export async function confirmarGrupoAbertoWhatsapp(
  page: Page,
  nomeGrupo: string,
  timeoutMs = 10_000
): Promise<void> {
  const alvo = nomeGrupo.trim();
  if(!alvo)throw new Error("Grupo WhatsApp não configurado.");
  const cabecalho = page.locator("#main header")
    .getByText(alvo, {exact:true}).first();
  try{
    await cabecalho.waitFor({state:"visible",timeout:Math.max(100,timeoutMs)});
  }catch{
    throw new Error(
      "O cabeçalho não confirmou o grupo WhatsApp configurado. " +
      "Preparação interrompida antes de enviar qualquer mensagem."
    );
  }
}
