export interface AutoEnvioConfig {
  enabled: boolean;
  delayMs: number;
}

export function lerConfigAutoEnvio(
  env: NodeJS.ProcessEnv = process.env
): AutoEnvioConfig {
  const enabled = env.WHATSAPP_AUTO_SEND_ENABLED === "true";
  const valor = Number(env.WHATSAPP_AUTO_SEND_DELAY_MS ?? 1500);
  const delayMs = Number.isFinite(valor)
    ? Math.max(500, Math.min(30_000, Math.round(valor)))
    : 1500;

  return { enabled, delayMs };
}

export function deveAutoEnviar(
  agora: number,
  prontoEm: number,
  config: AutoEnvioConfig,
  jaTentou: boolean
): boolean {
  return (
    config.enabled &&
    !jaTentou &&
    agora - prontoEm >= config.delayMs
  );
}
