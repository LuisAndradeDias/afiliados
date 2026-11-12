/** Simula o agendador consultando três fontes locais separadas.
 * Nenhuma fonte real pode ser registrada aqui. Sem HTTP, timers ou envio.
 */
import {executar,type Ciclo,type Observacao,type Origem,type Relatorio} from "./motor.js";
import {ciclosDeLaboratorio} from "./fixtures.js";
export interface FonteLaboratorio{
  identificador:Origem;
  modo:"fixture";
  coletar:(indiceCiclo:number)=>Promise<Observacao[]>;
}
export function fontesSimuladas():FonteLaboratorio[]{
  const agenda=ciclosDeLaboratorio();
  return ([
    "fixture-amazon-creators",
    "fixture-shopee-afiliados",
    "fixture-meli-curadoria"
  ] as const).map(identificador=>({
    identificador,modo:"fixture" as const,
    coletar:async(i:number)=>{
      if(i<0||i>=agenda.length)throw Error("Ciclo fora do calendário");
      return structuredClone(agenda[i]!.observacoes.filter(o=>o.origem===identificador));
    }
  }));
}
export async function simularOrquestrador(
  fontes:ReadonlyArray<FonteLaboratorio>=fontesSimuladas()
):Promise<{relatorio:Relatorio;coletasSimuladas:number;falhasDeFonte:number}>{
  if(fontes.length!==3 ||
     new Set(fontes.map(f=>f.identificador)).size!==3 ||
     fontes.some(f=>f.modo!=="fixture" || typeof f.coletar!=="function" ||
       !["fixture-amazon-creators","fixture-shopee-afiliados","fixture-meli-curadoria"]
        .includes(f.identificador))){
    throw Error("Somente três fontes fixture independentes são permitidas");
  }
  const agenda=ciclosDeLaboratorio();
  const execucoes:Ciclo[]=[];
  let falhasDeFonte=0,coletasSimuladas=0;
  for(let i=0;i<agenda.length;i++){
    const solicitacoes=fontes.map(async fonte=>{
      const linhas=await fonte.coletar(i);
      if(!Array.isArray(linhas)||linhas.length>100||
         linhas.some(o=>o.origem!==fonte.identificador))
        throw Error("Resposta da fonte fora do contrato");
      return linhas;
    });
    coletasSimuladas+=solicitacoes.length;
    const resultados=await Promise.allSettled(solicitacoes);
    const observacoes:Observacao[]=[];
    for(const resultado of resultados){
      if(resultado.status==="rejected"){falhasDeFonte++;continue;}
      observacoes.push(...resultado.value);
    }
    execucoes.push({nome:agenda[i]!.nome,instanteUtc:agenda[i]!.instanteUtc,
      observacoes});
  }
  return {relatorio:executar(execucoes),coletasSimuladas,falhasDeFonte};
}
