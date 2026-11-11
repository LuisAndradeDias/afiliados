/* MELI-11 | Somente GET do historico autorizado; demo opt-in. Sem escrita, tokens ou envio. */
(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const demoMode = new URLSearchParams(location.search).get("demo") === "1";
  const referenceDate = demoMode ? Date.parse("2026-11-11T00:00:00.000Z") :
    Date.parse(new Date().toISOString().slice(0,10)+"T00:00:00.000Z");
  const dayMs = 86400000;
  const dayIso = offset => new Date(referenceDate + offset * dayMs).toISOString().slice(0, 10);
  const dateLabel = offset => new Date(referenceDate + offset * dayMs)
    .toLocaleDateString("pt-BR", { day:"2-digit", month:"short",timeZone:"UTC" }).replace(".", "");
  const money = value => value == null ? "—" : "R$ " +
    value.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
  const samples = (days, prices, unknownDays = []) => days.map((day, index) => ({
    day, price:prices[index], confirmed:!unknownDays.includes(day)
  }));
  // Os itens DEMO-ML nao representam anuncios do Mercado Livre.
  const fixtures = [
    { id:"DEMO-ML-001", label:"Produto fictício A", letter:"A", cls:"",
      pix:samples([-85,-72,-59,-46,-35,-28,-23,-18,-13,-9,-6,-3,0],
        [385,378,362,349,346,329.9,319.9,314.9,309.9,299.9,305.9,294.9,289.9],[-9]),
      cartao:samples([-85,-72,-59,-46,-35,-28,-23,-18,-13,-9,-6,-3,0],
        [398,395,381,372,360,347.9,338.9,331.9,326.9,322.9,324.9,319.9,314.9])
    },
    { id:"DEMO-ML-002", label:"Produto fictício B", letter:"B", cls:"b",
      pix:samples([-74,-51,-31,-26,-20,-14,-8,-2,0],
        [189,181,175,170,166,159,155,151,119],[0]),
      cartao:samples([-74,-51,-31,-26,-20,-14,-8,-2,0],
        [199,195,192,188,183,179,173,171,169],[0])
    },
    { id:"DEMO-ML-003", label:"Produto fictício C", letter:"C", cls:"c",
      pix:samples([-21,-1,0],[459,442,429],[-21]),
      cartao:samples([-21,-1,0],[468,459,452],[-21])
    },
    { id:"DEMO-ML-004", label:"Produto fictício D", letter:"D", cls:"d",
      pix:samples([-74,-48,-31,-27,-22,-19,-15,-12,-8,-5,-2,0],
        [249,246,239,238,232,229,225,221,219,216,210,204]),
      cartao:samples([-74,-48,-31,-27,-22,-19,-15,-12,-8,-5,-2,0],
        [262,259,254,251,246,244,241,239,235,233,229,224])
    }
  ];
  let products = demoMode ? fixtures : [];
  const state = { selected:products[0]?.id ?? "", payment:"pix", period:30 };

  function analyze(product, payment=state.payment, period=state.period) {
    const all = product[payment].filter(s => s.day <= 0).sort((a,b)=>a.day-b.day);
    const inWindow = all.filter(s=>s.day >= -period);
    const confirmedInWindow = inWindow.filter(s=>s.confirmed);
    const reference = all.filter(s=>s.day >= -30 && s.confirmed);
    const last = all[all.length-1] ?? null;
    const distinctDays = new Set(reference.map(s=>dayIso(s.day))).size;
    const sorted = reference.map(s=>s.price).sort((a,b)=>a-b);
    const half = Math.floor(sorted.length / 2);
    const median = !sorted.length ? null : sorted.length % 2 === 1
      ? sorted[half] : (sorted[half-1]+sorted[half])/2;
    const ready = distinctDays >= 3 && !!last?.confirmed && last.day >= -1;
    return { all, inWindow, confirmedInWindow, reference, last,
      distinctDays, median, minimum:sorted.length?sorted[0]:null, ready };
  }
  function labelFor(a) {
    if(a.ready) return ["Base suficiente","good"];
    if(a.last && !a.last.confirmed) return ["Revisar disponibilidade","warning"];
    return ["Dados insuficientes","neutral"];
  }
  function node(tag, className, text) {
    const el = document.createElement(tag);
    if(className) el.className=className;
    if(text!==undefined) el.textContent=text;
    return el;
  }
  function setText(id,text) { byId(id).textContent=text; }
  function statusPill(a) {
    const [label,kind] = labelFor(a);
    const el = node("span","state-pill "+kind,label);
    return el;
  }
  function makeCell(label, text, className) {
    const td = node("td",className||"");
    td.dataset.label=label;
    if(text!==undefined) td.textContent=text;
    return td;
  }
  function updateTable() {
    const query = byId("historySearch").value.trim().toLocaleLowerCase("pt-BR");
    const visible = products.filter(p=>(p.id+" "+p.label).toLocaleLowerCase("pt-BR").includes(query));
    setText("tableCount",visible.length+(demoMode?" itens demonstrativos":" itens autorizados"));
    const rows = byId("productRows");
    rows.replaceChildren();
    if(!visible.length) {
      const row=node("tr");
      const cell=makeCell("",demoMode?"Nenhum item demonstrativo encontrado.":
        products.length?"Nenhum item corresponde à pesquisa.":"Nenhuma cotação real disponível. Fonte autorizada ainda pendente.","table-empty");
      cell.colSpan=5;row.append(cell);rows.append(row);return;
    }
    for (const p of visible) {
      const a=analyze(p);
      const row=node("tr");
      row.dataset.selected=String(state.selected===p.id);
      const first=makeCell("Item");
      const select=node("button","product-select");
      select.type="button";
      select.setAttribute("aria-label","Selecionar "+p.label);
      select.setAttribute("aria-pressed",String(state.selected===p.id));
      select.addEventListener("click",()=>{
        state.selected=p.id;
        render();
        if(window.matchMedia("(max-width: 600px)").matches)
          document.querySelector(".analysis-grid").scrollIntoView({block:"nearest"});
      });
      select.append(node("span","product-avatar "+p.cls,p.letter));
      const details=node("span","product-name");
      details.append(node("strong","",p.label),node("small","",p.id+" · Mercado Livre (simulação)"));
      select.append(details);first.append(select);
      const latest=makeCell("Último preço",a.last?.confirmed?money(a.last.price):"—","mono-value");
      const lowest=makeCell("Menor confirmado",money(a.minimum),"mono-value");
      const days=makeCell("Dias / 30d",a.distinctDays+" dias","");
      const result=makeCell("Estado da comparação");
      result.append(statusPill(a));
      row.append(first,latest,lowest,days,result);
      rows.append(row);
    }
  }
  const ns="http://www.w3.org/2000/svg";
  function svgEl(tag, attrs, text) {
    const el = document.createElementNS(ns,tag);
    for(const [key,value] of Object.entries(attrs)) el.setAttribute(key,String(value));
    if(text!==undefined) el.textContent=text;
    return el;
  }
  function plot(a) {
    const svg=byId("priceChart");
    const tip=byId("chartTooltip");
    tip.hidden=true;
    svg.replaceChildren();
    const points=a.confirmedInWindow;
    if(!points.length) {
      svg.append(svgEl("text",{x:325,y:114,"text-anchor":"middle",fill:"#667085","font-size":14,"font-weight":700},
        "Sem amostras confirmadas no período"));
      svg.append(svgEl("text",{x:325,y:140,"text-anchor":"middle",fill:"#98a2b3","font-size":11},
        "Nenhum preço pode ser inferido"));
      setText("chartTextSummary","Não há observações confirmadas na janela selecionada.");
      return;
    }
    const values=points.map(p=>p.price);
    if(a.median!==null) values.push(a.median);
    let min=Math.floor((Math.min(...values)-15)/10)*10;
    let max=Math.ceil((Math.max(...values)+15)/10)*10;
    if(max-min<20)max=min+20;
    const left=55,right=633,top=16,bottom=190;
    const x=day=>left+((day+state.period)/state.period)*(right-left);
    const y=price=>bottom-((price-min)/(max-min))*(bottom-top);
    const defs=svgEl("defs",{}),gradient=svgEl("linearGradient",{id:"historyAreaGradient",x1:"0",y1:"0",x2:"0",y2:"1"});
    gradient.append(svgEl("stop",{offset:"0%","stop-color":"#2563eb","stop-opacity":".20"}),
      svgEl("stop",{offset:"100%","stop-color":"#2563eb","stop-opacity":"0"}));
    defs.append(gradient);svg.append(defs);
    for(let i=0;i<4;i++) {
      const value=min+(max-min)*(3-i)/3, gy=y(value);
      svg.append(svgEl("line",{x1:left,y1:gy,x2:right,y2:gy,stroke:"#e9edf3","stroke-dasharray":"3 5"}));
      svg.append(svgEl("text",{x:left-9,y:gy+4,"text-anchor":"end",fill:"#98a2b3","font-size":10},String(Math.round(value))));
      const tick=-state.period+(i*state.period/3);
      svg.append(svgEl("text",{x:x(tick),y:223,"text-anchor":"middle",fill:"#98a2b3","font-size":10},dateLabel(tick)));
    }
    if(a.median!==null) svg.append(svgEl("line",{x1:left,y1:y(a.median),x2:right,y2:y(a.median),
      stroke:"#e5ad47","stroke-width":1.5,"stroke-dasharray":"5 4"}));
    const coords=points.map((p,i)=>(i?"L":"M")+x(p.day).toFixed(1)+" "+y(p.price).toFixed(1)).join(" ");
    const area=coords+" L"+x(points[points.length-1].day).toFixed(1)+" "+bottom+" L"+
      x(points[0].day).toFixed(1)+" "+bottom+" Z";
    svg.append(svgEl("path",{d:area,fill:"url(#historyAreaGradient)"}));
    svg.append(svgEl("path",{d:coords,fill:"none",stroke:"#2563eb","stroke-width":3,"stroke-linejoin":"round","stroke-linecap":"round"}));
    for(const p of points) {
      const circle=svgEl("circle",{cx:x(p.day),cy:y(p.price),r:4.5,fill:"#fff",
        stroke:"#2563eb","stroke-width":2.2,tabindex:0,role:"img",
        "aria-label":dateLabel(p.day)+": "+money(p.price)+" (amostra fictícia)"});
      const hide=()=>{tip.hidden=true};
      const show=()=>{
        tip.textContent=money(p.price)+" · "+dateLabel(p.day)+" (ficção)";
        tip.hidden=false;
        const box=byId("chartBox").getBoundingClientRect();
        tip.style.left=Math.max(4,Math.min(box.width-150,(x(p.day)/650)*box.width-50))+"px";
        tip.style.top=Math.max(0,(y(p.price)/240)*box.height-36)+"px";
      };
      circle.addEventListener("mouseenter",show);
      circle.addEventListener("mouseleave",hide);
      circle.addEventListener("focus",show);
      circle.addEventListener("blur",hide);
      svg.append(circle);
    }
    setText("chartTextSummary",points.length+" amostra(s) fictícia(s) confirmada(s) no período de "+
      state.period+" dias. Fonte real não conectada.");
  }

  function renderEmpty() {
    setText("selectedProduct","Nenhuma cotação real disponível");
    setText("selectedDescription","O histórico será alimentado apenas quando a fonte for autorizada");
    setText("currentPrice","—");
    byId("currentPrice").classList.add("missing");
    setText("priceDescription","Sem observações verificadas");
    byId("chartState").className="state-pill neutral";
    setText("chartState","Aguardando fonte");
    setText("lowest","—");setText("median","—");setText("points","0 na janela");
    setText("checkDays","0 dias (mín. 3)");
    setText("checkStock","Não verificada");
    setText("checkFresh","Sem coleta");
    for(const id of ["checkDays","checkStock","checkFresh"])byId(id).className="warning";
    byId("confidenceDonut").dataset.score="0";
    setText("confidenceNumber","0/3");
    setText("confidenceTitle","Sem observações autorizadas");
    setText("confidenceText","A coleta real não foi habilitada. Nenhuma promoção será inferida.");
    setText("metricTotal","00");setText("metricReady","00");setText("metricReview","00");
    plot({confirmedInWindow:[],median:null});
    updateTable();
  }
  function render() {
    const p=products.find(v=>v.id===state.selected)??products[0];
    if(!p){renderEmpty();return;}
    const a=analyze(p);
    const [label,kind]=labelFor(a);
    setText("selectedProduct",p.label);
    setText("selectedDescription",p.id+" · Mercado Livre · "+(state.payment==="pix"?"Pix":"Cartão")+" (simulação)");
    const status=byId("chartState");
    status.className="state-pill "+kind;status.textContent=label;
    setText("currentPrice",a.last?.confirmed?money(a.last.price):"—");
    byId("currentPrice").classList.toggle("missing",!a.last?.confirmed);
    setText("priceDescription",a.last?.confirmed?
      "Última observação confirmada (fictícia)":"Última observação sem confirmação de disponibilidade");
    setText("lowest",money(a.minimum));
    setText("median",money(a.median));
    setText("points",a.confirmedInWindow.length+" na janela");
    setText("checkDays",a.distinctDays+" dias (mín. 3)");
    setText("checkStock",a.last?.confirmed?"Confirmada (teste)":"Não confirmada");
    setText("checkFresh",a.last?.day>=-1?"Dentro de 24h (teste)":"Desatualizada");
    const score=(a.distinctDays>=3?1:0)+(a.last?.confirmed?1:0)+(a.last?.day>=-1?1:0);
    const donut=byId("confidenceDonut");donut.dataset.score=String(score);
    setText("confidenceNumber",score+"/3");
    setText("confidenceTitle",a.ready?"Critérios atendidos":"Comparação condicionada");
    setText("confidenceText",a.ready?
      "Amostras fictícias suficientes para análise histórica. Não significa oferta aprovada.":
      "Amostras insuficientes, antigas ou sem disponibilidade confirmada. Não recomendar desconto.");
    for(const [id,good] of [["checkDays",a.distinctDays>=3],
      ["checkStock",!!a.last?.confirmed],["checkFresh",a.last?.day>=-1]]) {
      byId(id).className=good?"good":"warning";
    }
    const ready=products.filter(prod=>analyze(prod).ready).length;
    setText("metricTotal",String(products.length).padStart(2,"0"));
    setText("metricReady",String(ready).padStart(2,"0"));
    setText("metricReview",String(products.length-ready).padStart(2,"0"));
    plot(a);updateTable();
  }
  for(const btn of byId("paymentToggle").querySelectorAll("button")) {
    btn.addEventListener("click",()=>{
      state.payment=btn.dataset.pay;
      for(const b of byId("paymentToggle").querySelectorAll("button")) {
        const selected=b===btn;b.classList.toggle("selected",selected);b.setAttribute("aria-pressed",String(selected));
      }
      render();
    });
  }
  for(const btn of byId("periodToggle").querySelectorAll("button")) {
    btn.addEventListener("click",()=>{
      state.period=Number(btn.dataset.period);
      for(const b of byId("periodToggle").querySelectorAll("button")) {
        const selected=b===btn;b.classList.toggle("selected",selected);b.setAttribute("aria-pressed",String(selected));
      }
      render();
    });
  }
  byId("historySearch").addEventListener("input",updateTable);
  const sidebar=byId("sidebar"),scrim=byId("scrim"),menu=byId("menuBtn");
  function mobileMenu(open) {
    sidebar.classList.toggle("open",open);scrim.classList.toggle("open",open);scrim.hidden=!open;
    menu.setAttribute("aria-expanded",String(open));
  }
  menu.addEventListener("click",()=>mobileMenu(!sidebar.classList.contains("open")));
  scrim.addEventListener("click",()=>mobileMenu(false));
  document.addEventListener("keydown",event=>{if(event.key==="Escape")mobileMenu(false)});
  // A demonstração existe somente por escolha explícita (?demo=1).
  if(demoMode){
    setText("historyMode","● DEMONSTRAÇÃO");
    setText("sourceChipSuffix","(demo)");
    setText("sourceNotice","DEMONSTRAÇÃO: preços e produtos fictícios, sem vínculo com anúncios reais.");
    setText("sourceStatusTitle","Dados fictícios");
    setText("sourceStatusDetail","Nenhum preço deste modo é utilizado comercialmente.");
    setText("historySourceLabel","Produtos e preços simulados");
    setText("overviewDescription","Acompanhamento demonstrativo, sem coleta real");
    setText("footerSourceStatus","Valores fictícios · nenhuma publicação");
    setText("itemsHint","Selecione um produto fictício para testar o gráfico");
    byId("modeLink").textContent="Voltar ao histórico real";
    byId("modeLink").href="/historico-precos";
  }
  function fromAuthorized(item) {
    if(!item||typeof item.itemId!=="string"||!/^MLB\d{6,20}$/.test(item.itemId)||
       typeof item.titulo!=="string"||typeof item.id!=="string")return null;
    const parseSerie = (serie) => {
      if(!Array.isArray(serie))return [];
      return serie.flatMap(s=>{
        if(!s||typeof s.observadoEm!=="string"||!Number.isSafeInteger(s.centavos)||
           s.centavos<=0||!["confirmada","indeterminada","indisponivel"].includes(s.disponibilidade))
          return [];
        const diaUtc=s.observadoEm.slice(0,10);
        const ms=Date.parse(diaUtc+"T00:00:00.000Z");
        if(!Number.isFinite(ms)||ms>referenceDate)return [];
        return [{day:Math.round((ms-referenceDate)/dayMs),price:s.centavos/100,
          confirmed:s.disponibilidade==="confirmada"}];
      }).sort((a,b)=>a.day-b.day);
    };
    return {id:item.id,label:item.titulo,letter:"M",cls:"",
      pix:parseSerie(item.pix),cartao:parseSerie(item.cartao)};
  }
  async function carregarHistoricoAutorizado() {
    try {
      const resposta=await fetch("/api/historico-precos",{
        method:"GET",credentials:"same-origin",cache:"no-store",
        headers:{"accept":"application/json"}
      });
      if(!resposta.ok)throw new Error("HTTP local indisponível");
      const data=await resposta.json();
      if(!data||data.ok!==true||data.modo!=="real"||!Array.isArray(data.itens))
        throw new Error("Contrato inválido");
      // Sem licença válida os itens não podem ser exibidos, mesmo se houver DB antigo.
      products=data.autorizacaoConfirmada===true
        ?data.itens.slice(0,80).map(fromAuthorized).filter(Boolean):[];
      if(!products.some(p=>p.id===state.selected))state.selected=products[0]?.id??"";
      const active=data.coletaHabilitada===true && data.autorizacaoConfirmada===true;
      setText("sourceStatusTitle",active?"Fonte autorizada":"Aguardando autorização");
      setText("sourceStatusDetail",typeof data.mensagem==="string"
        ?data.mensagem.slice(0,180):"Nenhuma fonte autorizada conectada.");
      setText("historySourceLabel",active?"Fonte autorizada · somente leitura":"Fonte oficial: pendente");
      setText("sourceChipSuffix",active?"(autorizada)":"(fonte pendente)");
      setText("sourceNotice",active?
        "HISTÓRICO REAL: valores observados de fonte autorizada. Não é autorização para publicar ofertas.":
        "SEM DADOS REAIS: ainda não existe fonte aprovada para o Programa de Afiliados.");
      setText("footerSourceStatus",active?"Observações de fonte autorizada":"Aguardando permissão oficial de coleta");
      render();
    }catch{
      products=[];state.selected="";
      setText("sourceStatusTitle","Histórico indisponível");
      setText("sourceStatusDetail","Não foi possível consultar a leitura local. Nenhuma informação estimada será exibida.");
      setText("sourceNotice","ERRO DE LEITURA: sem preços confirmados. Não há ofertas autorizadas.");
      setText("historySourceLabel","Sem comunicação com a fonte");
      render();
    }
  }
  render();
  if(!demoMode){
    void carregarHistoricoAutorizado();
    window.setInterval(()=>{void carregarHistoricoAutorizado();},60_000);
  }
})();