import {config} from "dotenv";
// Lê somente configuração local do laboratório; nunca o .env de produção.
config({path:".env.lab02",override:false});
import {auditar,sondar,Bloqueio} from "./sonda.js";
/**
 * Executar manualmente na branch de laboratorio:
 *   npm run lab02:status
 *   npm run lab02:buscar -- parafusadeira
 * NUNCA executado ao iniciar a Central ou qualquer monitor.
 */
const args=process.argv.slice(2);
const mode=args[0]??"status";
const relatorio=auditar(process.env);
if(mode==="status"){
  console.log("LAB02_STATUS_SEM_REDE");
  for(const fonte of relatorio.fontes) {
    console.log(fonte.fonte+": "+(fonte.pronta?"PRONTA_SOB_DECLARACAO":"BLOQUEADA"));
    for(const motivo of fonte.pendencias)console.log("  - "+motivo);
  }
  console.log("REQUISICOES_REAIS=0 ENVIOS=0");
}else if(mode==="buscar"){
  if(process.env.LAB02_EXECUCAO_UNICA?.toLowerCase()!=="sim"){
    console.error("BLOQUEADO: LAB02_EXECUCAO_UNICA deve ser sim somente na sondagem autorizada");
    process.exitCode=2;
  }else if(!relatorio.fontes[0]!.pronta){
    console.error("BLOQUEADO: Shopee sem acesso e documentacao oficialmente confirmados");
    process.exitCode=2;
  }else{
    try {
      const palavra=args[1]??"parafusadeira";
      const resultado=await sondar(process.env,palavra);
      console.log("LAB02_REQUISICOES="+resultado.requisicoes);
      console.log("LAB02_CANDIDATOS_VALIDOS="+resultado.candidatos.length);
      console.log("LAB02_STATUS=SONDAGEM_REAL_SEM_PUBLICACAO");
      // So imprime campos seguros: sem token, assinatura, URLs ou payload.
      for(const item of resultado.candidatos)
        console.log("CANDIDATO "+item.itemId+" "+item.titulo+
          " ESTOQUE=NAO_CONFIRMADO OFERTA=NAO_PUBLICAVEL");
    }catch(error){
      const codigo=error instanceof Bloqueio?error.codigo:"FALHA_INESPERADA";
      console.error("LAB02_BLOQUEIO="+codigo);
      process.exitCode=3;
    }
  }
}else{
  console.error("Modo nao reconhecido: use status ou buscar");
  process.exitCode=2;
}
