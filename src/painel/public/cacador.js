/* Caçador integrado: UI assistida, sem publicação ou busca automática. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const brl=n=>n===null||n===undefined?"—":
    (Number(n)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  const num=n=>Number(n??0).toLocaleString("pt-BR");
  const el=(tag,cls="",text=null)=>{
    const d=document.createElement(tag);
    if(cls)d.className=cls;
    if(text!==null)d.textContent=String(text);
    return d;
  };
  let selected=null,serial=0;
  const estados={revisar:"Para revisão",acompanhar:"Acompanhando",bloqueado:"Bloqueado"};
  const formatData=s=>{
    if(!s)return "Sem horário";
    const d=new Date(s);
    return Number.isFinite(d.getTime())?
      d.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):
      "Sem horário";
  };
  async function request(url,opt={}){
    const response=await fetch(url,{cache:"no-store",...opt});
    let r;
    try{r=await response.json();}catch{throw Error("Resposta inválida do servidor");}
    if(!response.ok||r.ok===false)throw Error(r.mensagem||"Falha na solicitação");
    return r;
  }
  function renderChart(serie,large=false){
    const wrap=el("div","hunt-chart");
    const total=(serie||[]).filter(x=>Number.isInteger(x.precoTotalCentavos)&&
      x.precoTotalCentavos>0).slice(-30);
    const incluiFrete=total.length>=2;
    const valid=incluiFrete?total:(serie||[]).filter(x=>
      Number.isInteger(x.precoCentavos)&&x.precoCentavos>0).slice(-30);
    if(valid.length<2){
      wrap.append(el("small","", "Gráfico disponível após duas observações"));
      return wrap;
    }
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    const w=large?620:300,h=large?110:52,pad=large?14:5;
    svg.setAttribute("viewBox","0 0 "+w+" "+h);
    svg.setAttribute("preserveAspectRatio","none");
    svg.setAttribute("width","100%");svg.setAttribute("height","100%");
    svg.setAttribute("role","img");svg.setAttribute("aria-label",incluiFrete?
      "Histórico de custo final declarado":"Histórico do preço do item, frete não incluído");
    const values=valid.map(x=>incluiFrete?x.precoTotalCentavos:x.precoCentavos);
    const min=Math.min(...values),max=Math.max(...values);
    const scale=max-min||1;
    const points=values.map((n,i)=>
      (pad+i*(w-2*pad)/(values.length-1)).toFixed(1)+","+
      (h-pad-(n-min)/scale*(h-2*pad)).toFixed(1)).join(" ");
    const grid=document.createElementNS("http://www.w3.org/2000/svg","line");
    grid.setAttribute("x1",String(pad));grid.setAttribute("x2",String(w-pad));
    grid.setAttribute("y1",String(h-pad));grid.setAttribute("y2",String(h-pad));
    grid.setAttribute("stroke","#d9e6eb");svg.append(grid);
    const path=document.createElementNS("http://www.w3.org/2000/svg","polyline");
    path.setAttribute("points",points);path.setAttribute("fill","none");
    path.setAttribute("stroke",values.at(-1)<values[0]?"#14946d":"#6483ac");
    path.setAttribute("stroke-linecap","round");path.setAttribute("stroke-linejoin","round");
    path.setAttribute("stroke-width",large?"3":"2.4");svg.append(path);
    wrap.append(svg);
    return wrap;
  }
  function card(p){
    const root=el("article","hunt-card");
    const head=el("div","hunt-card-header");
    head.append(el("span","hunt-channel",p.canal+" · "+p.pagamento));
    head.append(el("span","hunt-score",num(p.pontuacao)+" / 100"));
    const body=el("div","hunt-card-body");
    body.append(el("h3","",p.titulo));
    const split=el("div","hunt-product-split");
    if(p.imagemUrl){
      const img=el("img","hunt-product-image");
      img.loading="lazy";img.alt="";img.referrerPolicy="no-referrer";
      img.src=p.imagemUrl;
      img.addEventListener("error",()=>{
        img.replaceWith(el("div","hunt-product-fallback","▧"));
      },{once:true});
      split.append(img);
    }else split.append(el("div","hunt-product-fallback","▧"));
    const prices=el("div","hunt-prices");
    prices.append(el("strong","",brl(p.precoCentavos)));
    if(p.precoAnteriorCentavos)prices.append(el("del","",brl(p.precoAnteriorCentavos)));
    prices.append(el("small","",p.freteCentavos===null?"Frete não confirmado":
      p.freteCentavos===0?"Frete informado: grátis":"Frete informado: "+brl(p.freteCentavos)));
    split.append(prices);body.append(split);
    body.append(renderChart(p.serie));
    const legend=el("div","hunt-trend-note");
    const mem=p.memoria??p.memoriaProduto;
    const drop=mem?.quedaHistoricaPercentual;
    legend.append(el("span","",drop!==null&&drop!==undefined&&
      mem?.periodos>=2?(drop>0?"−":drop<0?"+":"")+
      Math.abs(drop).toFixed(1)+(p.memoria?"% no custo total":"% no preço do item"):"Memória em formação"));
    legend.append(el("span","",num(p.observacoes)+" registros"));
    body.append(legend);
    const badges=el("div","hunt-badges");
    badges.append(el("span","hunt-badge "+p.situacao,estados[p.situacao]||"Em análise"));
    if(p.cupomCodigo)badges.append(el("span","hunt-badge","Cupom não verificado"));
    if(p.urlAfiliado)badges.append(el("span","hunt-badge","Link informado"));
    body.append(badges);
    const footer=el("div","hunt-card-footer");
    const details=el("button","hunt-button","Ver histórico");
    details.type="button";details.addEventListener("click",()=>abrirProduto(p));
    footer.append(details,el("span","",formatData(p.observadoEmUtc)));
    root.append(head,body,footer);
    return root;
  }
  function render(data){
    const k=data.resumo||{};
    for(const [id,value] of [
      ["huntTotal",k.total],["huntReview",k.paraRevisar],
      ["huntWatch",k.acompanhar],["huntBlocked",k.bloqueados],
      ["huntCoupon",k.cuponsNaoVerificados],["huntObservations",k.observacoes]
    ])$(id).textContent=num(value);
    const list=$("huntList"),itens=Array.isArray(data.itens)?data.itens:[];
    if(!itens.length){
      list.replaceChildren(el("div","hunt-empty",k.total?
        "Nenhum produto atende aos filtros. Ajuste a pesquisa ou o veredito.":
        "Catálogo vazio. Registre uma observação manual para começar a memória de preços."));
      return;
    }
    list.replaceChildren(...itens.map(card));
  }
  async function carregar(){
    const ticket=++serial;
    const query=new URLSearchParams({
      busca:$("huntSearch").value,canal:$("huntFilterCanal").value,
      situacao:$("huntFilterSituacao").value,limite:"200"
    });
    try{
      const resp=await request("/api/cacador/catalogo?"+query);
      if(ticket===serial)render(resp);
    }catch(e){
      if(ticket===serial)$("huntList").replaceChildren(
        el("div","hunt-empty","Não foi possível consultar o catálogo: "+e.message));
    }
  }
  function criarPar(titulo,valor){
    const box=el("div");
    box.append(el("span","",titulo),el("strong","",valor??"—"));
    return box;
  }
  function abrirProduto(p){
    selected=p;
    $("huntDialogTitle").textContent=p.titulo;
    const body=$("huntDialogBody");
    const pairs=el("div","hunt-detail-pairs");
    pairs.append(
      criarPar("Plataforma / ID",p.canal+" / "+p.produtoId),
      criarPar("Vendedor / variante",p.vendedor+" / "+p.variante),
      criarPar("Preço atual declarado",brl(p.precoCentavos)),
      criarPar("Frete declarado",p.freteCentavos===null?"Não confirmado":brl(p.freteCentavos)),
      criarPar("Mediana histórica ("+(p.memoria?"custo total":"só item")+")",brl((p.memoria??p.memoriaProduto)?.precoNormalCentavos)),
      criarPar("Menor preço anterior",brl((p.memoria??p.memoriaProduto)?.menorPrecoCentavos)),
      criarPar("Observações",num(p.observacoes)),
      criarPar("Situação",estados[p.situacao])
    );
    body.replaceChildren(pairs,renderChart(p.serie,true));
    const links=el("div","hunt-dialog-links");
    for(const [title,url] of [["Ver anúncio",p.urlProduto],["Abrir link informado",p.urlAfiliado]]){
      if(!url)continue;
      const a=el("a","",title);
      a.href=url;a.target="_blank";a.rel="noopener noreferrer";
      links.append(a);
    }
    if(links.childNodes.length)body.append(links);
    const ul=el("ul","hunt-dialog-alerts");
    for(const alerta of (p.alertas||[]))ul.append(el("li","",alerta));
    body.append(ul);
    const forward=$("huntForwardForm");
    forward.hidden=!p.urlAfiliado||p.disponibilidade!=="declarada"||
      p.canal==="Amazon";
    forward.reset();$("huntForwardMsg").textContent="";
    $("huntReputationLine").hidden=p.canal!=="Mercado Livre";
    $("huntReputationLine").querySelector("input").required=p.canal==="Mercado Livre";
    if(typeof $("huntDialog").showModal==="function")$("huntDialog").showModal();
  }
  function lerReais(texto,obrigatorio=false){
    const s=String(texto??"").trim();
    if(!s&&!obrigatorio)return null;
    if(!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(s))throw Error("Preço inválido. Use R$ 99,90 sem milhar.");
    const n=Math.round(Number(s.replace(",","."))*100);
    if(!Number.isSafeInteger(n)||n<0||(obrigatorio&&n===0))
      throw Error("Informe preço positivo em reais.");
    return n;
  }
  function lerDecimal(txt){
    const s=String(txt??"").trim();
    if(!s)return null;
    if(!/^\d{1,3}(?:[.,]\d{1,2})?$/.test(s))throw Error("Nota ou comissão inválida.");
    return Number(s.replace(",","."));
  }
  function lerInteiro(txt){
    const s=String(txt??"").trim();
    if(!s)return null;
    if(!/^\d{1,8}$/.test(s))throw Error("Avaliações/vendidos devem ser inteiros.");
    return Number(s);
  }
  function montarEntrada(form){
    const v=k=>form.elements.namedItem(k)?.value??"";
    const checked=k=>form.elements.namedItem(k)?.checked===true;
    return {
      canal:v("canal"),produtoId:v("produtoId").trim(),
      titulo:v("titulo").trim(),vendedor:v("vendedor").trim(),
      variante:v("variante").trim(),pagamento:v("pagamento"),
      precoCentavos:lerReais(v("preco"),true),
      freteCentavos:lerReais(v("frete")),
      precoAnteriorCentavos:lerReais(v("precoAnterior")),
      urlProduto:v("urlProduto").trim(),urlAfiliado:v("urlAfiliado").trim()||null,
      imagemUrl:v("imagemUrl").trim()||null,nota:lerDecimal(v("nota")),
      avaliacoes:lerInteiro(v("avaliacoes")),vendidos:lerInteiro(v("vendidos")),
      comissaoEstimadaPercentual:lerDecimal(v("comissao")),
      cupomCodigo:v("cupomCodigo").trim()||null,disponibilidade:v("disponibilidade"),
      freteGratis:checked("freteGratis"),full:checked("full"),maisVendido:checked("maisVendido"),
      confirmadoManualmente:checked("confirmadoManualmente")
    };
  }
  async function registrar(ev){
    ev.preventDefault();
    const form=$("huntForm"),msg=$("huntFormMsg");
    msg.textContent="";msg.classList.remove("is-error");
    const button=$("huntSave");button.disabled=true;
    try{
      const resp=await request("/api/cacador/observacoes",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(montarEntrada(form))
      });
      msg.textContent=resp.mensagem||"Registro salvo.";
      form.reset();await carregar();
    }catch(e){msg.classList.add("is-error");msg.textContent=e.message;}
    finally{button.disabled=false;}
  }
  async function encaminhar(ev){
    ev.preventDefault();
    if(!selected)return;
    const msg=$("huntForwardMsg"),form=$("huntForwardForm");
    const checked=k=>form.elements.namedItem(k)?.checked===true;
    const btn=$("huntForwardButton");
    btn.disabled=true;msg.textContent="Registrando rascunho...";
    try{
      const resp=await request("/api/cacador/encaminhar/"+selected.chave,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({confirmacoes:{
          preco:checked("preco"),disponibilidade:checked("disponibilidade"),
          reputacaoVerde:checked("reputacaoVerde"),linkAfiliado:checked("linkAfiliado")
        }})
      });
      msg.replaceChildren(document.createTextNode(resp.mensagem+" "));
      const link=el("a","", "Abrir módulo de revisão");
      link.href=resp.destino;msg.append(link);
      await carregarConexoes();
    }catch(e){msg.textContent=e.message;}
    finally{btn.disabled=false;}
  }
  async function carregarConexoes(){
    const reqs=[
      (async()=>{const x=await request("/api/status");
        $("huntOpStatus").textContent=x.monitorAlternadoAtivo?
          "Monitor em execução na Central (não controlado aqui)":"Monitor pausado na Central";})(),
      (async()=>{const x=await request("/api/mercadolivre/rascunhos-assistidos");
        $("huntMeliDrafts").textContent=num(x.rascunhos?.length)+" rascunhos manuais";})(),
      (async()=>{const x=await request("/api/shopee/rascunhos");
        $("huntShopeeDrafts").textContent=num(x.rascunhos?.length)+" rascunhos manuais";})()
    ];
    await Promise.allSettled(reqs);
  }
  $("huntShowForm").addEventListener("click",()=>{
    const p=$("huntFormPanel");p.hidden=!p.hidden;
    $("huntShowForm").setAttribute("aria-expanded",String(!p.hidden));
    if(!p.hidden)p.scrollIntoView({behavior:"smooth",block:"nearest"});
  });
  $("huntCloseForm").addEventListener("click",()=>{
    $("huntFormPanel").hidden=true;
    $("huntShowForm").setAttribute("aria-expanded","false");
  });
  $("huntCanal").addEventListener("change",()=>{
    const p=$("huntForm").elements.namedItem("produtoId");
    p.placeholder=$("huntCanal").value==="Mercado Livre"?"MLB123456789":
      $("huntCanal").value==="Amazon"?"B0XXXXXXXX":"1234567890";
  });
  $("huntForm").addEventListener("submit",registrar);
  $("huntRefresh").addEventListener("click",()=>{void carregar();void carregarConexoes();});
  $("huntFilterCanal").addEventListener("change",carregar);
  $("huntFilterSituacao").addEventListener("change",carregar);
  let debounce;
  $("huntSearch").addEventListener("input",()=>{clearTimeout(debounce);debounce=setTimeout(carregar,250);});
  $("huntForwardForm").addEventListener("submit",encaminhar);
  $("huntCloseDialog").addEventListener("click",()=>$("huntDialog").close());
  $("huntDialog").addEventListener("click",event=>{
    if(event.target===$("huntDialog"))$("huntDialog").close();
  });
  void carregar();void carregarConexoes();
})();
