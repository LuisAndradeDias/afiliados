/** MELI-15C — painel somente leitura.
 * Sem scraping, timers de coleta, WhatsApp ou ações de publicação.
 */
(() => {
 "use strict";
 const byId=id=>document.getElementById(id);
 const fmt=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
 const fmtPercent=new Intl.NumberFormat("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1});
 const demo=new URLSearchParams(location.search).get("demo")==="1";
 const state={filter:"todos",search:"",items:[],selected:null,loaded:false,apiError:false};
 const labels={revisar:"Revisar",revalidar:"Revalidar",bloqueado:"Bloqueado"};
 const now=Date.now();
 const utc=delta=>new Date(now-delta*60_000).toISOString();
 const fixture=[
  {id:"00000000-0000-4000-8000-000000000001",
   titulo:"Parafusadeira 21 V — EXEMPLO FICTÍCIO",
   urlProduto:"https://www.mercadolivre.com.br/p/MLB12345678",
   precoAtual:219.90,precoAnteriorInformado:289.90,
   diferencaInformadaPercentual:24.1,conferidoEm:utc(14),idadeMinutos:14,
   estado:"revisar",notaDePrioridade:68},
  {id:"00000000-0000-4000-8000-000000000002",
   titulo:"SSD portátil 1 TB — EXEMPLO FICTÍCIO",
   urlProduto:"https://www.mercadolivre.com.br/p/MLB23456789",
   precoAtual:299.90,precoAnteriorInformado:369.90,
   diferencaInformadaPercentual:18.9,conferidoEm:utc(90),idadeMinutos:90,
   estado:"revisar",notaDePrioridade:63},
  {id:"00000000-0000-4000-8000-000000000003",
   titulo:"Air fryer 4 litros — EXEMPLO FICTÍCIO",
   urlProduto:"https://www.mercadolivre.com.br/p/MLB34567890",
   precoAtual:179.90,precoAnteriorInformado:239.90,
   diferencaInformadaPercentual:25,conferidoEm:utc(620),idadeMinutos:620,
   estado:"revalidar",notaDePrioridade:32},
  {id:"00000000-0000-4000-8000-000000000004",
   titulo:"Furadeira de impacto — EXEMPLO FICTÍCIO",
   urlProduto:"https://www.mercadolivre.com.br/p/MLB45678901",
   precoAtual:129.90,precoAnteriorInformado:199.90,
   diferencaInformadaPercentual:35,conferidoEm:utc(3400),idadeMinutos:3400,
   estado:"bloqueado",notaDePrioridade:8}
 ].map(x=>({...x,
   motivos:[
     x.estado==="revisar"?
       "Registro fictício recente, mas depende de revisão humana.":
       x.estado==="revalidar"?
       "Preço fictício desatualizado: precisa de nova conferência.":
       "Registro fictício antigo: não usar para divulgação.",
     "Preço anterior informado não prova histórico de mercado.",
     "Vendedor, variante, frete e cupom ainda precisam de confirmação."
   ],
   origem:"conferencia-manual",podePublicar:false,podeEnviar:false,
   serieHistoricaVerificada:false
 }));
 function node(tag,cls,text){
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  if(text!==undefined)el.textContent=String(text);
  return el;
 }
 function set(id,value){byId(id).textContent=String(value)}
 function money(n){return Number.isFinite(n)&&n>0?fmt.format(n):"—"}
 function idade(min){
  if(!Number.isFinite(min))return "—";
  if(min<60)return Math.max(0,Math.floor(min))+" min";
  if(min<1440)return Math.floor(min/60)+" h";
  return Math.floor(min/1440)+" d";
 }
 function validLink(v){
  if(typeof v!=="string")return null;
  try {
   const u=new URL(v);
   if(u.protocol!=="https:"||u.username||u.password||u.port||
     !(u.hostname==="mercadolivre.com.br"||
       u.hostname.endsWith(".mercadolivre.com.br"))||
     !(/^\/p\/MLB\d+(?:\/|$)/i.test(u.pathname)||
       /^\/MLB-\d+(?:-|\/|$)/i.test(u.pathname)))return null;
   u.search="";u.hash="";
   return u.toString();
  }catch{return null}
 }
 function atualizarCabecalho(){
  set("headerState",demo?"Demonstração fictícia":"Busca externa pendente");
  set("heroSourceStatus",demo?"Dados fictícios de teste":"Aguardando autorização");
  set("heroSourceName",demo?"Simulação local, sem consultas":"Mercado Livre · Afiliados");
  set("cacNotice",demo?
   "DEMONSTRAÇÃO: todos os produtos e preços abaixo são FICTÍCIOS. Nenhum anúncio foi pesquisado. Nenhum envio foi feito.":
   "Busca de produtos por API não disponibilizada ao afiliado (protocolo 494444122). Apenas rascunhos locais são analisados.");
  set("cacBannerTag",demo?"SEM DADOS REAIS":"SEM AUTOENVIO");
  set("cacOverviewDetail",demo?
   "Ciclo fictício para validar a classificação visual. Nenhuma coleta externa.":
   "Registro e revisão de dados conferidos pelo operador, sem ofertas inventadas.");
  const mode=byId("demoLink");
  mode.href=demo?"/cacador":"/cacador?demo=1";
  mode.textContent=demo?"Voltar aos registros reais":"Ver demonstração fictícia";
 }
 function pintarMetricas(totais){
  set("metricItems",String(totais.identidades).padStart(2,"0"));
  set("metricReview",String(totais.revisar).padStart(2,"0"));
  set("metricStale",String(totais.revalidar+totais.bloqueados).padStart(2,"0"));
  set("metricRequests","00");
  set("lastCheck",demo?"Quatro produtos fictícios":"Somente leitura local");
 }
 function detalhes(item){
  if(!item){
   set("detailName","Nenhum produto selecionado");
   set("detailSubtitle","Os registros aparecerão depois da conferência manual na Central.");
   set("detailPrice","—");set("detailPrev","—");
   set("detailDrop","—");set("detailHistory","Não comprovado");
   set("detailStatus","Sem seleção");
   byId("detailStatus").className="cac-smallbadge neutral";
   byId("openProduct").hidden=true;
   const l=byId("detailReasons");l.replaceChildren(node("li","","Sem evidências para análise."));
   return;
  }
  set("detailName",item.titulo);
  set("detailSubtitle",(demo?"EXEMPLO FICTÍCIO · ":"Registro manual · ")+
    "última conferência há "+idade(item.idadeMinutos));
  set("detailPrice",money(item.precoAtual));
  set("detailPrev",money(item.precoAnteriorInformado));
  set("detailDrop",Number.isFinite(item.diferencaInformadaPercentual)?
    fmtPercent.format(item.diferencaInformadaPercentual)+"%":"—");
  set("detailHistory","Não comprovado");
  set("detailStatus",labels[item.estado]||"Analisar");
  byId("detailStatus").className="cac-status "+item.estado;
  const ul=byId("detailReasons");ul.replaceChildren();
  const motivos=Array.isArray(item.motivos)?item.motivos:[];
  for(const reason of motivos.slice(0,5)){
   if(typeof reason==="string")ul.append(node("li","",reason));
  }
  const link=validLink(item.urlProduto);
  const anchor=byId("openProduct");
  anchor.hidden=!link||demo;
  if(link&&!demo)anchor.href=link;
  else anchor.removeAttribute("href");
 }
 function pintarTabela(){
  const query=state.search.toLocaleLowerCase("pt-BR");
  const shown=state.items.filter(x=>
   (state.filter==="todos"||x.estado===state.filter)&&
   (x.titulo+" "+x.id).toLocaleLowerCase("pt-BR").includes(query));
  set("itemsCount",shown.length+" de "+state.items.length+" itens");
  const tbody=byId("cacRows");tbody.replaceChildren();
  if(!shown.length){
   const tr=node("tr"),td=node("td","cac-empty",
    state.apiError?
     "Erro ao consultar os rascunhos locais. Nenhuma oferta foi aprovada.":
     state.items.length===0?
     "Nenhum produto conferido no repositório. Abra a Central para cadastrar um anúncio específico.":
     "Nenhum produto corresponde ao filtro.");
   td.colSpan=5;tr.append(td);tbody.append(tr);
  }
  for(const item of shown){
   const tr=node("tr");
   tr.dataset.selected=String(item.id===state.selected);
   const one=node("td"),btn=node("button","cac-item-btn",item.titulo);
   btn.type="button";
   btn.setAttribute("aria-pressed",String(item.id===state.selected));
   btn.setAttribute("aria-label","Analisar "+item.titulo);
   btn.append(node("small","",demo?"Demonstração fictícia":"Origem: conferência manual"));
   btn.addEventListener("click",()=>{
    state.selected=item.id;pintarTabela();detalhes(item);
    if(matchMedia("(max-width: 620px)").matches){
     byId("detailName").scrollIntoView({block:"nearest"});
    }
   });
   one.append(btn);
   const price=node("td","cac-price",money(item.precoAtual));
   const time=node("td","",idade(item.idadeMinutos));
   const score=node("td","cac-score",String(item.notaDePrioridade??0)+"/100");
   const stateTd=node("td");
   stateTd.append(node("span","cac-status "+item.estado,labels[item.estado]||"Verificar"));
   tr.append(one,price,time,score,stateTd);
   tbody.append(tr);
  }
  const selection=shown.find(x=>x.id===state.selected)??shown[0]??null;
  state.selected=selection?.id??null;
  detalhes(selection);
  for(const btn of byId("cacFilters").querySelectorAll("button")){
   btn.setAttribute("aria-pressed",String(btn.dataset.filter===state.filter));
  }
  set("cacFooter",demo?
   "Exibição fictícia — nenhuma publicação ou envio.":
   "Classificação somente de rascunhos manuais; nenhum envio automático.");
 }
 function aplicar(data){
  if(!data||data.modo!=="ASSISTIDO"||
     data.fonteExterna?.buscaAutomaticaAtiva!==false||
     !Array.isArray(data.candidatos)||data.candidatos.length>100||
     data.guardrails?.enviosRealizados!==0)throw Error("Contrato local inválido");
  state.items=data.candidatos.filter(x=>
   x&&typeof x==="object"&&x.podePublicar===false&&x.podeEnviar===false&&
   ["revisar","revalidar","bloqueado"].includes(x.estado));
  state.selected=state.items.find(x=>x.id===state.selected)?.id??state.items[0]?.id??null;
  pintarMetricas(data.totais);pintarTabela();
 }
 async function carregar(){
  if(demo){
   state.items=fixture;
   pintarMetricas({identidades:4,revisar:2,revalidar:1,bloqueados:1});
   state.selected=fixture[0].id;
   pintarTabela();return;
  }
  try{
   const response=await fetch("/api/mercadolivre/cacador",{
    method:"GET",credentials:"same-origin",cache:"no-store",
    headers:{accept:"application/json"}
   });
   if(!response.ok)throw Error("Serviço local indisponível");
   const data=await response.json();
   if(data.ok!==true)throw Error("Contrato inválido");
   state.apiError=false;aplicar(data);
  }catch{
   state.apiError=true;state.items=[];
   pintarMetricas({identidades:0,revisar:0,revalidar:0,bloqueados:0});
   pintarTabela();
   set("cacNotice","Não foi possível ler os rascunhos locais. Nenhuma consulta externa foi feita.");
  }
 }
 byId("cacSearch").addEventListener("input",event=>{
  state.search=event.currentTarget.value??"";
  pintarTabela();
 });
 for(const button of byId("cacFilters").querySelectorAll("button")){
  button.addEventListener("click",()=>{
   state.filter=button.dataset.filter||"todos";
   state.selected=null;pintarTabela();
  });
 }
 atualizarCabecalho();
 void carregar();
 if(!demo)window.setInterval(()=>{void carregar()},90_000);
})();
