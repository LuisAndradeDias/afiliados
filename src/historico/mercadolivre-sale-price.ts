/**
 * MELI-12: adaptador estrito de resposta oficial sale_price para precificacao.
 *
 * Nao há fetch/HTTP implícito; um transportador e um provedor de token
 * PRECISAM ser injetados por integração revisada. NAO registrado no server.ts.
 * API de preco por canal nao comprova modalidade Pix, estoque ou desconto.
 * Dados deste módulo não entram automaticamente no histórico operacional.
 */
export type Meli12ErroCodigo =
  | "MELI12_AGUARDANDO_AUTORIZACAO"
  | "MELI12_CADASTRO_INCONSISTENTE"
  | "MELI12_PRECO_NAO_VALIDADO"
  | "MERCADOLIVRE_PERMISSION_REQUIRED"
  | "MERCADOLIVRE_RATE_LIMIT"
  | "MERCADOLIVRE_TEMPORARY_ERROR";

export class ErroMeli12 extends Error {
  constructor(readonly code: Meli12ErroCodigo) {
    super(code);
    this.name = "ErroMeli12";
  }
}

export interface AprovacaoTecnicaMeli12 {
  // Informacao da equipe oficial; esta estrutura NAO comprova sua autenticidade.
  status: "confirmado_mercadolivre";
  appId: string;
  protocolo: string;
  endpoint: "sale_price";
  escopo: "consulta_anuncios_terceiros_afiliados";
  permiteTerceiros: true;
  revisadoPorResponsavel: true;
  validoAteUtc: string;
}
export interface CadastroAutorizadoMeli12 {
  itemId: string;
  titulo: string;
  vendedorId: string;
  varianteId: string;
  // O cadastro deve vir de fonte independentemente autorizada.
  origem: "catalogo_autorizado";
  protocoloFonte: string;
  verificadoEmUtc: string;
}
export interface RespostaSalePriceTransporte {
  status: number;
  // Apenas JSON parseado, nunca cabecalhos privados ou resposta bruta em logs.
  corpo: unknown;
}
export interface PedidoMeli12 {
  metodo: "GET";
  url: string;
  accessToken: string;
  signal: AbortSignal;
}
export type TransporteMeli12 = (
  pedido: PedidoMeli12
) => Promise<RespostaSalePriceTransporte>;

export interface DependenciasMeli12 {
  aprovacao: AprovacaoTecnicaMeli12 | null;
  item: CadastroAutorizadoMeli12;
  transporte: TransporteMeli12;
  token: () => Promise<string>;
  signal: AbortSignal;
  agora?: () => number;
}

export interface PrecoMarketplaceMeli12 {
  itemId: string;
  titulo: string;
  vendedorId: string;
  varianteId: string;
  // Este preco pertence ao contexto channel_marketplace, nao a Pix/cartao.
  contexto: "channel_marketplace";
  moeda: "BRL";
  centavos: number;
  precoRegularCentavos: number | null;
  referenciaOficialUtc: string;
  observadoEmUtc: string;
  modalidadePagamento: "nao_informada";
  disponibilidade: "indeterminada";
  podeCompararComoDesconto: false;
  podePublicar: false;
  proveniencia: "resposta_sale_price_validada";
}

const ID_ITEM = /^MLB\d{6,20}$/;
const ID_ACESSO = /^[A-Za-z0-9_-]{1,72}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const MAX_BODY_BYTES = 24_000;
const MAX_AGE_MS = 48 * 60 * 60_000;
function rejeitar(code: Meli12ErroCodigo): never {
  throw new ErroMeli12(code);
}
function numeroCentavos(value: unknown, obrigatorio: boolean): number | null {
  if (value == null && !obrigatorio) return null;
  if (typeof value !== "number" || !Number.isFinite(value) ||
      value <= 0 || value > 1_000_000_000) {
    rejeitar("MELI12_PRECO_NAO_VALIDADO");
  }
  const centavos = Math.round(value * 100);
  if (!Number.isSafeInteger(centavos) || centavos <= 0 ||
      Math.abs(value * 100 - centavos) > 0.000001) {
    rejeitar("MELI12_PRECO_NAO_VALIDADO");
  }
  return centavos;
}
function parseUTC(value: unknown, code: Meli12ErroCodigo): number {
  if (typeof value !== "string" || !UTC.test(value)) rejeitar(code);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) ||
      new Date(ms).toISOString().slice(0,19) !== value.slice(0,19)) rejeitar(code);
  return ms;
}
function guardarAcesso(
  aprovacao: AprovacaoTecnicaMeli12 | null,
  item: CadastroAutorizadoMeli12,
  agora: number
): void {
  if (!aprovacao || aprovacao.status !== "confirmado_mercadolivre" ||
      !/^\d{8,24}$/.test(aprovacao.appId) ||
      !/^[A-Za-z0-9_-]{6,80}$/.test(aprovacao.protocolo) ||
      aprovacao.endpoint !== "sale_price" ||
      aprovacao.escopo !== "consulta_anuncios_terceiros_afiliados" ||
      aprovacao.permiteTerceiros !== true ||
      aprovacao.revisadoPorResponsavel !== true) {
    rejeitar("MELI12_AGUARDANDO_AUTORIZACAO");
  }
  const ate = parseUTC(aprovacao.validoAteUtc,"MELI12_AGUARDANDO_AUTORIZACAO");
  if (ate <= agora || ate > agora + 365 * 86400_000) {
    rejeitar("MELI12_AGUARDANDO_AUTORIZACAO");
  }
  if (!ID_ITEM.test(item?.itemId) ||
      !ID_ACESSO.test(item.vendedorId) || !ID_ACESSO.test(item.varianteId) ||
      typeof item.titulo !== "string" ||
      !item.titulo.trim() || item.titulo.length > 120 ||
      item.origem !== "catalogo_autorizado" ||
      item.protocoloFonte !== aprovacao.protocolo) {
    rejeitar("MELI12_CADASTRO_INCONSISTENTE");
  }
  const verificado = parseUTC(item.verificadoEmUtc,"MELI12_CADASTRO_INCONSISTENTE");
  if (verificado > agora + 60_000 || agora - verificado > 24 * 3600_000) {
    rejeitar("MELI12_CADASTRO_INCONSISTENTE");
  }
}
function interpretarResposta(
  body: unknown, item: CadastroAutorizadoMeli12, agora: number
): PrecoMarketplaceMeli12 {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    rejeitar("MELI12_PRECO_NAO_VALIDADO");
  }
  const data = body as Record<string,unknown>;
  if (data.currency_id !== "BRL") rejeitar("MELI12_PRECO_NAO_VALIDADO");
  const centavos = numeroCentavos(data.amount, true);
  if (centavos == null) rejeitar("MELI12_PRECO_NAO_VALIDADO");
  const regular = numeroCentavos(data.regular_amount,false);
  const referencia = parseUTC(data.reference_date,"MELI12_PRECO_NAO_VALIDADO");
  if (referencia > agora + 60_000 || agora - referencia > MAX_AGE_MS) {
    rejeitar("MELI12_PRECO_NAO_VALIDADO");
  }
  return {
    itemId:item.itemId,
    titulo:item.titulo.trim(),
    vendedorId:item.vendedorId,
    varianteId:item.varianteId,
    contexto:"channel_marketplace",
    moeda:"BRL",
    centavos,
    precoRegularCentavos:regular,
    referenciaOficialUtc:new Date(referencia).toISOString(),
    observadoEmUtc:new Date(agora).toISOString(),
    modalidadePagamento:"nao_informada",
    disponibilidade:"indeterminada",
    podeCompararComoDesconto:false,
    podePublicar:false,
    proveniencia:"resposta_sale_price_validada"
  };
}

/**
 * Prepara uma consulta oficial de preco, somente se houver aprovacao
 * documental revisada e cadastro licenciado.
 * A presente entrega nao conecta este modulo ao processo da Central.
 */
export async function consultarSalePriceAutorizado(
  dependencias: DependenciasMeli12
): Promise<PrecoMarketplaceMeli12> {
  const agora = (dependencias.agora ?? Date.now)();
  if (!Number.isFinite(agora)) rejeitar("MELI12_PRECO_NAO_VALIDADO");
  guardarAcesso(dependencias.aprovacao,dependencias.item,agora);
  if (dependencias.signal.aborted) rejeitar("MELI12_PRECO_NAO_VALIDADO");
  let token: string;
  try {
    token=await dependencias.token();
  } catch {
    rejeitar("MERCADOLIVRE_PERMISSION_REQUIRED");
  }
  if (typeof token !== "string" || token.length < 8 || token.length > 6000) {
    rejeitar("MERCADOLIVRE_PERMISSION_REQUIRED");
  }
  // Nenhum redirecionamento nem URL arbitraria; a implementacao futura
  // do transporte devera impor HTTPS, sem redirects e com timeout.
  const url = "https://api.mercadolibre.com/items/" +
    dependencias.item.itemId + "/sale_price?context=channel_marketplace";
  let response: RespostaSalePriceTransporte;
  try {
    response=await dependencias.transporte({
      metodo:"GET",url,accessToken:token,signal:dependencias.signal
    });
  } catch {
    rejeitar("MERCADOLIVRE_TEMPORARY_ERROR");
  }
  if (!response || !Number.isInteger(response.status)) {
    rejeitar("MERCADOLIVRE_TEMPORARY_ERROR");
  }
  if (response.status===401 || response.status===403) {
    rejeitar("MERCADOLIVRE_PERMISSION_REQUIRED");
  }
  if (response.status===429) rejeitar("MERCADOLIVRE_RATE_LIMIT");
  if (response.status!==200) rejeitar("MERCADOLIVRE_TEMPORARY_ERROR");
  let size: number;
  try {
    size=Buffer.byteLength(JSON.stringify(response.corpo),"utf8");
  } catch {
    rejeitar("MELI12_PRECO_NAO_VALIDADO");
  }
  if (size > MAX_BODY_BYTES) rejeitar("MELI12_PRECO_NAO_VALIDADO");
  return interpretarResposta(response.corpo, dependencias.item, agora);
}
