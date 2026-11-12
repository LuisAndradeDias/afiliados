import type {Canal,Ciclo,Observacao,Origem} from "./motor.js";

/** Amostras completamente FICTÍCIAS. Produtos e preços não foram pesquisados. */
interface Exemplo{
 canal:Canal;id:string;titulo:string;vendedor:string;variante:string;
 precos:number[];frete:number|null;estoque:Observacao["estoque"];
}
const exemplos:Exemplo[]=[
 {canal:"Amazon",id:"AMZ_DEMO_SSD1TB",titulo:"SSD portátil 1 TB · exemplo",
  vendedor:"SellerAmazon1",variante:"1TB",precos:[34990,34790,34990,27990],
  frete:0,estoque:"confirmado-fixture"},
 {canal:"Shopee",id:"SHP_DEMO_AFRY4L",titulo:"Air fryer 4 litros · exemplo",
  vendedor:"SellerShopee1",variante:"4L",precos:[22990,22990,21990,16990],
  frete:1000,estoque:"confirmado-fixture"},
 {canal:"Mercado Livre",id:"MLB_DEMO_TOOL01",titulo:"Parafusadeira 21 V · seleção assistida",
  vendedor:"SellerMeli1",variante:"21V",precos:[28990,28990,28990,22990],
  frete:0,estoque:"nao-confirmado"},
 {canal:"Amazon",id:"AMZ_DEMO_SPEAKER",titulo:"Caixa de som portátil · exemplo",
  vendedor:"SellerAmazon1",variante:"BT5",precos:[9990,9990,9990,9990],
  frete:0,estoque:"confirmado-fixture"},
 {canal:"Shopee",id:"SHP_DEMO_CHARGER",titulo:"Carregador USB-C · variantes distintas",
  vendedor:"SellerShopee2",variante:"65W",precos:[3990,3990,3990,2590],
  frete:0,estoque:"confirmado-fixture"},
 {canal:"Amazon",id:"AMZ_DEMO_MONITOR",titulo:"Monitor gamer 24 pol. · desconto atípico",
  vendedor:"SellerAmazon2",variante:"24POL",precos:[89990,89990,89990,39990],
  frete:0,estoque:"confirmado-fixture"},
 {canal:"Shopee",id:"SHP_DEMO_SHOE",titulo:"Tênis esportivo · frete pendente",
  vendedor:"SellerShopee3",variante:"42BR",precos:[11990,11990,11990,6990],
  frete:0,estoque:"confirmado-fixture"},
 {canal:"Amazon",id:"AMZ_DEMO_MOUSE",titulo:"Mouse sem fio · observação antiga",
  vendedor:"SellerAmazon1",variante:"BT",precos:[15990,15990,15990,10990],
  frete:0,estoque:"confirmado-fixture"},
 {canal:"Shopee",id:"SHP_DEMO_PHONE",titulo:"Smartphone de entrada · cupom simulado",
  vendedor:"SellerShopee4",variante:"128GB",precos:[149900,149900,149900,129900],
  frete:0,estoque:"confirmado-fixture"},
 {canal:"Shopee",id:"SHP_DEMO_PAN",titulo:"Panela elétrica · sem estoque confirmado",
  vendedor:"SellerShopee4",variante:"3L",precos:[8990,8990,8990,7900],
  frete:0,estoque:"confirmado-fixture"}
];
const datas=["2026-11-02T12:00:00Z","2026-11-06T12:00:00Z",
 "2026-11-09T12:00:00Z","2026-11-12T12:00:00Z"];
function origem(canal:Canal):Origem {
 return canal==="Amazon"?"fixture-amazon-creators":
  canal==="Shopee"?"fixture-shopee-afiliados":"fixture-meli-curadoria";
}
function fazer(ex:Exemplo,indice:number):Observacao{
 const novo=indice===3,bruto=ex.precos[indice]!;
 const observa=ex.id==="AMZ_DEMO_MOUSE"&&novo?
  "2026-11-10T10:00:00Z":datas[indice]!;
 const vari=ex.id==="SHP_DEMO_CHARGER"&&novo?"45W":ex.variante;
 const frete=ex.id==="SHP_DEMO_SHOE"&&novo?null:ex.frete;
 const estoque=ex.id==="SHP_DEMO_PAN"&&novo?
  "nao-confirmado" as const:ex.estoque;
 const cupom=novo&&ex.id==="SHP_DEMO_PHONE"?
   {codigo:"LAB3000",descontoCentavos:3000,minimoCentavos:100000,
    expiraEmUtc:"2026-11-14T23:59:59Z",status:"regras-fixture" as const}:
   novo&&ex.id==="SHP_DEMO_AFRY4L"?
   {codigo:"PROMO15LAB",descontoCentavos:1500,minimoCentavos:14000,
    expiraEmUtc:"2026-11-15T23:59:59Z",status:"nao-verificado" as const}:
   undefined;
 return {
  canal:ex.canal,origem:origem(ex.canal),id:ex.id,
  titulo:ex.titulo,vendedor:ex.vendedor,variante:vari,
  pagamento:ex.canal==="Mercado Livre"?"cartao":"geral",
  moeda:"BRL",precoCentavos:bruto,
  freteCentavos:frete,estoque,observadoEmUtc:observa,
  ...(cupom?{cupom}:{})
 };
}
export function ciclosDeLaboratorio():Ciclo[]{
 return datas.map((instanteUtc,index)=>{
  const obs=exemplos.map(x=>fazer(x,index));
  if(index===3){
   // Produto novo no último ciclo, sem histórico suficiente:
   obs.push({canal:"Amazon",origem:"fixture-amazon-creators",
    id:"AMZ_DEMO_KEYBOARD",titulo:"Teclado mecânico · novo produto",
    vendedor:"SellerAmazon3",variante:"ABNT2",pagamento:"geral",moeda:"BRL",
    precoCentavos:19990,freteCentavos:0,estoque:"confirmado-fixture",
    observadoEmUtc:instanteUtc});
   // Duplicação idêntica, conflito no mesmo instante e linha inválida.
   obs.push(structuredClone(obs[0]!));
   obs.push({...obs[0]!,precoCentavos:19000});
   obs.push({...obs[1]!,id:"SHP_INVALIDO",precoCentavos:0});
  }
  return {
   nome:["Primeiro rastreio","Revisão de preços","Histórico amadurecendo","Novas oportunidades"][index]!,
   instanteUtc,observacoes:obs
  };
 });
}
