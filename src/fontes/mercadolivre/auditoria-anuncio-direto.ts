import { centavosBRL } from "./disponibilidade.js";

/**
 * Etapa 56: auditoria estritamente somente leitura de anuncio individual.
 * Sem buy_box_winner na PDP, item ativo e catalog_product_id coincidente
 * NAO comprovam vencedor, estoque compravel nem comissao. A API pode omitir
 * available_quantity de anuncios de terceiros (documentacao oficial).
 */
export type StatusAuditoriaAnuncio =
  | "anuncio_vinculado_pendente"
  | "anuncio_divergente"
  | "inconclusivo";

export type MotivoAuditoriaAnuncio =
  | "ANUNCIO_DADOS_INSUFICIENTES"
  | "ANUNCIO_CATALOGO_DIVERGENTE"
  | "ANUNCIO_STATUS_INATIVO"
  | "ANUNCIO_MOEDA_INVALIDA"
  | "ANUNCIO_PRECO_INVALIDO"
  | "ANUNCIO_LINK_NAO_OFICIAL"
  | "ANUNCIO_CATALOGO_VINCULADO"
  | "ANUNCIO_PERMISSAO_NEGADA"
  | "ANUNCIO_NAO_ENCONTRADO"
  | "ANUNCIO_LIMITE_429"
  | "ANUNCIO_HTTP_INDISPONIVEL"
  | "ANUNCIO_REDE_INDISPONIVEL"
  | "ANUNCIO_RESPOSTA_INVALIDA";

export type EstoqueObservado =
  | "declarado_positivo"
  | "declarado_zero"
  | "nao_exposto"
  | "valor_invalido";

export type EstadoPrecoCanal =
  | "coerente" | "divergente" | "inconclusivo" | "nao_consultado";

export interface AuditoriaAnuncioDireto {
  situacao: StatusAuditoriaAnuncio;
  motivo: MotivoAuditoriaAnuncio;
  catalogoCorrespondente: boolean;
  anuncioAtivo: boolean;
  condicaoNovoConfirmada: boolean;
  vendedorIdentificado: boolean;
  linkDiretoOficial: boolean;
  estoque: EstoqueObservado;
  precoDoAnuncio?: number;
  precoCanalMarketplace?: number;
  precoCanalStatus: EstadoPrecoCanal;
  precoCanalMotivo?: string;
  observadaEm: string;
  /** Vendedor do anuncio nao equivale ao vencedor da PDP. */
  vendedorVencedorConfirmado: false;
  modalidadePagamentoConfirmada: false;
  cupomAplicavelConfirmado: false;
  atribuicaoComprovada: false;
  envioPermitido: false;
}

export interface OpcoesAuditoriaAnuncioDireto {
  fetchImpl?: typeof fetch;
  agora?: () => number;
  timeoutMs?: number;
  consultarPrecoContextual?: boolean;
}

type JsonRecord = Record<string,unknown>;
function objeto(v:unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function idValido(v:unknown):v is string {
  return typeof v === "string" && /^MLB[0-9]{5,}$/.test(v);
}
function positivoInteiro(v:unknown):boolean {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0;
}
function estoqueDeclarado(v:unknown):EstoqueObservado {
  if (v === undefined || v === null) return "nao_exposto";
  if (v === 0) return "declarado_zero";
  return positivoInteiro(v) ? "declarado_positivo" : "valor_invalido";
}
function permalinkOficial(permalink:unknown, anuncioId:string):boolean {
  if(typeof permalink !== "string" || permalink.length > 2048) return false;
  try {
    const url = new URL(permalink);
    const anuncioNaRota = /^\/MLB-(\d{5,})(?:-[a-z0-9_-]+)?\/?$/i.exec(url.pathname);
    return url.protocol === "https:" && !url.port &&
      (url.hostname === "mercadolivre.com.br" ||
       url.hostname.endsWith(".mercadolivre.com.br")) &&
      anuncioNaRota?.[1] === anuncioId.replace(/^MLB/i,"") &&
      !url.username && !url.password;
  } catch { return false; }
}

function inicial(motivo:MotivoAuditoriaAnuncio, now:number):AuditoriaAnuncioDireto {
  return {
    situacao:"inconclusivo", motivo,
    catalogoCorrespondente:false, anuncioAtivo:false,
    condicaoNovoConfirmada:false,vendedorIdentificado:false,
    linkDiretoOficial:false,estoque:"nao_exposto",
    precoCanalStatus:"nao_consultado",
    observadaEm:new Date(now).toISOString(),
    vendedorVencedorConfirmado:false,
    modalidadePagamentoConfirmada:false,
    cupomAplicavelConfirmado:false,
    atribuicaoComprovada:false,
    envioPermitido:false
  };
}

export async function auditarAnuncioDiretoMercadoLivre(
  produtoId:string, anuncioId:string, token:string,
  opcoes:OpcoesAuditoriaAnuncioDireto={}
):Promise<AuditoriaAnuncioDireto> {
  const now=(opcoes.agora??Date.now)();
  if(!Number.isFinite(now))throw new Error("Instante invalido");
  const result=inicial("ANUNCIO_DADOS_INSUFICIENTES",now);
  if(!idValido(produtoId)||!idValido(anuncioId)||
     typeof token!=="string"||token.length<2) return result;

  const timeoutMs=Math.max(1000,Math.min(10000,opcoes.timeoutMs??8000));
  const fetcher=opcoes.fetchImpl??fetch;
  let response:Response;
  try {
    response=await fetcher("https://api.mercadolibre.com/items/"+
      encodeURIComponent(anuncioId),{
      method:"GET",headers:{accept:"application/json",
        authorization:"Bearer "+token},
      signal:AbortSignal.timeout(timeoutMs)
    });
  }catch{return {...result,motivo:"ANUNCIO_REDE_INDISPONIVEL"};}

  if(response.status===429)return {...result,motivo:"ANUNCIO_LIMITE_429"};
  if(response.status===401||response.status===403)
    return {...result,motivo:"ANUNCIO_PERMISSAO_NEGADA"};
  if(response.status===404)return {...result,motivo:"ANUNCIO_NAO_ENCONTRADO"};
  if(!response.ok)return {...result,motivo:"ANUNCIO_HTTP_INDISPONIVEL"};
  let item:unknown;
  try{item=await response.json();}catch{
    return {...result,motivo:"ANUNCIO_RESPOSTA_INVALIDA"};
  }
  if(!objeto(item)||item.id!==anuncioId)return {
    ...result,motivo:"ANUNCIO_RESPOSTA_INVALIDA"
  };

  const catalogoCorrespondente=item.catalog_product_id===produtoId;
  const anuncioAtivo=item.status==="active";
  const condicaoNovoConfirmada=item.condition==="new";
  const vendedorIdentificado=positivoInteiro(item.seller_id);
  const linkDiretoOficial=permalinkOficial(item.permalink,anuncioId);
  const estoque=estoqueDeclarado(item.available_quantity);
  const cents=centavosBRL(item.price);
  const precoDoAnuncio=cents===undefined?undefined:cents/100;
  const base:AuditoriaAnuncioDireto={
    ...result,catalogoCorrespondente,anuncioAtivo,
    condicaoNovoConfirmada,vendedorIdentificado,
    linkDiretoOficial,estoque,
    ...(precoDoAnuncio!==undefined?{precoDoAnuncio}: {})
  };
  if(item.catalog_product_id!=null&&!catalogoCorrespondente)return {
    ...base,situacao:"anuncio_divergente",
    motivo:"ANUNCIO_CATALOGO_DIVERGENTE"
  };
  if(!anuncioAtivo)return {...base,situacao:"anuncio_divergente",
    motivo:"ANUNCIO_STATUS_INATIVO"};
  if(item.currency_id!=="BRL")return {...base,situacao:"anuncio_divergente",
    motivo:"ANUNCIO_MOEDA_INVALIDA"};
  if(cents===undefined)return {...base,situacao:"anuncio_divergente",
    motivo:"ANUNCIO_PRECO_INVALIDO"};
  if(typeof item.permalink==="string"&&!linkDiretoOficial)return {
    ...base,situacao:"anuncio_divergente",motivo:"ANUNCIO_LINK_NAO_OFICIAL"
  };
  if(!catalogoCorrespondente||!condicaoNovoConfirmada||
     !vendedorIdentificado||!linkDiretoOficial||
     estoque==="declarado_zero"||estoque==="valor_invalido")return base;

  const ready:AuditoriaAnuncioDireto={
    ...base,situacao:"anuncio_vinculado_pendente",
    motivo:"ANUNCIO_CATALOGO_VINCULADO"
  };
  if(opcoes.consultarPrecoContextual===false)return ready;

  // Apenas uma segunda consulta oficial do mesmo item.
  // A resposta jamais libera envio ou modalidade Pix/cartao.
  let priceResponse:Response;
  try {
    priceResponse=await fetcher("https://api.mercadolibre.com/items/"+
      encodeURIComponent(anuncioId)+
      "/sale_price?context=channel_marketplace",{
      method:"GET",headers:{accept:"application/json",
        authorization:"Bearer "+token},
      signal:AbortSignal.timeout(timeoutMs)
    });
  }catch{return {...ready,precoCanalStatus:"inconclusivo",
    precoCanalMotivo:"PRECO_ERRO_REDE"};}
  if(priceResponse.status===429)return {...ready,
    precoCanalStatus:"inconclusivo",precoCanalMotivo:"PRECO_LIMITE_429"};
  if(priceResponse.status===401||priceResponse.status===403)return {
    ...ready,precoCanalStatus:"inconclusivo",
    precoCanalMotivo:"PRECO_SEM_PERMISSAO"
  };
  if(!priceResponse.ok)return {...ready,precoCanalStatus:"inconclusivo",
    precoCanalMotivo:"PRECO_HTTP_INDISPONIVEL"};
  let json:unknown;
  try {json=await priceResponse.json();}
  catch{return {...ready,precoCanalStatus:"inconclusivo",
    precoCanalMotivo:"PRECO_RESPOSTA_INVALIDA"};}
  if(!objeto(json)||json.currency_id!=="BRL")return {
    ...ready,precoCanalStatus:"inconclusivo",
    precoCanalMotivo:"PRECO_MOEDA_NAO_CONFIRMADA"
  };
  const channelCents=centavosBRL(json.amount);
  const timestamp=typeof json.reference_date==="string"?
    Date.parse(json.reference_date):NaN;
  if(channelCents===undefined||!Number.isFinite(timestamp)||
     timestamp>now+60_000||now-timestamp>10*60_000)return {
    ...ready,precoCanalStatus:"inconclusivo",
    precoCanalMotivo:"PRECO_REFERENCIA_INVALIDA"
  };
  return {
    ...ready,precoCanalMarketplace:channelCents/100,
    precoCanalStatus:channelCents===cents?"coerente":"divergente",
    precoCanalMotivo:channelCents===cents?
      "PRECO_CANAL_IGUAL_AO_ITEM":"PRECO_CANAL_DIFERENTE_DO_ITEM"
  };
}
