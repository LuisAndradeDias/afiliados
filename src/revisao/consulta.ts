import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import {
  consultarElegibilidadeCanalWhatsapp,
  identificarPlataformaCanal,
  type DiagnosticoElegibilidadeCanal
} from "../canais/elegibilidade.js";

/** Etapa 58/1: fotografia somente leitura de arquivos comerciais existentes. */
export type EstadoEvidencia = "registrada" | "pendente" | "expirada" |
  "divergente" | "nao-informada";

export interface EvidenciaRevisao {
  criterio: "identidade" | "preco" | "disponibilidade" | "cupom" |
    "link" | "atribuicao" | "canal";
  estado: EstadoEvidencia;
  codigo: string;
  descricao: string;
  verificadaEm?: string;
}

export interface FichaRevisao {
  id: string;
  origem: "preparacao-whatsapp" | "registro-mercado-livre";
  plataforma: string;
  produtoId: string;
  anuncioId?: string;
  vendedorId?: number;
  titulo: string;
  arquivoAtualizadoEm: string;
  precoObservado?: number;
  moeda: "BRL";
  evidencias: EvidenciaRevisao[];
  decisao: {
    estado: "bloqueada" | "necessita-revisao";
    podePublicar: false;
    motivos: { codigo: string; descricao: string }[];
    regraVersao: 1;
  };
}

export interface PainelRevisao {
  modo: "somente-leitura";
  consultadoEm: string;
  resumo: {
    candidatos: number;
    bloqueados: number;
    necessitamRevisao: number;
    aprovados: 0;
  };
  fichas: FichaRevisao[];
  avisos: string[];
}

type OrigemArquivo = FichaRevisao["origem"];
type EntradaArquivo = { origem: OrigemArquivo; dado: unknown; atualizadoEm: string };
const DEZ_MINUTOS = 10 * 60_000;
const MAX_ARQUIVO_BYTES = 128 * 1024;

function registro(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? v as Record<string, unknown> : null;
}

function texto(v: unknown, max: number): string {
  return typeof v === "string"
    ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max)
    : "";
}

function instanteRecente(v: unknown, agora: Date, limite = DEZ_MINUTOS): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(v)) return null;
  const t = Date.parse(v);
  if (!Number.isFinite(t) || t > agora.getTime() || agora.getTime() - t > limite) return null;
  return new Date(t).toISOString();
}

function precoBRL(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return undefined;
  const centavos = Math.round(v * 100);
  if (Math.abs(v * 100 - centavos) > 0.0001) return undefined;
  return centavos / 100;
}

function linkOficialAparente(v: unknown, plataforma: string): boolean {
  if (typeof v !== "string" || v.length > 2048) return false;
  try {
    const url = new URL(v);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    if (url.pathname === "/" || !url.pathname) return false;
    const host = url.hostname.toLowerCase();
    const dominio = (d: string) => host === d || host.endsWith("." + d);
    if (plataforma === "Mercado Livre") {
      return dominio("mercadolivre.com.br") || dominio("mercadolibre.com") || host === "meli.la";
    }
    if (plataforma === "Amazon") {
      return dominio("amazon.com.br") || host === "amzn.to";
    }
    if (plataforma === "Shopee") {
      return dominio("shopee.com.br");
    }
  } catch { return false; }
  return false;
}

function adicionar(
  fichas: EvidenciaRevisao[],
  criterio: EvidenciaRevisao["criterio"],
  estado: EstadoEvidencia,
  codigo: string,
  descricao: string,
  verificadaEm?: string
): void {
  fichas.push({
    criterio, estado, codigo, descricao,
    ...(verificadaEm ? { verificadaEm } : {})
  });
}

export function criarFichaRevisao(
  entrada: EntradaArquivo,
  canal: DiagnosticoElegibilidadeCanal,
  agora = new Date()
): FichaRevisao | null {
  const dado = registro(entrada.dado);
  if (!dado) return null;
  const plataformaRaw = texto(dado.plataforma, 60);
  const key = identificarPlataformaCanal(plataformaRaw);
  const plataforma = key === "mercado-livre" ? "Mercado Livre" :
    key === "amazon" ? "Amazon" : key === "shopee" ? "Shopee" : null;
  const produtoId = texto(dado.produtoId, 48);
  const titulo = texto(dado.titulo, 180);
  if (!plataforma || !/^[\w-]{3,48}$/.test(produtoId) || !titulo) return null;

  const anuncioId = texto(dado.anuncioId, 48);
  const preco = precoBRL(dado.precoAtual);
  const vendedorId = typeof dado.vendedorId === "number" &&
    Number.isSafeInteger(dado.vendedorId) && dado.vendedorId > 0
      ? dado.vendedorId : undefined;
  const evidencias: EvidenciaRevisao[] = [];
  adicionar(evidencias, "identidade", "registrada", "IDENTIFICACAO_REGISTRADA",
    "Identificação presente no arquivo local; origem comercial não foi reconfirmada.");
  if (plataforma === "Mercado Livre" && !/^[A-Za-z]{3}\d{8,}$/.test(anuncioId)) {
    adicionar(evidencias, "disponibilidade", "pendente", "ANUNCIO_NAO_CONFIRMADO",
      "O anúncio exato ainda não foi comprovado.");
  }

  if (preco === undefined) {
    adicionar(evidencias, "preco", "pendente", "PRECO_SEM_VALOR_VALIDO",
      "Preço BRL não está disponível em formato confiável.");
  } else if (plataforma === "Mercado Livre") {
    const quando = instanteRecente(dado.precoContextoVerificadoEm, agora);
    if (dado.precoContextoStatus === "divergente") {
      adicionar(evidencias, "preco", "divergente", "PRECO_CONTEXTUAL_DIVERGENTE",
        "Preço do anúncio divergiu do contexto marketplace na última auditoria.");
    } else if (dado.precoContextoStatus === "coerente" && quando) {
      adicionar(evidencias, "preco", "registrada", "PRECO_CONTEXTUAL_REGISTRADO",
        "O arquivo relata preço coerente na consulta anterior; revalidar antes de publicar.", quando);
    } else {
      adicionar(evidencias, "preco", "expirada", "PRECO_CONTEXTUAL_NAO_ATUAL",
        "Preço registrado sem comprovação contextual recente para esta oferta.");
    }
  } else {
    adicionar(evidencias, "preco", "pendente", "PRECO_SEM_PROVA_RECENTE",
      "Preço observado, mas sem evidência oficial recente para publicação.");
  }

  const estoqueEm = instanteRecente(dado.disponibilidadeVerificadaEm, agora);
  if (plataforma === "Mercado Livre" &&
      dado.disponibilidadeConfirmada === true &&
      typeof dado.estoqueDisponivel === "number" &&
      Number.isInteger(dado.estoqueDisponivel) &&
      dado.estoqueDisponivel > 0 && vendedorId !== undefined &&
      /^[A-Za-z]{3}\d{8,}$/.test(anuncioId) && estoqueEm) {
    adicionar(evidencias, "disponibilidade", "registrada", "ESTOQUE_REGISTRADO",
      "Existe confirmação anterior de estoque; necessita revalidação no envio.", estoqueEm);
  } else if (plataforma === "Mercado Livre" &&
             dado.disponibilidadeConfirmada === false) {
    adicionar(evidencias, "disponibilidade", "divergente", "INDISPONIBILIDADE_DECLARADA",
      "O registro informa indisponibilidade; não publicar.");
  } else {
    adicionar(evidencias, "disponibilidade", "pendente", "ESTOQUE_NAO_HOMOLOGADO",
      "Disponibilidade não comprovada para a condição atual.");
  }

  const codigoCupom = texto(dado.cupomCodigo, 65);
  if (!codigoCupom) {
    adicionar(evidencias, "cupom", "nao-informada", "SEM_CUPOM",
      "Nenhum cupom integra esta ficha.");
  } else {
    const confirmadoEm = instanteRecente(dado.cupomConfirmadoEm, agora);
    const mesmoProduto = dado.cupomProdutoIdConfirmado === produtoId;
    const mesmoAnuncio = !anuncioId || dado.cupomAnuncioIdConfirmado === anuncioId;
    if (dado.cupomValidacao === "produto-confirmado" &&
        dado.cupomFonteConfirmacao === "checkout" &&
        confirmadoEm && mesmoProduto && mesmoAnuncio) {
      adicionar(evidencias, "cupom", "registrada", "CUPOM_CHECKOUT_REGISTRADO",
        "Aplicação relatada no checkout; revalidar condições antes de divulgar.", confirmadoEm);
    } else {
      adicionar(evidencias, "cupom", "pendente", "CUPOM_NAO_COMPROVADO",
        "Cupom sem confirmação recente para produto, anúncio e checkout.");
    }
  }

  const formato = linkOficialAparente(dado.urlAfiliado, plataforma);
  adicionar(evidencias, "link", formato ? "registrada" : "pendente",
    formato ? "LINK_FORMATO_RECONHECIDO" : "LINK_NAO_VALIDADO",
    formato
      ? "Domínio identificado. Destino e atribuição ainda não foram comprovados."
      : "Falta link de afiliado HTTPS com domínio reconhecido.");
  adicionar(evidencias, "atribuicao", "pendente", "ATRIBUICAO_INCONCLUSIVA",
    "Nenhum relatório oficial de comissão foi vinculado a esta ficha.");
  adicionar(evidencias, "canal", canal.podePublicar ? "registrada" : "pendente",
    canal.codigo, canal.motivo);

  const motivos = evidencias
    .filter((ev) => ev.estado !== "registrada" && ev.estado !== "nao-informada")
    .map((ev) => ({ codigo: ev.codigo, descricao: ev.descricao }));
  const bloqueada = !canal.podePublicar ||
    evidencias.some((e) => e.estado === "divergente") ||
    evidencias.some((e) => e.codigo === "LINK_NAO_VALIDADO");
  return {
    id: entrada.origem + ":" + plataforma + ":" + produtoId + ":" + anuncioId,
    origem: entrada.origem, plataforma, produtoId,
    ...(anuncioId ? { anuncioId } : {}),
    ...(vendedorId !== undefined ? { vendedorId } : {}),
    titulo, arquivoAtualizadoEm: entrada.atualizadoEm,
    ...(preco !== undefined ? { precoObservado: preco } : {}),
    moeda: "BRL", evidencias,
    decisao: {
      estado: bloqueada ? "bloqueada" : "necessita-revisao",
      podePublicar: false,
      motivos: [
        ...motivos,
        { codigo: "REVISAO_E_REVALIDACAO_OBRIGATORIAS",
          descricao: "Esta consulta não autoriza publicação nem comprova comissão." }
      ],
      regraVersao: 1
    }
  };
}

async function lerArquivoCandidato(
  raiz: string,
  nome: string,
  origem: OrigemArquivo
): Promise<{ entrada?: EntradaArquivo; aviso?: string }> {
  const caminho = resolve(raiz, "data", nome);
  try {
    const meta = await stat(caminho);
    if (!meta.isFile() || meta.size > MAX_ARQUIVO_BYTES) {
      return { aviso: "ARQUIVO_DE_OFERTA_COM_TAMANHO_INVALIDO" };
    }
    const conteudo = await readFile(caminho, "utf8");
    return {
      entrada: {
        origem, dado: JSON.parse(conteudo) as unknown,
        atualizadoEm: meta.mtime.toISOString()
      }
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    return { aviso: "ARQUIVO_DE_OFERTA_INACESSIVEL_OU_INVALIDO" };
  }
}

export async function consultarPainelRevisao({
  raiz, grupo, agora = new Date()
}: { raiz: string; grupo: string; agora?: Date }): Promise<PainelRevisao> {
  const entradas = await Promise.all([
    lerArquivoCandidato(raiz, "ultima-oferta-whatsapp.json", "preparacao-whatsapp"),
    lerArquivoCandidato(raiz, "ultima-oferta-mercadolivre.json", "registro-mercado-livre")
  ]);
  const avisos: string[] = [];
  const fichas: FichaRevisao[] = [];
  const vistos = new Map<string, FichaRevisao>();

  for (const item of entradas) {
    if (item.aviso) avisos.push(item.aviso);
    if (!item.entrada) continue;
    const dado = registro(item.entrada.dado);
    const canal = await consultarElegibilidadeCanalWhatsapp({
      grupo, plataforma: typeof dado?.plataforma === "string" ? dado.plataforma : "",
      agora
    }, resolve(raiz, "data", "elegibilidade-canais.json"));
    const ficha = criarFichaRevisao(item.entrada, canal, agora);
    if (!ficha) {
      avisos.push("IDENTIFICACAO_DE_OFERTA_INVALIDA");
      continue;
    }
    const chave = ficha.plataforma + "|" + ficha.produtoId + "|" + (ficha.anuncioId || "");
    const outra = vistos.get(chave);
    if (outra) {
      if (outra.precoObservado === ficha.precoObservado &&
          outra.vendedorId === ficha.vendedorId) {
        avisos.push("REGISTRO_DUPLICADO_NAO_SOMADO");
        continue;
      }
      avisos.push("REGISTROS_DIVERGENTES_EM_PRECO_OU_VENDEDOR");
      for (const concorrente of [outra, ficha]) {
        concorrente.evidencias.push({
          criterio: "preco", estado: "divergente",
          codigo: "REGISTROS_DIVERGENTES",
          descricao: "Registros locais do mesmo anúncio divergem em preço ou vendedor."
        });
        concorrente.decisao.estado = "bloqueada";
        concorrente.decisao.motivos.push({
          codigo: "REGISTROS_DIVERGENTES",
          descricao: "Confrontar as observações e refazer a validação."
        });
      }
    }
    vistos.set(chave, ficha);
    fichas.push(ficha);
  }

  return {
    modo: "somente-leitura",
    consultadoEm: agora.toISOString(),
    resumo: {
      candidatos: fichas.length,
      bloqueados: fichas.filter((f) => f.decisao.estado === "bloqueada").length,
      necessitamRevisao: fichas.filter((f) => f.decisao.estado === "necessita-revisao").length,
      aprovados: 0
    },
    fichas,
    avisos: [...new Set(avisos)]
  };
}
