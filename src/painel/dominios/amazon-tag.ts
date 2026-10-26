/** Normalização e validação do ID de associado Amazon. Sem acesso a disco ou rede. */
export function normalizarTagAmazon(valor: string): string {
  const recebido = valor.trim();
  if (!recebido) return "";

  try {
    const url = new URL(recebido);
    const tag = url.searchParams.get("tag");
    if (tag) return tag.trim();
  } catch {
    // O operador informou somente a tag.
  }

  return recebido;
}

export function validarTagAmazon(tag: string): boolean {
  return /^[A-Za-z0-9_-]{3,64}$/.test(tag);
}
