/** LAB-02: somente uma sondagem de API. DESATIVADA por padrao.
 * A assinatura e os campos do GraphQL sao PROVISORIOS, a conferir
 * com a documentacao disponibilizada na conta oficial da Shopee.
 */
import {createHash} from "node:crypto";

export type Vars=Record<string,string|undefined>;
export const API_URL="https://open-api.affiliate.shopee.com.br/graphql" as const;
export const LIMIT=5;
const yes=(v:Vars,k:string)=>v[k]?.trim().toLowerCase()==="sim";
const has=(v:Vars,k:string)=>!!v[k]?.trim();
export interface Estado {fonte:string; pronta:boolean; pendencias:string[]}
export interface Auditoria {
  tipo:"SEM_CONSULTAS_REAIS"; fontes:Estado[];
  consultas:0;envios:0;resultadosReais:0;
}
function check(fonte:string,items:Array<[boolean,string]>):Estado{
  return {fonte,pronta:items.every(x=>x[0]),
    pendencias:items.filter(x=>!x[0]).map(x=>x[1])};
}
export function auditar(vars:Vars):Auditoria{
  return {tipo:"SEM_CONSULTAS_REAIS",consultas:0,envios:0,resultadosReais:0,
    fontes:[
      check("Shopee",[
        [yes(vars,"LAB02_SHOPEE_API_APROVADA"),"API da conta nao liberada"],
        [yes(vars,"LAB02_SHOPEE_DOC_OFICIAL_CONFERIDO"),"Assinatura/query nao confirmadas em docs oficiais"],
        [yes(vars,"LAB02_SHOPEE_USO_DADOS_PERMITIDO"),"Uso de dados e automacao nao autorizado"],
        [has(vars,"LAB02_SHOPEE_APP_ID"),"App ID ausente"],
        [has(vars,"LAB02_SHOPEE_APP_SECRET"),"App Secret ausente"]
      ]),
      check("Amazon",[
        [yes(vars,"LAB02_AMAZON_CONTA_ACEITA"),"Conta de Associados sem aceite final confirmado"],
        [yes(vars,"LAB02_AMAZON_ANALISE_AUTORIZADA_POR_ESCRITO"),"Permissao por escrito para agregacao/analise nao comprovada"],
        [has(vars,"LAB02_AMAZON_CREATORS_ID"),"Credential ID ausente"],
        [has(vars,"LAB02_AMAZON_CREATORS_SECRET"),"Credential Secret ausente"],
        [has(vars,"LAB02_AMAZON_CREATORS_VERSION"),"Credential Version ausente"],
        [has(vars,"LAB02_AMAZON_PARTNER_TAG"),"Partner Tag nao configurada"]
      ]),
      check("Mercado Livre",[
        [false,"Programa de Afiliados nao oferece API de busca (suporte 494444122)"]
      ])
    ]};
}
export class Bloqueio extends Error {
  constructor(readonly codigo:string){super(codigo);this.name="Bloqueio";}
}
export interface Candidato {
  origem:"shopee_api";itemId:string;shopId:string;titulo:string;
  precoInformadoCentavos:number|null;linkAfiliado:string|null;
  estoqueConfirmado:false;checkoutConfirmado:false;
  descontoConfirmado:false;podePublicar:false;
}
function dinheiro(v:unknown):number|null{
  if(typeof v!=="string"&&typeof v!=="number")return null;
  const s=String(v);
  if(!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(s))return null;
  const p=s.split(".");
  const result=Number(p[0])*100+Number((p[1]??"").padEnd(2,"0"));
  return Number.isSafeInteger(result)&&result>0?result:null;
}
function urlSegura(value:unknown):string|null{
  if(typeof value!=="string"||value.length>2048)return null;
  try{
    const u=new URL(value);
    if(u.protocol!=="https:"||u.username||u.password||u.port)return null;
    if(u.hostname==="shopee.com.br"||u.hostname.endsWith(".shopee.com.br")||
       u.hostname==="shope.ee")return u.toString();
  }catch{}
  return null;
}
export function extrair(data:unknown):Candidato[]{
  if(!data||typeof data!=="object")throw new Bloqueio("RESPOSTA_INVALIDA");
  const json=data as Record<string,unknown>;
  if(Array.isArray(json.errors)&&json.errors.length)
    throw new Bloqueio("GRAPHQL_RETORNOU_ERROS");
  const root=json.data;
  if(!root||typeof root!=="object")throw new Bloqueio("SEM_DADOS");
  const payload=(root as Record<string,unknown>).productOfferV2;
  if(!payload||typeof payload!=="object")throw new Bloqueio("QUERY_INCOMPATIVEL");
  const nodes=(payload as Record<string,unknown>).nodes;
  if(!Array.isArray(nodes)||nodes.length>LIMIT)throw new Bloqueio("LOTE_INVALIDO");
  const seen=new Set<string>(),out:Candidato[]=[];
  for(const node of nodes){
    if(!node||typeof node!=="object")continue;
    const n=node as Record<string,unknown>;
    const item=String(n.itemId??""),shop=String(n.shopId??"");
    if(!/^\d{4,20}$/.test(item)||!/^\d{3,20}$/.test(shop)||
       typeof n.productName!=="string"||
       n.productName.length<3||n.productName.length>180||
       /[\u0000-\u001f\u007f]/.test(n.productName))continue;
    const key=shop+"|"+item;
    if(seen.has(key))continue;
    seen.add(key);
    out.push({origem:"shopee_api",itemId:item,shopId:shop,
      titulo:n.productName.trim(),precoInformadoCentavos:dinheiro(n.priceMin),
      linkAfiliado:urlSegura(n.offerLink),estoqueConfirmado:false,
      checkoutConfirmado:false,descontoConfirmado:false,podePublicar:false});
  }
  return out;
}
export function preparar(vars:Vars,keyword:string,timestamp:number) {
  if(!auditar(vars).fontes[0]!.pronta)throw new Bloqueio("SEM_LIBERACAO_OFICIAL");
  if(!yes(vars,"LAB02_EXECUCAO_UNICA"))throw new Bloqueio("SONDA_NAO_ARMADA");
  if(!/^[\p{L}\p{N}][\p{L}\p{N} -]{2,47}$/u.test(keyword)||
     !Number.isSafeInteger(timestamp)||timestamp<1_700_000_000)
    throw new Bloqueio("ENTRADA_INVALIDA");
  const id=vars.LAB02_SHOPEE_APP_ID!.trim();
  const secret=vars.LAB02_SHOPEE_APP_SECRET!;
  if(!/^\d{5,20}$/.test(id)||secret.length<12)
    throw new Bloqueio("CREDENCIAL_INVALIDA");
  const query="query PrimeiraCacada { productOfferV2(keyword: "+
    JSON.stringify(keyword)+", page: 1, limit: 5) { nodes { itemId shopId productName priceMin offerLink } } }";
  const body=JSON.stringify({query,operationName:"PrimeiraCacada"});
  const signature=createHash("sha256").update(id+timestamp+body+secret).digest("hex");
  return {url:API_URL,body,headers:{
    "accept":"application/json","content-type":"application/json",
    "authorization":"SHA256 Credential="+id+", Timestamp="+timestamp+", Signature="+signature
  }};
}
export async function sondar(
  vars:Vars,keyword:string,transport:typeof fetch=fetch,
  timestamp=Math.floor(Date.now()/1000)
):Promise<{status:"SONDA_LIDA";candidatos:Candidato[];requisicoes:1;envios:0}>{
  const req=preparar(vars,keyword,timestamp);
  const aborter=new AbortController();
  const timer=setTimeout(()=>aborter.abort(),7000);
  let response:Response;
  try{
    response=await transport(req.url,{
      method:"POST",headers:req.headers,body:req.body,
      signal:aborter.signal,redirect:"error",cache:"no-store"
    });
  }catch{throw new Bloqueio("TRANSPORTE_FALHOU");}
  finally{clearTimeout(timer);}
  if(response.status===401||response.status===403)throw new Bloqueio("SEM_PERMISSAO");
  if(response.status===429)throw new Bloqueio("LIMITADO_PELO_PROVEDOR");
  if(!response.ok)throw new Bloqueio("API_INDISPONIVEL");
  const len=Number(response.headers.get("content-length")??"0");
  if(len>150_000)throw new Bloqueio("RESPOSTA_EXCESSIVA");
  // Limite de bytes aplicado DURANTE o streaming; nao apenas depois do download.
  const reader=response.body?.getReader();
  if(!reader)throw new Bloqueio("CORPO_ILEGIVEL");
  const fragments:Uint8Array[]=[];
  let length=0;
  const bodyTimer=setTimeout(()=>aborter.abort(),7000);
  try {
    while(true){
      const next=await reader.read();
      if(next.done)break;
      length+=next.value.byteLength;
      if(length>150_000)throw new Bloqueio("RESPOSTA_EXCESSIVA");
      fragments.push(next.value);
    }
  }catch(e){
    if(e instanceof Bloqueio)throw e;
    throw new Bloqueio("CORPO_ILEGIVEL");
  }finally{
    clearTimeout(bodyTimer);
    await reader.cancel().catch(()=>undefined);
    reader.releaseLock();
  }
  const raw=Buffer.concat(fragments).toString("utf8");
  let parsed:unknown;
  try{parsed=JSON.parse(raw);}catch{throw new Bloqueio("JSON_INVALIDO");}
  const candidatos=extrair(parsed);
  return {status:"SONDA_LIDA",candidatos,requisicoes:1,envios:0};
}
