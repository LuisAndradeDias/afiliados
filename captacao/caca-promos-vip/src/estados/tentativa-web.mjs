/**
 * Transições de tentativas de convite via WhatsApp Web.
 * Somente estado: não grava arquivos, não consulta contatos, não envia.
 * O chamador mantém consentimento, confirmações humanas e limites diários.
 */
export function proximoStatusTentativaWeb(status, evento, { invalidada = false } = {}) {
  switch (evento) {
    case 'reservar':
      // Idempotente: uma falha repetida não libera tentativa reservada.
      return status === 'aberto' ? 'incerto' : status;

    case 'confirmar':
    case 'conciliar-enviado':
      if (status !== 'incerto') {
        throw new Error('Não há tentativa incerta para confirmar.');
      }
      return 'enviado-manualmente';

    case 'conciliar-nao-enviado':
      if (status !== 'incerto') {
        throw new Error('Não há tentativa incerta para conciliar.');
      }
      // A tentativa antiga continua inválida após nova autorização.
      // O retorno a pendente jamais dispara uma mensagem por si só.
      return invalidada ? 'ignorado' : 'pendente';

    default:
      throw new Error('Evento desconhecido para tentativa WhatsApp.');
  }
}
