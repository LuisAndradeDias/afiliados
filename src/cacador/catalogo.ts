/**
 * Catálogo local do Caçador unificado.
 * Registros são observações MANUAIS ou snapshots legados não verificados.
 * Nenhuma fonte de rede, busca, gerador de link ou WhatsApp é acionada.
 */
import {createHash} from "node:crypto";
import {existsSync,mkdirSync} from "node:fs";
import {dirname} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {
  memoriaClaude,pontuarAchadinhoClaude,titulosParecidosClaude,
  type MemoriaClaude,type ObservacaoClaude,type ResultadoClaude,
  type SinaisClaude,type RegrasClaude
} from "../ofertas/cacador-claude.js";
import {urlProdutoIndividual} from "../painel/mercadolivre-assistido.js";
import {normalizarLinkAfiliadoMercadoLivre} from "../afiliados/mercadolivre.js";
import {validarLinkShopee} from "../painel/shopee-rascunhos.js";

export type CanalCacador="Mercado Livre"|"Amazon"|"Shopee";
export type PagamentoCacador="geral"|"pix"|"cartao";
export type DisponibilidadeCacador="declarada"|"nao-confirmada"|"indisponivel";
export type OrigemCacador="registro-manual"|"snapshot-claude";
export type SituacaoCacador="revisar"|"acompanhar"|"bloqueado";
export class ErroCatalogo extends Error {
  constructor(mensagem:string,readonly statusCode=400){super(mensagem);this.name="ErroCatalogo";}
}
export interface EntradaCacador {
  canal:CanalCacador;produtoId:string;titulo:string;vendedor:string;variante:string;
  pagamento:PagamentoCacador;precoCentavos:number;freteCentavos:number|null;
  precoAnteriorCentavos:number|null;urlProduto:string;urlAfiliado?:string|null;
  imagemUrl?:string|null;nota?:number|null;avaliacoes?:number|null;
  vendidos?:number|null;freteGratis?:boolean;full?:boolean;
  maisVendido?:boolean;cupomCodigo?:string|null;
  comissaoEstimadaPercentual?:number|null;
  disponibilidade:DisponibilidadeCacador;
  confirmadoManualmente:true;
}
export interface EntradaValidada extends EntradaCacador {
  urlAfiliado:string|null;imagemUrl:string|null;nota:number|null;
  avaliacoes:number|null;vendidos:number|null;cupomCodigo:string|null;
  comissaoEstimadaPercentual:number|null;
}
interface LinhaProduto {
  chave:string;canal:CanalCacador;produto_id:string;titulo:string;vendedor:string;
  variante:string;pagamento:PagamentoCacador;preco_centavos:number;
  frete_centavos:number|null;preco_anterior_centavos:number|null;
  url_produto:string;url_afiliado:string|null;imagem_url:string|null;
  nota:number|null;avaliacoes:number|null;vendidos:number|null;
  frete_gratis:number;full:number;mais_vendido:number;
  cupom_codigo:string|null;comissao_estim_pct:number|null;
  disponibilidade:DisponibilidadeCacador;origem:OrigemCacador;
  observado_em:string;criado_em:string;
}
interface LinhaObservacao {
  observado_em:string;preco_centavos:number;frete_centavos:number|null;
  disponibilidade:DisponibilidadeCacador;
}
export interface ProdutoCacador {
  chave:string;canal:CanalCacador;produtoId:string;titulo:string;
  vendedor:string;variante:string;pagamento:PagamentoCacador;
  precoCentavos:number;freteCentavos:number|null;precoTotalCentavos:number|null;
  precoAnteriorCentavos:number|null;descontoAnunciadoPercentual:number|null;
  urlProduto:string;urlAfiliado:string|null;imagemUrl:string|null;
  nota:number|null;avaliacoes:number|null;vendidos:number|null;
  freteGratis:boolean;full:boolean;maisVendido:boolean;
  cupomCodigo:string|null;cupomStatus:"nao-verificado"|"sem-cupom";
  comissaoEstimadaPercentual:number|null;
  disponibilidade:DisponibilidadeCacador;origem:OrigemCacador;
  observadoEmUtc:string;memoria:MemoriaClaude|null;
  memoriaProduto:MemoriaClaude; // preço do item sem inferir custo do frete
  pontuacao:number;situacao:SituacaoCacador;motivo:string;alertas:string[];
  podePublicar:false;observacoes:number;
  serie:{observadoEmUtc:string;precoCentavos:number;precoTotalCentavos:number|null}[];
}
export interface CatalogoConsulta {
  busca?:string;canal?:CanalCacador|"todos";situacao?:SituacaoCacador|"todos";
  limite?:number;
}
export interface ResumoCatalogo {
  total:number;observacoes:number;paraRevisar:number;acompanhar:number;
  bloqueados:number;cuponsNaoVerificados:number;linksRegistrados:number;
  enviosRealizados:0;buscasAutomaticas:0;
}
export interface ResultadoCatalogo {
  modo:"curadoria-manual";
  regraPublicacao:"nunca-autorizar-automaticamente";
  itens:ProdutoCacador[];resumo:ResumoCatalogo;
  fontes:{amazon:"manual";meli:"manual";shopee:"manual"};
}
export const regrasCacadorIntegrado:Readonly<RegrasClaude>=Object.freeze({
  precoMaxCentavos:500_000,descontoMinimoPercentual:20,
  descontoSuspeitoPercentual:85,notaMinima:4.3,avaliacoesMinimas:5,
  pontuacaoMinima:40,ignorarRelampago:true,bloquearAcimaNormal:true
});
const canais=new Set(["Mercado Livre","Amazon","Shopee"]);
const pagamentos=new Set(["geral","pix","cartao"]);
const disponibilidades=new Set(["declarada","nao-confirmada","indisponivel"]);
const MAX_PRODUTOS=1000,MAX_OBSERVACOES_POR_PRODUTO=240;
function texto(v:unknown,nome:string,min:number,max:number):string{
  const s=typeof v==="string"?v.trim().replace(/\s+/g," "):"";
  if(s.length<min||s.length>max||/[\u0000-\u001f\u007f]/.test(s))
    throw new ErroCatalogo(nome+" inválido.");
  return s;
}
function centavos(v:unknown,nome:string,opcional=false):number|null{
  if(opcional&&(v===undefined||v===null||v===""))return null;
  if(typeof v!=="number"||!Number.isSafeInteger(v)||v<0||v>100_000_000||
     (!opcional&&v===0))throw new ErroCatalogo(nome+" inválido: use centavos inteiros.");
  return v;
}
function opcionalNumero(v:unknown,nome:string,min:number,max:number):number|null{
  if(v===undefined||v===null||v==="")return null;
  if(typeof v!=="number"||!Number.isFinite(v)||v<min||v>max)
    throw new ErroCatalogo(nome+" inválido.");
  return v;
}
function inteiroOpcional(v:unknown,nome:string):number|null{
  if(v===undefined||v===null||v==="")return null;
  if(typeof v!=="number"||!Number.isSafeInteger(v)||v<0||v>10_000_000)
    throw new ErroCatalogo(nome+" inválido.");
  return v;
}
function urlHttps(v:unknown,nome:string,dominios:readonly string[],opcional=false):string|null{
  if(opcional&&(v===undefined||v===null||v===""))return null;
  if(typeof v!=="string"||v.length>2048)throw new ErroCatalogo(nome+" inválido.");
  let u:URL;
  try{u=new URL(v.trim());}catch{throw new ErroCatalogo(nome+" inválido.");}
  const host=u.hostname.toLowerCase();
  if(u.protocol!=="https:"||u.port||u.username||u.password||
     !dominios.some(x=>host===x||host.endsWith("."+x))||
     u.pathname==="/"&&nome==="Link do produto")
    throw new ErroCatalogo(nome+" deve ser HTTPS de um domínio permitido.");
  u.hash="";
  return u.toString();
}
function linkProduto(v:unknown,canal:CanalCacador):string{
  if(canal==="Mercado Livre"){
    try{return urlProdutoIndividual(v);}
    catch{throw new ErroCatalogo("Use um anúncio individual do Mercado Livre.");}
  }
  if(canal==="Shopee"){
    try{return validarLinkShopee(v);}
    catch{throw new ErroCatalogo("Use um link de produto Shopee válido.");}
  }
  return urlHttps(v,"Link do produto",["amazon.com.br","amzn.to"])!;
}
function linkAfiliado(v:unknown,canal:CanalCacador):string|null{
  if(v===null||v===undefined||v==="")return null;
  if(canal==="Mercado Livre"){
    try{return normalizarLinkAfiliadoMercadoLivre(String(v));}
    catch{throw new ErroCatalogo("Link de afiliado Meli inválido.");}
  }
  if(canal==="Shopee"){
    try{return validarLinkShopee(v);}
    catch{throw new ErroCatalogo("Link de afiliado Shopee inválido.");}
  }
  return urlHttps(v,"Link de afiliado Amazon",["amazon.com.br","amzn.to"])!;
}
function imagem(v:unknown):string|null{
  return urlHttps(v,"Imagem do produto",[
    "mlstatic.com","media-amazon.com","ssl-images-amazon.com",
    "shopee.com.br","shopee.io"
  ],true);
}
export function validarEntradaCacador(input:unknown):EntradaValidada{
  if(!input||typeof input!=="object"||Array.isArray(input))
    throw new ErroCatalogo("Informe os dados do produto.");
  const x=input as Record<string,unknown>;
  if(!canais.has(String(x.canal)))throw new ErroCatalogo("Canal desconhecido.");
  const canal=x.canal as CanalCacador;
  const produtoId=texto(x.produtoId,"ID do produto",4,70);
  if(!/^[A-Za-z0-9_-]+$/.test(produtoId)||
    (canal==="Mercado Livre"&&!/^MLB[0-9]{6,20}$/i.test(produtoId)))
    throw new ErroCatalogo("ID comercial inválido para o canal.");
  const titulo=texto(x.titulo,"Título",5,160);
  const vendedor=texto(x.vendedor,"Vendedor",2,60);
  const variante=texto(x.variante,"Variante",1,60);
  if(!/^[A-Za-z0-9_-]+$/.test(vendedor)||!/^[A-Za-z0-9_-]+$/.test(variante))
    throw new ErroCatalogo("Vendedor e variante devem usar letras, números, hífen ou _. ");
  if(!pagamentos.has(String(x.pagamento)))throw new ErroCatalogo("Modalidade de pagamento inválida.");
  if(!disponibilidades.has(String(x.disponibilidade)))
    throw new ErroCatalogo("Disponibilidade inválida.");
  if(x.confirmadoManualmente!==true)
    throw new ErroCatalogo("Confirme que registrou manualmente esta observação.");
  const precoCentavos=centavos(x.precoCentavos,"Preço")!;
  const freteCentavos=centavos(x.freteCentavos,"Frete",true);
  const precoAnteriorCentavos=centavos(x.precoAnteriorCentavos,"Preço anterior",true);
  const urlProduto=linkProduto(x.urlProduto,canal);
  const urlAfiliado=linkAfiliado(x.urlAfiliado,canal);
  const imagemUrl=imagem(x.imagemUrl);
  const nota=opcionalNumero(x.nota,"Nota",0,5);
  const avaliacoes=inteiroOpcional(x.avaliacoes,"Avaliações");
  const vendidos=inteiroOpcional(x.vendidos,"Vendidos");
  const comissaoEstimadaPercentual=opcionalNumero(x.comissaoEstimadaPercentual,"Comissão",0,100);
  const cupomCodigo=x.cupomCodigo===undefined||x.cupomCodigo===null||x.cupomCodigo===""?
    null:texto(x.cupomCodigo,"Cupom",3,32).toUpperCase();
  if(cupomCodigo&&!/^[A-Z0-9_-]+$/.test(cupomCodigo))
    throw new ErroCatalogo("Cupom deve conter somente letras, números, _ ou -.");
  const flag=(nome:string)=>{if(x[nome]!==undefined&&typeof x[nome]!=="boolean")
    throw new ErroCatalogo(nome+" deve ser booleano.");return x[nome]===true;};
  return {
    canal,produtoId,titulo,vendedor,variante,
    pagamento:x.pagamento as PagamentoCacador,
    disponibilidade:x.disponibilidade as DisponibilidadeCacador,
    precoCentavos,freteCentavos,precoAnteriorCentavos,urlProduto,
    urlAfiliado,imagemUrl,nota,avaliacoes,vendidos,
    cupomCodigo,comissaoEstimadaPercentual,
    freteGratis:flag("freteGratis"),full:flag("full"),
    maisVendido:flag("maisVendido"),confirmadoManualmente:true
  };
}
export function chaveCacador(entrada:Pick<EntradaCacador,
  "canal"|"produtoId"|"vendedor"|"variante"|"pagamento">):string{
  return createHash("sha256").update(JSON.stringify([
    entrada.canal,entrada.produtoId,entrada.vendedor,
    entrada.variante,entrada.pagamento
  ])).digest("hex");
}
function horaUTC(iso:string,agora:number):string{
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(iso))
    throw new ErroCatalogo("Data UTC inválida.");
  const d=Date.parse(iso);
  if(!Number.isFinite(d)||new Date(d).toISOString().slice(0,19)!==iso.slice(0,19)||
      d>agora+60_000||d<agora-365*86_400_000)
    throw new ErroCatalogo("Data fora do período de importação permitido.");
  return new Date(d).toISOString();
}
function avaliarProduto(p:LinhaProduto,serie:LinhaObservacao[],agora:number):ProdutoCacador{
  const atualTotal=p.frete_centavos===null?null:p.preco_centavos+p.frete_centavos;
  const base:ObservacaoClaude[] = serie
    .filter(x=>x.frete_centavos!==null)
    .map(x=>({
      id:p.produto_id,vendedor:p.vendedor,variante:p.variante,
      pagamento:p.pagamento,
      precoCentavos:x.preco_centavos+x.frete_centavos!,
      observadoEmUtc:x.observado_em
    }));
  const observacaoAtual:ObservacaoClaude|null=atualTotal===null?null:{
    id:p.produto_id,vendedor:p.vendedor,variante:p.variante,
    pagamento:p.pagamento,precoCentavos:atualTotal,
    observadoEmUtc:p.observado_em
  };
  const memoria=observacaoAtual?memoriaClaude(base,observacaoAtual):null;
  const memoriaProduto=memoriaClaude(serie.map(o=>({
    id:p.produto_id,vendedor:p.vendedor,variante:p.variante,
    pagamento:p.pagamento,precoCentavos:o.preco_centavos,
    observadoEmUtc:o.observado_em
  })),{
    id:p.produto_id,vendedor:p.vendedor,variante:p.variante,
    pagamento:p.pagamento,precoCentavos:p.preco_centavos,
    observadoEmUtc:p.observado_em
  });
  const descontoAnunciadoPercentual=p.preco_anterior_centavos
    ?Math.round((1-p.preco_centavos/p.preco_anterior_centavos)*1000)/10:null;
  const sinais:SinaisClaude={
    titulo:p.titulo,precoCentavos:p.preco_centavos,
    descontoAnunciadoPercentual:Math.max(0,descontoAnunciadoPercentual??0),
    nota:p.nota,avaliacoes:p.avaliacoes,vendidos:p.vendidos,
    freteGratis:p.frete_gratis===1,full:p.full===1,
    maisVendido:p.mais_vendido===1,cupomConfirmado:false,
    comissaoEstimadaPercentual:p.comissao_estim_pct
  };
  const score:ResultadoClaude=pontuarAchadinhoClaude(
    sinais,memoria??memoriaProduto,regrasCacadorIntegrado
  );
  const alertas=[
    "Registro manual/legado: não comprova preço ou disponibilidade online",
    ...(p.cupom_codigo?["Cupom observado, não validado para este produto ou conta"]:[]),
    ...(p.url_afiliado?["Link informado, atribuição de comissão não verificada"]:[]),
    ...(score?.alertas??[])
  ];
  let situacao:SituacaoCacador="acompanhar";
  const diasBase=new Set(base.filter(o=>Date.parse(o.observadoEmUtc)<Date.parse(p.observado_em))
    .map(o=>o.observadoEmUtc.slice(0,10))).size;
  if(p.disponibilidade==="indisponivel"){
    situacao="bloqueado";alertas.push("Anúncio declarado indisponível");
  }else if(score?.veredito==="acima"||
      (descontoAnunciadoPercentual!==null&&descontoAnunciadoPercentual>=85)){
    situacao="bloqueado";alertas.push("Preço acima do histórico ou desconto anunciado atípico");
  }else if(memoria?.quedaHistoricaPercentual!==null&&
      memoria?.quedaHistoricaPercentual!==undefined&&memoria.quedaHistoricaPercentual>45){
    situacao="bloqueado";alertas.push("Queda histórica atípica: exige investigação");
  }else if(
    p.disponibilidade==="declarada"&&atualTotal!==null&&
    diasBase>=3&&memoria?.quedaHistoricaPercentual!==null&&
    memoria?.quedaHistoricaPercentual!==undefined&&
    memoria.quedaHistoricaPercentual>=10&&
    score?.podeRevisar&&agora-Date.parse(p.observado_em)<24*3_600_000
  ){
    situacao="revisar";
    alertas.push("Sugestão de análise humana; ainda não é uma oferta aprovada");
  }else{
    if(diasBase<3)alertas.push("Histórico em menos de três datas distintas");
    if(atualTotal===null)alertas.push("Frete desconhecido: sem comparação de custo final");
    if(agora-Date.parse(p.observado_em)>=24*3_600_000)
      alertas.push("Observação antiga, revisar novamente");
    if(p.disponibilidade!=="declarada")alertas.push("Estoque não confirmado");
  }
  return {
    chave:p.chave,canal:p.canal,produtoId:p.produto_id,titulo:p.titulo,
    vendedor:p.vendedor,variante:p.variante,pagamento:p.pagamento,
    precoCentavos:p.preco_centavos,freteCentavos:p.frete_centavos,
    precoTotalCentavos:atualTotal,precoAnteriorCentavos:p.preco_anterior_centavos,
    descontoAnunciadoPercentual,urlProduto:p.url_produto,
    urlAfiliado:p.url_afiliado,imagemUrl:p.imagem_url,
    nota:p.nota,avaliacoes:p.avaliacoes,vendidos:p.vendidos,
    freteGratis:p.frete_gratis===1,full:p.full===1,
    maisVendido:p.mais_vendido===1,cupomCodigo:p.cupom_codigo,
    cupomStatus:p.cupom_codigo?"nao-verificado":"sem-cupom",
    comissaoEstimadaPercentual:p.comissao_estim_pct,
    disponibilidade:p.disponibilidade,origem:p.origem,
    observadoEmUtc:p.observado_em,memoria,memoriaProduto,
    pontuacao:score?.pontuacao??0,situacao,
    motivo:score?.motivo??"Frete desconhecido",
    alertas,podePublicar:false,observacoes:serie.length,
    serie:serie.slice(-30).map(o=>({
      observadoEmUtc:o.observado_em,precoCentavos:o.preco_centavos,
      precoTotalCentavos:o.frete_centavos===null?null:o.preco_centavos+o.frete_centavos
    }))
  };
}
export class CatalogoCacador {
  private db:DatabaseSync|null=null;
  constructor(private readonly arquivo:string,private readonly agora:()=>number=Date.now){}
  private abrir():DatabaseSync{
    if(this.db)return this.db;
    mkdirSync(dirname(this.arquivo),{recursive:true});
    const db=new DatabaseSync(this.arquivo);
    db.exec("PRAGMA busy_timeout=3000; PRAGMA foreign_keys=ON;");
    db.exec([
      "CREATE TABLE IF NOT EXISTS produtos (",
      "chave TEXT PRIMARY KEY,canal TEXT NOT NULL,produto_id TEXT NOT NULL,",
      "titulo TEXT NOT NULL,vendedor TEXT NOT NULL,variante TEXT NOT NULL,pagamento TEXT NOT NULL,",
      "preco_centavos INTEGER NOT NULL,frete_centavos INTEGER,preco_anterior_centavos INTEGER,",
      "url_produto TEXT NOT NULL,url_afiliado TEXT,imagem_url TEXT,",
      "nota REAL,avaliacoes INTEGER,vendidos INTEGER,frete_gratis INTEGER NOT NULL,",
      "full INTEGER NOT NULL,mais_vendido INTEGER NOT NULL,cupom_codigo TEXT,",
      "comissao_estim_pct REAL,disponibilidade TEXT NOT NULL,origem TEXT NOT NULL,",
      "observado_em TEXT NOT NULL,criado_em TEXT NOT NULL);",
      "CREATE TABLE IF NOT EXISTS observacoes (",
      "chave TEXT NOT NULL,observado_em TEXT NOT NULL,preco_centavos INTEGER NOT NULL,",
      "frete_centavos INTEGER,disponibilidade TEXT NOT NULL,",
      "PRIMARY KEY(chave,observado_em),",
      "FOREIGN KEY(chave) REFERENCES produtos(chave) ON DELETE CASCADE);",
      "CREATE INDEX IF NOT EXISTS idx_cacador_obs_chave_tempo",
      "ON observacoes(chave,observado_em DESC);"
    ].join(" "));
    this.db=db;
    return db;
  }
  fechar():void{this.db?.close();this.db=null;}
  /** Registra UMA observação, sem iniciar busca, envio, monitor ou gerador de links. */
  registrar(input:unknown,opcoes?:{instanteUtc?:string;origem?:OrigemCacador}):ProdutoCacador{
    const d=validarEntradaCacador(input);
    const agora=this.agora();
    const momento=opcoes?.instanteUtc?horaUTC(opcoes.instanteUtc,agora):
      new Date(agora).toISOString();
    const origem=opcoes?.origem==="snapshot-claude"?"snapshot-claude":"registro-manual";
    const chave=chaveCacador(d);
    const db=this.abrir();
    if(!db.prepare("SELECT chave FROM produtos WHERE chave=?").get(chave)){
      const n=(db.prepare("SELECT COUNT(*) n FROM produtos").get() as {n:number}).n;
      if(n>=MAX_PRODUTOS)throw new ErroCatalogo("Catálogo local atingiu 1000 produtos.",409);
    }
    db.exec("BEGIN IMMEDIATE");
    try{
      const existente=db.prepare("SELECT preco_centavos,frete_centavos,disponibilidade FROM observacoes WHERE chave=? AND observado_em=?")
        .get(chave,momento) as {preco_centavos:number;frete_centavos:number|null;disponibilidade:DisponibilidadeCacador}|undefined;
      if(existente&&(existente.preco_centavos!==d.precoCentavos||
          existente.frete_centavos!==d.freteCentavos||existente.disponibilidade!==d.disponibilidade))
        throw new ErroCatalogo("Conflito: mesma observação com valores diferentes.",409);
      db.prepare([
        "INSERT INTO produtos (chave,canal,produto_id,titulo,vendedor,variante,pagamento,",
        "preco_centavos,frete_centavos,preco_anterior_centavos,url_produto,url_afiliado,imagem_url,",
        "nota,avaliacoes,vendidos,frete_gratis,full,mais_vendido,cupom_codigo,comissao_estim_pct,",
        "disponibilidade,origem,observado_em,criado_em)",
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        "ON CONFLICT(chave) DO UPDATE SET",
        "titulo=excluded.titulo,preco_centavos=excluded.preco_centavos,",
        "frete_centavos=excluded.frete_centavos,preco_anterior_centavos=excluded.preco_anterior_centavos,",
        "url_produto=excluded.url_produto,url_afiliado=COALESCE(excluded.url_afiliado,produtos.url_afiliado),",
        "imagem_url=COALESCE(excluded.imagem_url,produtos.imagem_url),",
        "nota=COALESCE(excluded.nota,produtos.nota),",
        "avaliacoes=COALESCE(excluded.avaliacoes,produtos.avaliacoes),",
        "vendidos=COALESCE(excluded.vendidos,produtos.vendidos),",
        "frete_gratis=excluded.frete_gratis,full=excluded.full,",
        "mais_vendido=excluded.mais_vendido,cupom_codigo=COALESCE(excluded.cupom_codigo,produtos.cupom_codigo),",
        "comissao_estim_pct=COALESCE(excluded.comissao_estim_pct,produtos.comissao_estim_pct),",
        "disponibilidade=excluded.disponibilidade,origem=excluded.origem,",
        "observado_em=excluded.observado_em",
        "WHERE excluded.observado_em >= produtos.observado_em"
      ].join(" ")).run(
        chave,d.canal,d.produtoId,d.titulo,d.vendedor,d.variante,d.pagamento,
        d.precoCentavos,d.freteCentavos,d.precoAnteriorCentavos,d.urlProduto,d.urlAfiliado,
        d.imagemUrl,d.nota,d.avaliacoes,d.vendidos,Number(d.freteGratis),
        Number(d.full),Number(d.maisVendido),d.cupomCodigo,d.comissaoEstimadaPercentual,
        d.disponibilidade,origem,momento,momento
      );
      if(!existente)db.prepare(
        "INSERT INTO observacoes(chave,observado_em,preco_centavos,frete_centavos,disponibilidade) VALUES(?,?,?,?,?)"
      ).run(chave,momento,d.precoCentavos,d.freteCentavos,d.disponibilidade);
      db.prepare([
        "DELETE FROM observacoes WHERE chave=? AND observado_em NOT IN",
        "(SELECT observado_em FROM observacoes WHERE chave=? ORDER BY observado_em DESC LIMIT ?)"
      ].join(" ")).run(chave,chave,MAX_OBSERVACOES_POR_PRODUTO);
      db.exec("COMMIT");
    }catch(e){db.exec("ROLLBACK");throw e;}
    return this.obter(chave)!;
  }
  private linhas():LinhaProduto[]{
    if(!this.db&&!existsSync(this.arquivo))return [];
    const db=this.abrir();
    return db.prepare("SELECT * FROM produtos ORDER BY observado_em DESC, chave ASC LIMIT 1000")
      .all() as unknown as LinhaProduto[];
  }
  obter(chave:string):ProdutoCacador|null{
    if(!/^[a-f0-9]{64}$/.test(chave))return null;
    if(!this.db&&!existsSync(this.arquivo))return null;
    const db=this.abrir();
    const produto=db.prepare("SELECT * FROM produtos WHERE chave=?").get(chave) as LinhaProduto|undefined;
    return produto?this.transformar(produto):null;
  }
  private transformar(p:LinhaProduto):ProdutoCacador{
    const db=this.abrir();
    const serie=db.prepare(
      "SELECT observado_em,preco_centavos,frete_centavos,disponibilidade FROM observacoes WHERE chave=? ORDER BY observado_em ASC LIMIT 240"
    ).all(p.chave) as unknown as LinhaObservacao[];
    return avaliarProduto(p,serie,this.agora());
  }
  listar(filtros:CatalogoConsulta={}):ResultadoCatalogo{
    const all=this.linhas().map(p=>this.transformar(p));
    const resumo:ResumoCatalogo={
      total:all.length,
      observacoes:all.reduce((n,p)=>n+p.observacoes,0),
      paraRevisar:all.filter(x=>x.situacao==="revisar").length,
      acompanhar:all.filter(x=>x.situacao==="acompanhar").length,
      bloqueados:all.filter(x=>x.situacao==="bloqueado").length,
      cuponsNaoVerificados:all.filter(x=>x.cupomCodigo!==null).length,
      linksRegistrados:all.filter(x=>x.urlAfiliado!==null).length,
      enviosRealizados:0,buscasAutomaticas:0
    };
    const busca=(filtros.busca??"").trim().slice(0,100).toLocaleLowerCase("pt-BR");
    const itens=all.filter(p=>
      (!busca||[p.titulo,p.produtoId,p.vendedor].some(s=>
        s.toLocaleLowerCase("pt-BR").includes(busca)))&&
      (!filtros.canal||filtros.canal==="todos"||p.canal===filtros.canal)&&
      (!filtros.situacao||filtros.situacao==="todos"||p.situacao===filtros.situacao)
    ).sort((a,b)=>({revisar:0,acompanhar:1,bloqueado:2}[a.situacao]-
      {revisar:0,acompanhar:1,bloqueado:2}[b.situacao])||
      b.pontuacao-a.pontuacao||b.observadoEmUtc.localeCompare(a.observadoEmUtc))
      .slice(0,Math.max(1,Math.min(200,filtros.limite??100)));
    return {
      modo:"curadoria-manual",regraPublicacao:"nunca-autorizar-automaticamente",
      itens,resumo, fontes:{amazon:"manual",meli:"manual",shopee:"manual"}
    };
  }
  detectarSimilares(titulo:string,ignorarChave?:string):string[]{
    return this.linhas().filter(p=>p.chave!==ignorarChave&&
      titulosParecidosClaude(p.titulo,titulo)).map(p=>p.chave).slice(0,20);
  }
}
