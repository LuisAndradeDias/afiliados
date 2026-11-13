/** 403 significa acesso negado, nao ausencia de estoque ou ofertas. */
export interface DiagnosticoNegacaoMeli {
  /** Codigo documentado e explicitamente reconhecido; nunca copiar texto arbitrario da API. */
  codigo?: "FORBIDDEN" | "PA_UNAUTHORIZED_RESULT_FROM_POLICIES";
  erro?: "access_denied" | "forbidden" | "Invalid scopes";
  politica?: "PolicyAgent";
  requestId?: string;
}

const codigosConhecidos = new Set(["FORBIDDEN", "PA_UNAUTHORIZED_RESULT_FROM_POLICIES"]);
const errosConhecidos = new Set(["access_denied", "forbidden", "Invalid scopes"]);

/** Extrai somente campos nao sensiveis de uma negacao; ignora valores desconhecidos. */
export function diagnosticarNegacaoMeli403(
  corpo: string,
  headerRequestId: string | null
): DiagnosticoNegacaoMeli {
  const requestId = headerRequestId?.trim();
  const seguro = requestId && /^[A-Za-z0-9._:-]{6,128}$/.test(requestId)
    ? requestId : undefined;
  let dados: Record<string, unknown> = {};
  try {
    const bruto: unknown = JSON.parse(corpo.slice(0, 4096));
    if (bruto && typeof bruto === "object" && !Array.isArray(bruto)) {
      dados = bruto as Record<string, unknown>;
    }
  } catch {
    // Corpo malformado nao altera a classificacao do HTTP 403.
  }
  const codigo = typeof dados.code === "string" && codigosConhecidos.has(dados.code)
    ? dados.code as DiagnosticoNegacaoMeli["codigo"] : undefined;
  const erro = typeof dados.error === "string" && errosConhecidos.has(dados.error)
    ? dados.error as DiagnosticoNegacaoMeli["erro"] : undefined;
  return {
    ...(codigo ? { codigo } : {}),
    ...(erro ? { erro } : {}),
    ...(dados.blocked_by === "PolicyAgent" ? { politica: "PolicyAgent" as const } : {}),
    ...(seguro ? { requestId: seguro } : {})
  };
}

export class MercadoLivreAcessoNegado extends Error {
  readonly code = "MERCADOLIVRE_PERMISSION_REQUIRED";
  constructor(
    readonly recurso: string,
    readonly diagnostico: DiagnosticoNegacaoMeli = {}
  ) {
    const metadados = [
      diagnostico.codigo ? "codigo=" + diagnostico.codigo : "",
      diagnostico.erro ? "erro=" + diagnostico.erro : "",
      diagnostico.politica ? "politica=" + diagnostico.politica : "",
      diagnostico.requestId ? "request_id=" + diagnostico.requestId : ""
    ].filter(Boolean);
    super("Mercado Livre HTTP 403: acesso negado ao recurso " + recurso +
      ". Rodada interrompida sem repetir requisicao. " +
      (metadados.length ? "Metadados seguros: " + metadados.join("; ") + ". " : "") +
      "A causa funcional precisa de verificacao no DevCenter ou suporte.");
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
