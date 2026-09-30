const TAXAS: Array<{ termos: RegExp; taxa: number }> = [
  { termos: /\b(bebe|bebê)\b/i, taxa: 13 },
  { termos: /beleza|cosmetico|cosmético|maquiagem|perfume/i, taxa: 13 },
  { termos: /saude|saúde|cuidados pessoais|higiene/i, taxa: 13 },
  { termos: /alimentos?|comida|mercearia/i, taxa: 13 },
  { termos: /audiolivro/i, taxa: 13 },
  { termos: /roupas?|moda|vestuario|vestuário/i, taxa: 11 },
  { termos: /pet|pet shop/i, taxa: 11 },
  { termos: /livros?|livro digital/i, taxa: 10 },
  { termos: /echo|fire tv|kindle|dispositivos? amazon/i, taxa: 9.5 },
  { termos: /casa|cozinha|ferramentas?|eletrodomestico|eletrodoméstico/i, taxa: 8 },
  { termos: /brinquedos?|esportes?|moveis|móveis|jardim|piscina/i, taxa: 8 },
  { termos: /eletronicos?|eletrônicos|informatica|informática/i, taxa: 8 },
  { termos: /papelaria|escritorio|escritório|celular|games?|tv|audio|áudio/i, taxa: 8 },
  { termos: /bolsas?|malas?|mochilas?|calcados?|calçados|joias?|jóias|relogios?|relógios/i, taxa: 7 },
  { termos: /automotivo|industrial|cientifico|científico/i, taxa: 7 }
];

export function estimarComissaoAmazon(categoria?: string): number {
  const valor = categoria?.trim() ?? "";
  const encontrada = TAXAS.find(({ termos }) => termos.test(valor));
  return encontrada?.taxa ?? 7;
}
export function pesoBuscaPorComissao(taxa: number): number {
  if (taxa >= 13) return 4;
  if (taxa >= 11) return 3;
  if (taxa >= 9.5) return 2;
  return 1;
}

export function bonusComissao(taxa: number): number {
  if (taxa >= 13) return 45;
  if (taxa >= 11) return 38;
  if (taxa >= 10) return 34;
  if (taxa >= 9.5) return 32;
  if (taxa >= 8) return 25;
  if (taxa >= 7) return 20;
  return 0;
}
