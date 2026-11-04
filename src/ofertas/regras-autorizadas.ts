/**
 * Regras de negócio explicitamente preservadas após a limpeza de 04/11/2026.
 *
 * Estes valores não devem ser alterados por handoffs, auditorias ou sugestões
 * automáticas. Mudanças futuras exigem pedido/aprovação explícita do proprietário.
 */

export const DESCONTO_MINIMO_PERCENTUAL = 20;
export const COOLDOWN_ENVIO_HORAS = 24;
export const COOLDOWN_PREVIA_MINUTOS = 120;

export const CONSULTAS_AMAZON_AUTORIZADAS = [
  "beleza",
  "saude e cuidados pessoais",
  "bebe",
  "alimentos",
  "pet shop",
  "roupas",
  "livros",
  "echo",
  "fire tv",
  "kindle",
  "casa",
  "cozinha",
  "ferramentas",
  "eletronicos",
  "informatica",
  "brinquedos",
  "escritorio",
  "limpeza"
] as const;

export const CONSULTAS_MERCADOLIVRE_AUTORIZADAS = [
  "beleza",
  "pet",
  "roupas",
  "casa",
  "cozinha",
  "ferramentas",
  "eletronicos",
  "informatica",
  "brinquedos",
  "bebe",
  "escritorio",
  "limpeza",
  "smartphone",
  "notebook",
  "smart tv",
  "fone bluetooth",
  "air fryer"
] as const;
