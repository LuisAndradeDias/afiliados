/**
 * Mantem o nome real do grupo (inclusive os emojis) para confirmar o destino,
 * mas digita somente o nome legivel no campo de busca do WhatsApp Web.
 */
export function termoBuscaGrupoWhatsapp(nomeGrupo: string): string {
  const textoSemEmoji = nomeGrupo
    .replace(
      /\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|[\uFE0E\uFE0F\u200D\u20E3]/gu,
      ""
    )
    .replace(/\s+/gu, " ")
    .trim();

  return textoSemEmoji || nomeGrupo.trim();
}
