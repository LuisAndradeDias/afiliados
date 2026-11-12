/** Laboratório OFFLINE do Caça Promos VIP: nenhum acesso a sites, contas ou WhatsApp. */
export type Canal="Amazon"|"Shopee"|"Mercado Livre";
export type Origem="fixture-amazon-creators"|"fixture-shopee-afiliados"|"fixture-meli-curadoria";
export type Estado="revisar"|"acompanhar"|"bloqueado";
export interface Cupom{codigo:string;descontoCentavos:number;minimoCentavos:number;
  expiraEmUtc:string;status:"regras-fixture"|"nao-verificado"}
export interface Observacao {
 canal:Canal;origem:Origem;id:string;titulo:string;vendedor:string;variante:string;
 pagamento:"geral"|"pix"|"cartao";moeda:"BRL";precoCentavos:number;
 freteCentavos:number|null;estoque:"confirmado-fixture"|"nao-confirmado";
 observadoEmUtc:string;cupom?:Cupom
}
export interface Ciclo{nome:string;instanteUtc:string;observacoes:Observacao[]}
export interface Avaliacao{
 chave:string;canal:Canal;origem:Origem;titulo:string;vendedor:string;variante:string;
 precoCentavos:number;freteCentavos:number|null;precoTotalCentavos:number|null;
 historicoReferencias:number;precoReferenciaCentavos:number|null;
 reducaoPercentual:number|null;status:Estado;razoes:string[];
 cupomStatus:"sem-cupom"|"nao-verificado"|"simulado-valido"|"simulado-expirado";
 cupomDescontoEstimadoCentavos:number;custoEstimadoComCupomCentavos:number|null;
 estoque:Observacao["estoque"];observadoEmUtc:string;pagamento:Observacao["pagamento"];
 podePublicar:false;fonteRealAutorizada:false;
 serie:{instanteUtc:string;precoTotalCentavos:number|null}[];
}
export interface RelatorioCiclo{
 nome:string;instanteUtc:string;recebidas:number;aceitas:number;repetidas:number;
 rejeitadas:number;novasIdentidades:number;
 fontes:{amazon:number;shopee:number;meliAssistido:number};
 revisao:number;bloqueadas:number;acompanhar:number;avaliacoes:Avaliacao[]
}
export interface Relatorio{
 etiqueta:"SIMULACAO_SEM_DADOS_REAIS";ciclos:RelatorioCiclo[];
 resumo:{ciclos:number;recebidas:number;aceitas:number;repetidas:number;rejeitadas:number;
 oportunidadesFinal:number;bloqueadasFinal:number;acompanharFinal:number;
 origensAutomaticasReais:0;enviosRealizados:0;coletaMeliApiRealizada:0}
}
export const chave=(o:Observacao):string=>[o.canal,o.id,o.vendedor,o.variante,o.pagamento].join("|");
function data(v:string):number{
 if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v))
  throw Error("data inválida");
 const t=Date.parse(v);
 if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,19)!==v.slice(0,19))
  throw Error("data impossível");
 return t;
}
const origens:Record<Canal,Origem>={Amazon:"fixture-amazon-creators",
 Shopee:"fixture-shopee-afiliados","Mercado Livre":"fixture-meli-curadoria"};
function validar(o:Observacao,agora:number):void{
 if(!o||origens[o.canal]!==o.origem||!/^[A-Za-z0-9_-]{4,70}$/.test(o.id)||
  typeof o.titulo!=="string"||!o.titulo.trim()||o.titulo.length>100||
  /[\u0000-\u001f\u007f]/.test(o.titulo)||
  !/^[A-Za-z0-9_-]{2,60}$/.test(o.vendedor)||
  !/^[A-Za-z0-9_-]{2,60}$/.test(o.variante)||
  !["geral","pix","cartao"].includes(o.pagamento)||o.moeda!=="BRL"||
  !Number.isSafeInteger(o.precoCentavos)||o.precoCentavos<=0||o.precoCentavos>100_000_000||
  !(o.freteCentavos===null||(Number.isSafeInteger(o.freteCentavos)&&
    o.freteCentavos>=0&&o.freteCentavos<=10_000_000))||
  !["confirmado-fixture","nao-confirmado"].includes(o.estoque))
  throw Error("observação inválida");
 const t=data(o.observadoEmUtc);
 if(t>agora+60_000||t<agora-30*86400_000)throw Error("observação fora da janela");
 if(o.cupom){
  const c=o.cupom;
  if(!/^[A-Za-z0-9_-]{3,32}$/.test(c.codigo)||
   !Number.isSafeInteger(c.descontoCentavos)||c.descontoCentavos<=0||
   !Number.isSafeInteger(c.minimoCentavos)||c.minimoCentavos<0||
   !["regras-fixture","nao-verificado"].includes(c.status))throw Error("cupom inválido");
  data(c.expiraEmUtc);
 }
}
function mediana(a:number[]):number{
 const s=[...a].sort((x,y)=>x-y),i=Math.floor(s.length/2);
 return s.length%2?s[i]:Math.round((s[i-1]+s[i])/2);
}
export function executar(ciclos:readonly Ciclo[]):Relatorio{
 if(ciclos.length<1||ciclos.length>24)throw Error("ciclos inválidos");
 const historico=new Map<string,Observacao[]>(),relatorios:RelatorioCiclo[]=[];
 let ultimoTempo=-Infinity,totalRecebidas=0,totalAceitas=0,totalRepetidas=0,totalRejeitadas=0;
 for(const ciclo of ciclos){
  const agora=data(ciclo.instanteUtc);
  if(agora<=ultimoTempo||ciclo.observacoes.length>200)throw Error("ordem ou lote inválido");
  ultimoTempo=agora;
  let aceitas=0,repetidas=0,rejeitadas=0,novasIdentidades=0;
  const fontes={amazon:0,shopee:0,meliAssistido:0};
  const vistas=new Set<string>();
  for(const entrada of ciclo.observacoes){
   try{
    validar(entrada,agora);
    const id=chave(entrada),rows=historico.get(id)??[];
    const antiga=rows.find(a=>a.observadoEmUtc===entrada.observadoEmUtc);
    if(antiga){
     const sig=(o:Observacao)=>JSON.stringify([o.precoCentavos,o.freteCentavos,
      o.estoque,o.titulo,o.cupom??null]);
     if(sig(antiga)===sig(entrada))repetidas++;else rejeitadas++;
     continue;
    }
    if(!historico.has(id)){historico.set(id,[]);novasIdentidades++;}
    historico.get(id)!.push(structuredClone(entrada));aceitas++;
    if(!vistas.has(id)){
     vistas.add(id);
     if(entrada.canal==="Amazon")fontes.amazon++;
     if(entrada.canal==="Shopee")fontes.shopee++;
     if(entrada.canal==="Mercado Livre")fontes.meliAssistido++;
    }
   }catch{rejeitadas++;}
  }
  const avaliacoes:Avaliacao[]=[];
  for(const [id,rows] of historico){
   const serie=rows.filter(a=>data(a.observadoEmUtc)<=agora&&
    data(a.observadoEmUtc)>=agora-30*86400_000)
    .sort((a,b)=>data(a.observadoEmUtc)-data(b.observadoEmUtc));
   if(!serie.length)continue;
   const atual=serie.at(-1)!,total=atual.freteCentavos===null?null:
    atual.precoCentavos+atual.freteCentavos;
   const prev=serie.slice(0,-1).filter(a=>
    a.freteCentavos!==null&&a.estoque==="confirmado-fixture");
   const dias=new Set(prev.map(x=>x.observadoEmUtc.slice(0,10)));
   const base=dias.size>=3?mediana(prev.slice(-3).map(a=>
    a.precoCentavos+a.freteCentavos!)):null;
   const queda=base!==null&&total!==null?
    Math.round((base-total)/base*1000)/10:null;
   const razoes:string[]=[];
   let status:Estado="acompanhar";
   if(agora-data(atual.observadoEmUtc)>24*3600_000)
    razoes.push("Observação desatualizada");
   if(atual.estoque!=="confirmado-fixture")
    razoes.push("Estoque não confirmado");
   if(total===null)razoes.push("Frete desconhecido");
   if(queda!==null&&queda>45)razoes.push("Queda atípica: exige investigação");
   if(razoes.length)status="bloqueado";
   else if(base===null)razoes.push("Histórico insuficiente");
   else if(queda===null||queda<10)razoes.push("Sem queda relevante comprovável");
   else{status="revisar";razoes.push(
    atual.canal==="Mercado Livre"?"Curadoria assistida: revisão humana":
    "Candidato automático para revisão humana, não oferta aprovada");}
   let cupomStatus:Avaliacao["cupomStatus"]="sem-cupom",desconto=0,
    estimado=total;
   if(atual.cupom){
    const c=atual.cupom,ativo=data(c.expiraEmUtc)>=agora;
    const simulado=ativo&&c.status==="regras-fixture"&&
     atual.precoCentavos>=c.minimoCentavos;
    cupomStatus=simulado?"simulado-valido":!ativo?
     "simulado-expirado":"nao-verificado";
    if(simulado){
     desconto=Math.min(c.descontoCentavos,atual.precoCentavos-1);
     if(estimado!==null)estimado-=desconto;
    }
    razoes.push(simulado?"Cupom fictício: total estimado, não confirmado no checkout":
     "Cupom não validado: não aplicado");
   }
   avaliacoes.push({
    chave:id,canal:atual.canal,origem:atual.origem,titulo:atual.titulo,
    vendedor:atual.vendedor,variante:atual.variante,
    precoCentavos:atual.precoCentavos,freteCentavos:atual.freteCentavos,
    precoTotalCentavos:total,precoReferenciaCentavos:base,
    historicoReferencias:dias.size,reducaoPercentual:queda,
    status,razoes,cupomStatus,cupomDescontoEstimadoCentavos:desconto,
    custoEstimadoComCupomCentavos:estimado,estoque:atual.estoque,
    pagamento:atual.pagamento,observadoEmUtc:atual.observadoEmUtc,
    podePublicar:false,fonteRealAutorizada:false,
    serie:serie.map(a=>({instanteUtc:a.observadoEmUtc,
     precoTotalCentavos:a.freteCentavos===null?null:
      a.precoCentavos+a.freteCentavos}))
   });
  }
  const priority:Record<Estado,number>={revisar:0,bloqueado:1,acompanhar:2};
  avaliacoes.sort((a,b)=>priority[a.status]-priority[b.status]||
   (b.reducaoPercentual??-999)-(a.reducaoPercentual??-999)||
   a.chave.localeCompare(b.chave));
  const resultado:RelatorioCiclo={
   nome:ciclo.nome,instanteUtc:ciclo.instanteUtc,recebidas:ciclo.observacoes.length,
   aceitas,repetidas,rejeitadas,novasIdentidades,fontes,
   revisao:avaliacoes.filter(a=>a.status==="revisar").length,
   bloqueadas:avaliacoes.filter(a=>a.status==="bloqueado").length,
   acompanhar:avaliacoes.filter(a=>a.status==="acompanhar").length,
   avaliacoes
  };
  relatorios.push(resultado);
  totalRecebidas+=resultado.recebidas;totalAceitas+=aceitas;
  totalRepetidas+=repetidas;totalRejeitadas+=rejeitadas;
 }
 const ultimo=relatorios.at(-1)!;
 return {etiqueta:"SIMULACAO_SEM_DADOS_REAIS",ciclos:relatorios,
  resumo:{ciclos:ciclos.length,recebidas:totalRecebidas,
   aceitas:totalAceitas,repetidas:totalRepetidas,
   rejeitadas:totalRejeitadas,oportunidadesFinal:ultimo.revisao,
   bloqueadasFinal:ultimo.bloqueadas,acompanharFinal:ultimo.acompanhar,
   origensAutomaticasReais:0,enviosRealizados:0,coletaMeliApiRealizada:0}};
}
