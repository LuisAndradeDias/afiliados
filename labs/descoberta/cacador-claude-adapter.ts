/**
 * Ponte SOMENTE OFFLINE entre o LAB-01 e a pontuação extraída do Caçador Claude.
 * Nunca muda o status bloqueado do LAB-01 para liberado e não conhece WhatsApp.
 */
import type {Avaliacao} from "./motor.js";
import {
  memoriaClaude,pontuarAchadinhoClaude,type ObservacaoClaude,type ResultadoClaude,
  type RegrasClaude
} from "../../src/ofertas/cacador-claude.js";

export const regrasComparativoLaboratorio:Readonly<RegrasClaude>=Object.freeze({
  precoMaxCentavos:200_000,descontoMinimoPercentual:10,
  descontoSuspeitoPercentual:85,notaMinima:4.3,
  avaliacoesMinimas:5,pontuacaoMinima:20,
  ignorarRelampago:true,bloquearAcimaNormal:true
});
export interface LinhaComparativo {
  chave:string;titulo:string;
  estadoOriginal:Avaliacao["status"];
  estadoComparativo:"revisar"|"acompanhar"|"bloqueado";
  pontuacaoClaude:number;vereditoClaude:ResultadoClaude["veredito"];
  motivo:string;alertas:string[];
  podePublicar:false;
}
export interface RelatorioComparativo {
  etiqueta:"LABORATORIO_OFFLINE_NAO_PUBLICAR";
  linhas:LinhaComparativo[];
  resumo:{
    total:number;revisar:number;acompanhar:number;bloqueado:number;
    mensagensEnviadas:0;coletasExternas:0;
  };
}
export function compararComClaude(
  avaliacoes:ReadonlyArray<Avaliacao>,
  regras:Readonly<RegrasClaude>=regrasComparativoLaboratorio
):RelatorioComparativo{
  const linhas:LinhaComparativo[]=avaliacoes.map((a)=>{
    const partes=a.chave.split("|");
    const itemId=partes[1]||"";
    const hist:ObservacaoClaude[]=a.serie
      .filter(x=>x.precoTotalCentavos!==null)
      .map(x=>({
        id:itemId,vendedor:a.vendedor,variante:a.variante,
        pagamento:a.pagamento,precoCentavos:x.precoTotalCentavos!,
        observadoEmUtc:x.instanteUtc
      }));
    const atual:ObservacaoClaude|null=a.precoTotalCentavos===null?null:{
      id:itemId,vendedor:a.vendedor,variante:a.variante,
      pagamento:a.pagamento,precoCentavos:a.precoTotalCentavos,
      observadoEmUtc:a.observadoEmUtc
    };
    const mem=atual?memoriaClaude(hist,atual):null;
    const score=atual&&mem?pontuarAchadinhoClaude({
      titulo:a.titulo,precoCentavos:atual.precoCentavos,
      // Nenhum desconto "de" ou avaliação é inventado; só queda baseada na memória.
      descontoAnunciadoPercentual:null,cupomConfirmado:false
    },mem,regras):null;
    const estadoComparativo:LinhaComparativo["estadoComparativo"]=
      a.status==="bloqueado"?"bloqueado":
      a.status==="revisar"&&score?.podeRevisar?"revisar":"acompanhar";
    return {
      chave:a.chave,titulo:a.titulo,
      estadoOriginal:a.status,estadoComparativo,
      pontuacaoClaude:score?.pontuacao??0,
      vereditoClaude:score?.veredito??"aprendendo",
      motivo:score?.motivo??"Preço ou frete não verificado",
      alertas:[
        ...(score?.alertas??[]),
        ...a.razoes,
        "Simulação: nenhuma oferta aprovada para envio"
      ],
      podePublicar:false
    };
  });
  return {
    etiqueta:"LABORATORIO_OFFLINE_NAO_PUBLICAR",linhas,
    resumo:{
      total:linhas.length,
      revisar:linhas.filter(x=>x.estadoComparativo==="revisar").length,
      acompanhar:linhas.filter(x=>x.estadoComparativo==="acompanhar").length,
      bloqueado:linhas.filter(x=>x.estadoComparativo==="bloqueado").length,
      mensagensEnviadas:0,coletasExternas:0
    }
  };
}
