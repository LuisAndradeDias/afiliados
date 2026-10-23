/** Categorias hist�ricas do projeto, independentes do .env do computador antigo. */
export const CONSULTAS_PADRAO_MERCADOLIVRE = ["fone bluetooth","smartphone samsung","headset gamer","air fryer","caixa de som bluetooth","notebook","mouse sem fio","smart tv","teclado mecanico","tablet","smartwatch","cafeteira","ssd","monitor gamer","controle gamer","aspirador de po","webcam","liquidificador","ventilador","roteador","power bank","microondas","lampada inteligente","geladeira","maquina de lavar","ar condicionado"] as const;

/** Respeita as consultas personalizadas, mas evita procurar s� "smartphone"
 * quando as configura��es privadas n�o vieram do PC anterior. */
export function consultasMercadoLivre(env: NodeJS.ProcessEnv = process.env): string[] {
  const recebido = env.MERCADOLIVRE_QUERIES?.trim() ||
    env.MERCADOLIVRE_QUERY?.trim();
  const origem = recebido ? recebido.split(",") : [...CONSULTAS_PADRAO_MERCADOLIVRE];
  const vistos = new Set<string>();
  return origem
    .map(x => x.trim())
    .filter(x => {
      const chave = x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (!chave || chave.length > 70 || vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    })
    .slice(0, 30);
}
