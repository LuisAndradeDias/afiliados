export function parsePrecoBR(valor?: string | null): number | undefined {
  if (!valor) return undefined;

  const normalizado = valor
    .replace(/\s/g, "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.]/g, "");

  if (!/[0-9]/.test(normalizado)) return undefined;
  const numero = Number(normalizado);
  return Number.isFinite(numero) && numero > 0 ? numero : undefined;
}

export function calcularDesconto(
  atual?: number,
  anterior?: number
): number | undefined {
  if (
    !Number.isFinite(atual) ||
    !Number.isFinite(anterior) ||
    !atual ||
    !anterior ||
    atual <= 0 ||
    anterior <= atual
  ) {
    return undefined;
  }

  const percentual = ((anterior - atual) / anterior) * 100;
  // Referencias acima de 90% exigem comprovacao independente: os cards
  // da Amazon podem confundir o preco do produto com o preco por kg/litro.
  if (percentual > 90) return undefined;
  // Arredonda sempre para baixo para nao anunciar desconto maior que o real.
  return Math.floor(percentual);
}
