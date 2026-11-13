/**
 * Adaptação segura das ideias de achadinhos.py e banco.py (projeto Claude).
 * Módulo PURO: não executa busca, não abre navegador e nunca autoriza envio.
 * Memória: apenas mesmo produto/anúncio, vendedor, variante e pagamento.
 */
export type VereditoClaude = "aprendendo"|"menor_preco"|"bom_preco"|"normal"|"acima";
export type ModalidadeClaude = "geral"|"pix"|"cartao";
export interface ObservacaoClaude {
  id:string; vendedor:string; variante:string; pagamento:ModalidadeClaude;
  precoCentavos:number; observadoEmUtc:string;
}
export interface MemoriaClaude {
  veredito:VereditoClaude; observacoes:number; periodos:number;
  precoNormalCentavos:number|null; menorPrecoCentavos:number|null;
  maiorPrecoCentavos:number|null; variacaoPercentual:number|null;
  quedaHistoricaPercentual:number|null;
}
export interface SinaisClaude {
  titulo:string; precoCentavos:number; descontoAnunciadoPercentual?:number|null;
  tipoPromocao?:"comum"|"relampago"; nota?:number|null;
  avaliacoes?:number|null; vendidos?:number|null; freteGratis?:boolean;
  full?:boolean; maisVendido?:boolean; cupomConfirmado?:boolean;
  comissaoEstimadaPercentual?:number|null;
}
export interface RegrasClaude {
  precoMaxCentavos:number; descontoMinimoPercentual:number;
  descontoSuspeitoPercentual:number; notaMinima:number;
  avaliacoesMinimas:number; pontuacaoMinima:number;
  ignorarRelampago:boolean; bloquearAcimaNormal:boolean;
}
export const regrasOriginaisClaude:Readonly<RegrasClaude>=Object.freeze({
  precoMaxCentavos:8000,descontoMinimoPercentual:15,
  descontoSuspeitoPercentual:85,notaMinima:4.3,
  avaliacoesMinimas:5,pontuacaoMinima:40,
  ignorarRelampago:true,bloquearAcimaNormal:true
});
export interface ResultadoClaude {
  podeRevisar:boolean; podePublicar:false; pontuacao:number;
  veredito:VereditoClaude; motivo:string; alertas:string[];
}
const VA=[ "de","da","do","das","dos","com","para","e","em","a","o","kit","cor","un","unidades" ];
const VAZIAS=new Set(VA);
function palavras(titulo:string):Set<string>{
  const normalizado=(titulo||"").toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"");
  return new Set((normalizado.match(/[a-z0-9]+/g)||[]).filter(w=>w.length>1&&!VAZIAS.has(w)));
}
/** Sinal auxiliar de duplicação: nunca substitui ID, vendedor ou variante. */
export function titulosParecidosClaude(a:string,b:string,limite=0.6):boolean{
  const x=palavras(a),y=palavras(b);
  if(!x.size||!y.size)return false;
  const comum=[...x].filter(w=>y.has(w)).length;
  const uniao=new Set([...x,...y]).size;
  return comum/uniao>=limite ||
    (Math.min(x.size,y.size)>=4&&comum/Math.min(x.size,y.size)>=0.85);
}
function mediana(lista:number[]):number{
  const a=[...lista].sort((x,y)=>x-y);
  const p=Math.floor(a.length/2);
  return a.length%2?a[p]!:Math.round((a[p-1]!+a[p]!)/2);
}
function tempo(t:string):number{
  if(typeof t!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(t))
    throw Error("Instante UTC inválido");
  const ms=Date.parse(t);
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,19)!==t.slice(0,19))
    throw Error("Data UTC impossível");
  return ms;
}
function precoValido(n:number):boolean{
  return Number.isSafeInteger(n)&&n>0&&n<=100_000_000;
}
function mesmaIdentidade(a:ObservacaoClaude,b:ObservacaoClaude):boolean{
  return a.id===b.id&&a.vendedor===b.vendedor&&
    a.variante===b.variante&&a.pagamento===b.pagamento;
}
const inicial:MemoriaClaude={
  veredito:"aprendendo",observacoes:0,periodos:0,
  precoNormalCentavos:null,menorPrecoCentavos:null,
  maiorPrecoCentavos:null,variacaoPercentual:null,
  quedaHistoricaPercentual:null
};
/** Observações anteriores à atual, agrupadas em intervalos UTC de seis horas. */
export function memoriaClaude(
  observacoes:readonly ObservacaoClaude[],atual:ObservacaoClaude
):MemoriaClaude{
  const atualMs=tempo(atual.observadoEmUtc);
  if(!precoValido(atual.precoCentavos))throw Error("Preço atual inválido");
  const anteriores=new Map<string,number>();
  let total=0;
  for(const o of observacoes){
    if(!mesmaIdentidade(o,atual)||!precoValido(o.precoCentavos))continue;
    const ms=tempo(o.observadoEmUtc);
    if(ms>=atualMs)continue; // não aprender com o próprio preço ou dados futuros
    const d=new Date(ms);
    const periodo=d.toISOString().slice(0,10)+"#"+Math.floor(d.getUTCHours()/6);
    anteriores.set(periodo,Math.min(anteriores.get(periodo)??Infinity,o.precoCentavos));
    total++;
  }
  const precos=[...anteriores.values()];
  if(!precos.length)return {...inicial};
  const normal=mediana(precos),menor=Math.min(...precos),maior=Math.max(...precos);
  const variacao=Math.round((atual.precoCentavos/normal-1)*1000)/10;
  let veredito:VereditoClaude="aprendendo";
  if(precos.length>=2){
    if(atual.precoCentavos<menor)veredito="menor_preco";
    else if(atual.precoCentavos<=normal*.92)veredito="bom_preco";
    else if(atual.precoCentavos>=normal*1.05)veredito="acima";
    else veredito="normal";
  }
  return {
    veredito,observacoes:total,periodos:precos.length,
    precoNormalCentavos:normal,menorPrecoCentavos:menor,
    maiorPrecoCentavos:maior,variacaoPercentual:variacao,
    quedaHistoricaPercentual:Math.round((1-atual.precoCentavos/normal)*1000)/10
  };
}
function numero(x:number|null|undefined,padrao=0):number{
  return typeof x==="number"&&Number.isFinite(x)?x:padrao;
}
const ajustes:Record<VereditoClaude,number>={
  menor_preco:15,bom_preco:8,normal:0,aprendendo:0,acima:-25
};
/**
 * Pontuação do Claude adaptada com alerta e cupom apenas quando confirmado.
 * O resultado é SOMENTE uma sugestão para revisão humana, nunca liberação.
 */
export function pontuarAchadinhoClaude(
  o:SinaisClaude,mem:MemoriaClaude,
  cfg:Readonly<RegrasClaude>=regrasOriginaisClaude
):ResultadoClaude{
  const sem=(motivo:string,alertas:string[]=[]):ResultadoClaude=>({
    podeRevisar:false,podePublicar:false,pontuacao:0,
    veredito:mem.veredito,motivo,alertas
  });
  if(!o||!o.titulo?.trim()||!precoValido(o.precoCentavos))
    return sem("Dados de produto ou preço inválidos");
  const max=cfg.precoMaxCentavos;
  if(!precoValido(max)||cfg.pontuacaoMinima<0||cfg.pontuacaoMinima>100)
    throw Error("Regras inválidas");
  const descInformado=numero(o.descontoAnunciadoPercentual);
  if(descInformado<0||descInformado>100)return sem("Desconto anunciado inválido");
  if(cfg.ignorarRelampago&&o.tipoPromocao==="relampago")
    return sem("Promoção relâmpago excluída");
  if(o.precoCentavos>max)return sem("Acima do preço máximo");
  if(descInformado>=cfg.descontoSuspeitoPercentual)
    return sem("Desconto anunciado suspeito");
  if(mem.veredito==="acima"&&cfg.bloquearAcimaNormal)
    return sem("Acima do preço normal observado");
  const historicoBom=mem.veredito==="bom_preco"||mem.veredito==="menor_preco";
  if(descInformado<cfg.descontoMinimoPercentual&&!historicoBom)
    return sem("Desconto insuficiente e sem queda histórica");
  const aval=numero(o.avaliacoes),nota=numero(o.nota);
  if(o.nota!==null&&o.nota!==undefined&&(!Number.isFinite(o.nota)||o.nota<0||o.nota>5))
    return sem("Avaliação inválida");
  if(o.vendidos!==null&&o.vendidos!==undefined&&(!Number.isFinite(o.vendidos)||o.vendidos<0))
    return sem("Vendas inválidas");
  if(o.avaliacoes!==null&&o.avaliacoes!==undefined&&(!Number.isFinite(o.avaliacoes)||aval<0))
    return sem("Avaliações inválidas");
  if(nota>0&&nota<cfg.notaMinima&&aval>=5)return sem("Nota baixa");
  if(o.avaliacoes!==null&&o.avaliacoes!==undefined&&aval<cfg.avaliacoesMinimas)
    return sem("Poucas avaliações");
  const descontoUsado=historicoBom?
    Math.max(descInformado,mem.quedaHistoricaPercentual??0):descInformado;
  let pontos=Math.min(descontoUsado,70)/70*30;
  pontos+=Math.max(0,1-o.precoCentavos/max)*15;
  if(nota>0)pontos+=Math.max(0,Math.min(1,(nota-4)))*15;
  const prova=Math.max(aval,numero(o.vendidos)/5);
  pontos+=Math.min(1,Math.log10(prova+1)/4)*15;
  pontos+=7*Number(Boolean(o.freteGratis));
  pontos+=5*Number(Boolean(o.full));
  pontos+=5*Number(Boolean(o.maisVendido));
  pontos+=3*Number(o.cupomConfirmado===true);
  pontos+=Math.min(Math.max(numero(o.comissaoEstimadaPercentual),0),16)/16*5;
  pontos+=ajustes[mem.veredito];
  const pontuacao=Math.round(Math.max(0,Math.min(100,pontos))*10)/10;
  const alertas=[
    "Pontuação é triagem; exige preço, estoque, origem e canal autorizados",
    ...(mem.periodos<2?["Memória ainda insuficiente para afirmar desconto real"]:[]),
    ...(!o.cupomConfirmado?["Cupom sem comprovação não contribui na nota"]:[])
  ];
  return {podeRevisar:pontuacao>=cfg.pontuacaoMinima,
    podePublicar:false,pontuacao,veredito:mem.veredito,
    motivo:pontuacao>=cfg.pontuacaoMinima?"Candidato para revisão humana":"Pontuação insuficiente",
    alertas};
}
