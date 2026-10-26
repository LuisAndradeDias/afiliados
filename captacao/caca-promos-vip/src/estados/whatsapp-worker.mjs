/**
 * Avaliação pura do ciclo de vida do Chrome WhatsApp supervisionado.
 * Não interpreta confirmação como envio por si só. O controller mantém
 * a reserva persistida ANTES do clique e registra confirmação só por DOM.
 */
const FASES_FINAIS = new Set(['confirmado','cancelado','erro','incerto']);
const FASES_CANCELAVEIS = new Set(['iniciando','abrindo','pronto']);

export function classificarFalhaWorker({ tentouEnviar = false, jaPreparou = false } = {}) {
  return tentouEnviar || jaPreparou ? 'incerto' : 'erro';
}

export function faseOcupadaWhatsapp(fase, processoAtivo) {
  return Boolean(processoAtivo && !FASES_FINAIS.has(fase));
}

export function podeCancelarWhatsapp(fase) {
  return FASES_CANCELAVEIS.has(fase);
}
