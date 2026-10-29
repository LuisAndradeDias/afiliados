import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Etapa 57: uma configuracao local NAO autoriza um canal por omissao.
 * Os registros sao evidencia de revisao, nao comprovacao de comissao.
 * Sem registro valido e atual o fluxo de publicacao falha fechado.
 */
export type PlataformaCanal = "mercado-livre" | "amazon" | "shopee";
export type EstadoElegibilidadeCanal =
  | "elegivel"
  | "pendente-verificacao"
  | "nao-elegivel"
  | "suspenso"
  | "necessita-revisao";

export interface DiagnosticoElegibilidadeCanal {
  estado: EstadoElegibilidadeCanal;
  codigo: string;
  motivo: string;
  podePublicar: boolean;
}

interface ConsultaCanal {
  grupo: string;
  plataforma?: string;
  agora?: Date;
}

const VALIDADE_REGRA_MS = 30 * 24 * 60 * 60 * 1_000;
const CAMINHO_REGISTROS = resolve("data", "elegibilidade-canais.json");

function resultado(
  estado: EstadoElegibilidadeCanal,
  codigo: string,
  motivo: string
): DiagnosticoElegibilidadeCanal {
  return {
    estado,
    codigo,
    motivo,
    podePublicar: estado === "elegivel"
  };
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? valor as Record<string, unknown>
    : null;
}

export function identificarPlataformaCanal(
  plataforma?: string
): PlataformaCanal | null {
  const texto = (plataforma ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  if (texto === "mercado livre" || texto === "meli") return "mercado-livre";
  if (texto === "amazon" || texto === "amazon brasil") return "amazon";
  if (texto === "shopee") return "shopee";
  return null;
}

function dominioRegraConfiavel(url: unknown, plataforma: PlataformaCanal): boolean {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    const oficiais: Record<PlataformaCanal, string[]> = {
      "mercado-livre": ["mercadolivre.com.br", "mercadolibre.com"],
      amazon: ["associados.amazon.com.br", "affiliate-program.amazon.com"],
      shopee: ["shopee.com.br"]
    };
    return oficiais[plataforma].some(
      (dominio) => host === dominio || host.endsWith("." + dominio)
    );
  } catch {
    return false;
  }
}

function dataRecente(iso: unknown, agora: Date): boolean {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(iso)) return false;
  const momento = Date.parse(iso);
  const referencia = agora.getTime();
  return Number.isFinite(momento) &&
    Number.isFinite(referencia) &&
    momento <= referencia &&
    referencia - momento <= VALIDADE_REGRA_MS;
}

export function avaliarElegibilidadeCanal(
  registros: unknown,
  consulta: ConsultaCanal
): DiagnosticoElegibilidadeCanal {
  const plataforma = identificarPlataformaCanal(consulta.plataforma);
  if (!plataforma) {
    return resultado("pendente-verificacao", "PLATAFORMA_NAO_IDENTIFICADA",
      "Marketplace não identificado. A divulgação permanece bloqueada.");
  }
  if (!consulta.grupo?.trim()) {
    return resultado("pendente-verificacao", "DESTINO_NAO_CONFIGURADO",
      "Grupo de destino não configurado.");
  }

  const raiz = objeto(registros);
  if (raiz?.versao !== 1 || !Array.isArray(raiz.registros)) {
    return resultado("necessita-revisao", "CADASTRO_CANAIS_INVALIDO",
      "Cadastro de canais inválido. Confira a estrutura sem iniciar publicações.");
  }

  const nomeExato = consulta.grupo.trim().normalize("NFC");
  const encontrados = raiz.registros
    .map(objeto)
    .filter((canal) =>
      canal?.destino === nomeExato && canal?.plataforma === plataforma
    );

  if (encontrados.length === 0) {
    return resultado("pendente-verificacao", "CANAL_NAO_HOMOLOGADO",
      "Este grupo ainda não possui homologação para o marketplace da oferta.");
  }
  if (encontrados.length !== 1) {
    return resultado("necessita-revisao", "REGISTROS_DUPLICADOS",
      "Há registros repetidos para o mesmo destino e marketplace.");
  }

  const registro = encontrados[0]!;
  const homologacao = objeto(registro.homologacao);
  const regra = objeto(registro.regraOficial);

  if (registro.tipo !== "whatsapp-grupo") {
    return resultado("necessita-revisao", "TIPO_CANAL_NAO_VALIDADO",
      "Tipo de destino ainda não coberto pela política de WhatsApp.");
  }
  if (registro.visibilidade === "privado") {
    return resultado("nao-elegivel", "CANAL_PRIVADO_NAO_PERMITIDO",
      "Grupo privado não foi considerado elegível para divulgação de afiliados.");
  }
  if (registro.visibilidade !== "publico") {
    return resultado("pendente-verificacao", "VISIBILIDADE_NAO_COMPROVADA",
      "Não há confirmação suficiente de que o grupo seja público e aberto.");
  }
  if (homologacao?.estado === "suspenso") {
    return resultado("suspenso", "CANAL_SUSPENSO",
      "Homologação suspensa. Nenhuma publicação será preparada.");
  }
  if (regra?.permiteDivulgacao === false) {
    return resultado("nao-elegivel", "REGRA_OFICIAL_PROIBE",
      "A regra registrada não permite esta modalidade de divulgação.");
  }
  if (registro.autorizadoPeloResponsavel !== true ||
      registro.declaradoNoPrograma !== true) {
    return resultado("pendente-verificacao", "AUTORIZACAO_INCOMPLETA",
      "É necessário confirmar autorização do destino e cadastro no programa.");
  }
  if (homologacao?.estado !== "homologado" ||
      typeof homologacao.responsavel !== "string" ||
      !homologacao.responsavel.trim()) {
    return resultado("pendente-verificacao", "HOMOLOGACAO_PENDENTE",
      "A revisão formal do canal ainda não foi registrada.");
  }
  if (regra?.permiteDivulgacao !== true ||
      regra.conflitoEsclarecido !== true) {
    return resultado("necessita-revisao", "REGRA_INCONCLUSIVA",
      "As regras oficiais ou suas divergências ainda não foram esclarecidas.");
  }
  if (!dominioRegraConfiavel(regra.url, plataforma)) {
    return resultado("necessita-revisao", "FONTE_OFICIAL_NAO_VALIDADA",
      "A referência da política comercial não utiliza domínio oficial permitido.");
  }
  const agora = consulta.agora ?? new Date();
  if (!dataRecente(regra.verificadaEm, agora) ||
      !dataRecente(homologacao.aprovadaEm, agora)) {
    return resultado("necessita-revisao", "HOMOLOGACAO_DESATUALIZADA",
      "A verificação da regra ou a homologação precisa ser renovada.");
  }
  return resultado("elegivel", "CANAL_HOMOLOGADO",
    "Canal e marketplace com homologação registrada e recente.");
}

export async function consultarElegibilidadeCanalWhatsapp(
  consulta: ConsultaCanal,
  caminho = CAMINHO_REGISTROS
): Promise<DiagnosticoElegibilidadeCanal> {
  let texto: string;
  try {
    texto = await readFile(caminho, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return resultado("pendente-verificacao", "CANAL_NAO_HOMOLOGADO",
        "Nenhum cadastro de canais homologados foi encontrado.");
    }
    return resultado("necessita-revisao", "CADASTRO_CANAIS_INACESSIVEL",
      "Não foi possível consultar a elegibilidade do destino.");
  }

  try {
    return avaliarElegibilidadeCanal(JSON.parse(texto) as unknown, consulta);
  } catch {
    return resultado("necessita-revisao", "CADASTRO_CANAIS_INVALIDO",
      "O cadastro de canais contém dados inválidos.");
  }
}
