/**
 * Análise local de rascunhos MELI-09: reutiliza o repositório existente.
 *
 * Não confunde precoAnterior conferido manualmente com série histórica de
 * mercado: é apenas comparação registrada pelo operador, nunca prova de
 * queda histórica independente. Sem coleta de anúncios e sem autoenvio.
 */
import type {RascunhoMeli} from "../painel/mercadolivre-assistido.js";
import {urlProdutoIndividual} from "../painel/mercadolivre-assistido.js";

export type Decisao = "revisar" | "revalidar" | "bloqueado";
export interface CandidatoCacador {
  id:string;
  titulo:string;
  urlProduto:string;
  precoAtual:number;
  precoAnteriorInformado:number;
  diferencaInformadaPercentual:number;
  conferidoEm:string;
  idadeMinutos:number;
  estado:Decisao;
  notaDePrioridade:number;
  motivos:string[];
  origem:"conferencia-manual";
  vendedorEVersaoConfirmadosNaBase:false;
  serieHistoricaVerificada:false;
  cupomValidado:false;
  podeEnviar:false;
  podePublicar:false;
}
export interface PainelCacador {
  modo:"ASSISTIDO";
  fonteExterna:{
    autorizacaoConfirmada:false;
    buscaAutomaticaAtiva:false;
    motivo:string;
  };
  guardrails:{
    motorInstalado:true;
    motorLigado:false;
    simultaneidadePlanejada:1;
    intervaloMinimoSegundos:60;
    consultasExternasRealizadas:0;
    enviosRealizados:0;
  };
  atualizacaoUtc:string;
  totais:{
    registros:number;
    identidades:number;
    duplicados:number;
    revisar:number;
    revalidar:number;
    bloqueados:number;
    publicaveis:0;
  };
  candidatos:CandidatoCacador[];
}
const FONTE_PENDENTE="Busca automática de produtos não liberada para o Programa de Afiliados (atendimento 494444122).";
function timestamp(input:unknown):number {
  if(typeof input!=="string"||!input.endsWith("Z"))return NaN;
  const n=Date.parse(input);
  return Number.isFinite(n)?n:NaN;
}
function validar(
  value:RascunhoMeli,agora:number
):CandidatoCacador|null{
  if(!value||value.status!=="rascunho-nao-publicado"||
     value.origem!=="conferencia-manual" ||
     typeof value.id!=="string"||
     !/^[a-f0-9-]{36}$/.test(value.id)||
     typeof value.titulo!=="string"||
     value.titulo.trim().length<5||
     value.titulo.length>160||
     typeof value.precoAtual!=="number"||
     !Number.isFinite(value.precoAtual)||value.precoAtual<=0||
     typeof value.precoAnterior!=="number"||
     !Number.isFinite(value.precoAnterior)||
     value.precoAnterior<=value.precoAtual ||
     typeof value.descontoPercentual!=="number"||
     !Number.isFinite(value.descontoPercentual))return null;
  let url:string;
  try {url=urlProdutoIndividual(value.urlProduto);}
  catch{return null;}
  const t=timestamp(value.conferidoEm);
  if(!Number.isFinite(t)||t>agora+60_000)return null;
  const idade=Math.floor(Math.max(0,agora-t)/60_000);
  const percentual=(value.precoAnterior-value.precoAtual)/
    value.precoAnterior*100;
  if(Math.abs(percentual-value.descontoPercentual)>0.12)return null;
  let estado:Decisao="revisar";
  const motivos=[
    "Preço anterior informado manualmente; não comprova queda histórica.",
    "Vendedor, variante, frete e cupons exigem conferência antes de qualquer divulgação."
  ];
  if(idade>=48*60){
    estado="bloqueado";
    motivos.unshift("Conferência há mais de 48 horas; informação comercial vencida.");
  }else if(idade>=4*60){
    estado="revalidar";
    motivos.unshift("Preço verificado há mais de quatro horas; reconfirme a oferta.");
  }else{
    motivos.unshift("Candidato recente para revisão humana, não oferta aprovada.");
  }
  // Nota serve SOMENTE para ordenar revisão; não aprova ofertas.
  const nota=Math.max(0,Math.min(100,Math.round(
    (estado==="revisar"?60:estado==="revalidar"?30:5)+
    Math.min(12,Math.max(0,percentual)*.3)-
    Math.min(14,idade/120)
  )));
  return {
    id:value.id,titulo:value.titulo.trim(),urlProduto:url,
    precoAtual:value.precoAtual,
    precoAnteriorInformado:value.precoAnterior,
    diferencaInformadaPercentual:Math.round(percentual*10)/10,
    conferidoEm:value.conferidoEm,idadeMinutos:idade,
    estado,notaDePrioridade:nota,motivos,
    origem:"conferencia-manual",
    vendedorEVersaoConfirmadosNaBase:false,
    serieHistoricaVerificada:false,
    cupomValidado:false,podeEnviar:false,podePublicar:false
  };
}
export function analisarRascunhosMeli(
  itens:ReadonlyArray<RascunhoMeli>,agora:number=Date.now()
):PainelCacador{
  if(!Number.isFinite(agora)||agora<1_500_000_000_000)
    throw Error("horario_invalido");
  if(!Array.isArray(itens)||itens.length>100)throw Error("lista_invalida");
  const porProduto=new Map<string,CandidatoCacador>();
  let bloqueadosInvalidos=0;
  for(const item of itens){
    const candidato=validar(item,agora);
    if(!candidato){bloqueadosInvalidos++;continue;}
    const chave=new URL(candidato.urlProduto).pathname.toUpperCase();
    const prior=porProduto.get(chave);
    if(!prior||Date.parse(candidato.conferidoEm)>Date.parse(prior.conferidoEm)){
      porProduto.set(chave,candidato);
    }
  }
  const candidatos=[...porProduto.values()]
    .sort((a,b)=>b.notaDePrioridade-a.notaDePrioridade||
      a.titulo.localeCompare(b.titulo,"pt-BR")||a.id.localeCompare(b.id));
  const duplicados=itens.length-bloqueadosInvalidos-candidatos.length;
  const totalEstado=(s:Decisao)=>candidatos.filter(c=>c.estado===s).length;
  return {
    modo:"ASSISTIDO",
    fonteExterna:{
      autorizacaoConfirmada:false,buscaAutomaticaAtiva:false,
      motivo:FONTE_PENDENTE
    },
    guardrails:{
      motorInstalado:true,motorLigado:false,simultaneidadePlanejada:1,
      intervaloMinimoSegundos:60,consultasExternasRealizadas:0,
      enviosRealizados:0
    },
    atualizacaoUtc:new Date(agora).toISOString(),
    totais:{
      registros:itens.length,
      identidades:candidatos.length,duplicados,
      revisar:totalEstado("revisar"),
      revalidar:totalEstado("revalidar"),
      bloqueados:totalEstado("bloqueado")+bloqueadosInvalidos,
      publicaveis:0
    },
    candidatos
  };
}
