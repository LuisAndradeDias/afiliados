/** Erros de acesso não são ausência de ofertas nem esgotamento de estoque. */
export class MercadoLivreAcessoNegado extends Error {
  readonly code = "MERCADOLIVRE_PERMISSION_REQUIRED";
  constructor(readonly recurso: string) {
    super("Mercado Livre HTTP 403: acesso negado ao recurso " + recurso +
      ". A rodada foi interrompida; verifique as permissoes da aplicacao.");
    this.name = "MercadoLivreAcessoNegado";
  }
}
export function lerRetryAfterMs(valor: string | null, agora = Date.now()): number {
  if (!valor?.trim()) return 0;
  const texto = valor.trim();
  const atraso = /^\d+(?:\.\d+)?$/.test(texto)
    ? Math.ceil(Number(texto) * 1000)
    : Math.max(0, Date.parse(texto) - agora);
  return Number.isSafeInteger(atraso) && atraso >= 0 &&
    Number.isSafeInteger(agora + atraso) ? atraso : 0;
}
export class MercadoLivreLimiteApi extends Error {
  readonly code = "MERCADOLIVRE_RATE_LIMIT";
  constructor(readonly retryAfterMs: number) {
    super("Mercado Livre HTTP 429: limite de requisicoes; retry_after_ms=" + retryAfterMs +
      ". Rodada interrompida sem repetir chamadas.");
    this.name = "MercadoLivreLimiteApi";
  }
}
