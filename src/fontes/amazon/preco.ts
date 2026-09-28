export function parsePrecoBR(valor?: string | null): number | undefined {
  if (!valor) return undefined;

  const normalizado = valor
    .replace(/\s/g, "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.]/g, "");

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : undefined;
}

export function calcularDesconto(
  atual?: number,
  anterior?: number
): number | undefined {
  if (!atual || !anterior || anterior <= atual) return undefined;
  return Math.round(((anterior - atual) / anterior) * 100);
}
