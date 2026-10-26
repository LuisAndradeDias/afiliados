/**
 * Allowlist dos processos existentes de WhatsApp/Amazon/Mercado Livre.
 * Esta função não lança processo, abre navegador ou executa mensagens.
 */
const SCRIPTS_PERMITIDOS: ReadonlyMap<string, string> = new Map([
  ["buscar", "src/robo/whatsapp-preview.ts"],
  ["login", "src/robo/whatsapp-login.ts"],
  ["preparar", "src/robo/whatsapp-preparar.ts"],
  ["mercadolivre-login", "src/robo/mercadolivre-login.ts"],
  ["mercadolivre-buscar", "src/robo/mercadolivre-preview.ts"],
  ["mercadolivre-whatsapp", "src/robo/mercadolivre-whatsapp.ts"],
  ["automatico", "src/robo/automatico.ts"]
]);

export function arquivoDoRobo(nome: string): string {
  const arquivo = SCRIPTS_PERMITIDOS.get(nome);
  if (!arquivo) throw new Error(`Ação desconhecida: ${nome}`);
  return arquivo;
}
