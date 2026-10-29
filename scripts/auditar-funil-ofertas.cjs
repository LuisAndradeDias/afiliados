"use strict";

/**
 * Auditoria apenas de leitura: nunca envia, aprova ou prepara ofertas.
 * Projetar apenas indicadores agregados e codigos; descartar payloads
 * como historico, titulos, URL, telefones, grupos e credenciais.
 */
const baseArg=process.argv[2]||"http://127.0.0.1:3030";

function endpointLocal(argumento) {
  let u;
  try {u=new URL(argumento);}
  catch {throw Error("Endereco local invalido");}
  if(u.protocol!=="http:"||
     !["127.0.0.1","localhost"].includes(u.hostname)||
     !u.port || u.pathname!=="/" || u.search || u.hash ||
     u.username || u.password) {
    throw Error("Somente endereco HTTP local permitido");
  }
  return u.origin;
}

function numeroSeguro(value){
  return Number.isSafeInteger(value)&&value>=0?value:null;
}

function codigoSeguro(value) {
  return typeof value==="string"&&/^[A-Z][A-Z0-9_]{2,79}$/.test(value)
    ? value:null;
}

function estadoSeguro(value) {
  return typeof value==="string"&&/^[a-z][a-z0-9-]{1,39}$/.test(value)
    ? value:"indisponivel";
}

async function ler(base,path){
  const response=await fetch(base+path,{
    method:"GET",redirect:"error",
    headers:{accept:"application/json"},
    signal:AbortSignal.timeout(5000)
  });
  if(!response.ok)throw Error("Consulta local indisponivel");
  try {return await response.json();}
  catch {throw Error("Resposta local invalida");}
}

async function main(){
  const base=endpointLocal(baseArg);
  const [s,r]=await Promise.all([
    ler(base,"/api/status"),ler(base,"/api/revisao")
  ]);
  if(!s||typeof s!=="object"||
     !r||r.modo!=="somente-leitura"||
     !r.resumo||typeof r.resumo!=="object"){
    throw Error("Fonte sem contrato de somente leitura");
  }

  const codigos=new Map();
  const fichas=Array.isArray(r.fichas)?r.fichas:[];
  for(const ficha of fichas.slice(0,300)){
    const motivos=Array.isArray(ficha?.decisao?.motivos)
      ? ficha.decisao.motivos:[];
    for(const motivo of motivos.slice(0,20)){
      const codigo=codigoSeguro(motivo?.codigo);
      if(codigo)codigos.set(codigo,(codigos.get(codigo)||0)+1);
    }
  }
  const backoff=s.mercadoLivreMonitorBackoffMinutos;
  const relatorio={
    modo:"somente-leitura",
    estado:estadoSeguro(s.operacaoEstado),
    envioAutomatico:s.whatsappAutoEnvioAtivo===true,
    monitorAlternado:s.monitorAlternadoAtivo===true,
    monitorMercadoLivre:s.mercadoLivreMonitorAtivo===true,
    canal:codigoSeguro(s.canalElegibilidade?.codigo)||"INDEFINIDO",
    mercadoLivre:{
      backoffMinutos:numeroSeguro(backoff)
    },
    cupons:{
      observados:numeroSeguro(s.mercadoLivreCuponsTotal),
      ativos:numeroSeguro(s.mercadoLivreCuponsAtivos)
    },
    revisao:{
      candidatos:numeroSeguro(r.resumo.candidatos),
      bloqueados:numeroSeguro(r.resumo.bloqueados),
      precisamRevisao:numeroSeguro(r.resumo.necessitamRevisao),
      aprovados:numeroSeguro(r.resumo.aprovados)
    },
    codigosBloqueio:[...codigos.entries()]
      .sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([codigo,quantidade])=>({codigo,quantidade}))
  };
  process.stdout.write(JSON.stringify(relatorio,null,2)+"\n");
}
main().catch(()=>{
  process.stderr.write("AUDITORIA_FALHOU: consulta local indisponivel ou invalida.\n");
  process.exitCode=1;
});
