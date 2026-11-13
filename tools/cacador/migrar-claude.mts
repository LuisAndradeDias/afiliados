/**
 * Migração seletiva do catálogo/observações do protótipo Claude, SEM dados pessoais.
 * USO: npx tsx tools/cacador/migrar-claude.mts --origem "I:\...\ofertas.db"
 * Prévia é SOMENTE LEITURA. Para aplicar em banco NOVO isolado:
 *   ... --destino "C:\...\catalogo.sqlite" --aplicar
 * Nunca lê ou copia envios, cliques, visitantes, contatos, sessões ou cookies.
 */
import {existsSync,statSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {CatalogoCacador,validarEntradaCacador,type EntradaCacador}
  from "../../src/cacador/catalogo.js";

type LinhaLegada={
  id:string;titulo:string|null;link:string|null;imagem:string|null;
  preco:number|null;preco_antigo:number|null;link_afiliado:string|null;
  nota:number|null;avaliacoes:number|null;vendidos:number|null;
  frete_gratis:number|null;full:number|null;mais_vendido:number|null;
  cupom:string|null;comissao_pct:number|null;ultima_vez:string|null;
};
type ObservacaoLegada={
  quando:string|null;preco:number|null;preco_antigo:number|null;
};
function argumento(nome:string):string|null{
  const p=process.argv.indexOf(nome);return p>=0?process.argv[p+1]??null:null;
}
const origem=argumento("--origem");
const destino=argumento("--destino");
const aplicar=process.argv.includes("--aplicar");
const maxArg=argumento("--max");
const max=maxArg?Number(maxArg):1000;
if(!origem||!existsSync(origem)||statSync(origem).size>100*1024*1024){
  console.error("Informe --origem de um arquivo SQLite existente de até 100 MB.");
  process.exit(2);
}
if(!Number.isSafeInteger(max)||max<1||max>1000){
  console.error("--max deve ser um número entre 1 e 1000.");process.exit(2);
}
if(aplicar){
  if(!destino)throw Error("--destino é obrigatório com --aplicar.");
  const src=resolve(origem).toLowerCase(),out=resolve(destino).toLowerCase();
  if(src===out||out.startsWith(dirname(src)+"\\")||out.startsWith(dirname(src)+"/")){
    throw Error("Destino deve ficar FORA da pasta de origem do Claude.");
  }
}
const db=new DatabaseSync(resolve(origem),{readOnly:true});
const stats={
  modo:aplicar?"importacao-isolada":"previa-somente-leitura",
  produtosLidos:0,observacoesLidas:0,
  produtosCompativeis:0,observacoesCompativeis:0,
  produtosIgnorados:0,observacoesIgnoradas:0,
  produtosImportados:0,observacoesImportadas:0,
  privacidade:"sem-cliques-envios-eventos-sessoes-contatos",
  publicacoes:0
};
const valorCentavos=(x:unknown):number|null=>{
  if(typeof x!=="number"||!Number.isFinite(x)||x<=0||x>1_000_000)return null;
  const n=Math.round(x*100);
  return Number.isSafeInteger(n)&&n>0?n:null;
};
const opc=(x:unknown):number|null=>{
  if(typeof x!=="number"||!Number.isFinite(x)||x<0)return null;
  return Math.round(x*100);
};
function instante(d:string|null):string|null{
  if(typeof d!=="string")return null;
  const valor=d.trim();
  // Python salvou horário local do Windows SEM timezone. São Paulo = UTC-03.
  const iso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(valor)?
    valor+"-03:00":valor;
  const ms=Date.parse(iso);
  return Number.isFinite(ms)&&ms<=Date.now()+60_000?
    new Date(ms).toISOString():null;
}
function montar(p:LinhaLegada,obs:ObservacaoLegada):EntradaCacador{
  const titulo=String(p.titulo??"").trim().slice(0,160);
  const cupom=String(p.cupom??"").trim().toUpperCase();
  return {
    canal:"Mercado Livre",produtoId:p.id,titulo,
    vendedor:"naoInformado",variante:"naoInformada",pagamento:"geral",
    precoCentavos:valorCentavos(obs.preco)??0,freteCentavos:null,
    precoAnteriorCentavos:opc(obs.preco_antigo)??opc(p.preco_antigo),
    urlProduto:String(p.link??""),urlAfiliado:String(p.link_afiliado??"")||null,
    imagemUrl:String(p.imagem??"")||null,
    nota:p.nota,avaliacoes:p.avaliacoes,vendidos:p.vendidos,
    freteGratis:p.frete_gratis===1,full:p.full===1,
    maisVendido:p.mais_vendido===1,
    cupomCodigo:/^[A-Z0-9_-]{3,32}$/.test(cupom)?cupom:null,
    comissaoEstimadaPercentual:p.comissao_pct,
    disponibilidade:"nao-confirmada",confirmadoManualmente:true
  };
}
let repositorio:CatalogoCacador|null=null;
try{
  const tabelas=new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{name:string}>).map(x=>x.name)
  );
  if(!tabelas.has("ofertas")||!tabelas.has("observacoes"))
    throw Error("Banco não possui catálogo/observações do protótipo esperado.");
  if(aplicar)repositorio=new CatalogoCacador(resolve(destino!));
  const produtos=db.prepare([
    "SELECT id,titulo,link,imagem,preco,preco_antigo,link_afiliado,",
    "nota,avaliacoes,vendidos,frete_gratis,full,mais_vendido,cupom,",
    "comissao_pct,ultima_vez FROM ofertas ORDER BY ultima_vez DESC LIMIT ?"
  ].join(" ")).all(max) as unknown as LinhaLegada[];
  const getObs=db.prepare(
    "SELECT quando,preco,preco_antigo FROM observacoes WHERE produto_id=? ORDER BY quando ASC LIMIT 240"
  );
  for(const p of produtos){
    stats.produtosLidos++;
    const obs=getObs.all(p.id) as unknown as ObservacaoLegada[];
    // O preço atual do catálogo entra como observação complementar somente
    // quando não existe uma última observação igual no SQLite legado.
    if(!obs.length&&p.preco&&p.ultima_vez)
      obs.push({quando:p.ultima_vez,preco:p.preco,preco_antigo:p.preco_antigo});
    stats.observacoesLidas+=obs.length;
    let registrado=false;
    for(const o of obs){
      const ts=instante(o.quando);
      if(!ts){stats.observacoesIgnoradas++;continue;}
      try{
        const e=validarEntradaCacador(montar(p,o));
        stats.observacoesCompativeis++;
        if(aplicar){
          repositorio!.registrar(e,{instanteUtc:ts,origem:"snapshot-claude"});
          stats.observacoesImportadas++;
        }
        registrado=true;
      }catch{stats.observacoesIgnoradas++;}
    }
    if(registrado){
      stats.produtosCompativeis++;
      if(aplicar)stats.produtosImportados++;
    }else stats.produtosIgnorados++;
  }
}finally{
  repositorio?.fechar();db.close();
}
console.log(JSON.stringify(stats,null,2));
