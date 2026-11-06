(() => {
  "use strict";
  const form=document.getElementById("mlAssistForm");
  const list=document.getElementById("mlAssistList");
  const feedback=document.getElementById("mlAssistFeedback");
  const submit=document.getElementById("mlAssistSave");
  if(!form||!list||!feedback||!submit)return;
  const byId=(id)=>document.getElementById(id);
  const base="/api/mercadolivre/rascunhos-assistidos";
  const fmt=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});

  function notice(message,success=false){
    feedback.className="ml-assist-feedback"+(success?" ok":"");
    feedback.textContent=message;
  }
  async function api(path,options={}){
    const r=await fetch(path,{cache:"no-store",...options});
    const data=await r.json().catch(()=>({ok:false,mensagem:"Resposta inválida da Central."}));
    if(!r.ok||!data.ok)throw Error(data.mensagem||"Não foi possível salvar o rascunho.");
    return data;
  }
  function card(d){
    const article=document.createElement("article");
    article.className="ml-assist-item";
    const title=document.createElement("strong");
    title.textContent=d.titulo;
    const amount=document.createElement("small");
    amount.textContent=fmt.format(d.precoAtual)+" (antes "+fmt.format(d.precoAnterior)+
      ") · "+String(d.descontoPercentual).replace(".",",")+"% · "+
      "verificado manualmente; reconfirme antes de divulgar.";
    const state=document.createElement("small");
    state.textContent="Rascunho local — não publicado, não enviado.";
    const actions=document.createElement("div");
    actions.className="ml-assist-actions";
    const product=document.createElement("a");
    product.href=d.urlProduto;
    product.target="_blank";
    product.rel="noopener noreferrer";
    product.textContent="Abrir produto";
    const copy=document.createElement("button");
    copy.type="button";copy.className="secondary";
    copy.textContent="Copiar link de afiliado";
    copy.addEventListener("click",async()=>{
      try{await navigator.clipboard.writeText(d.urlAfiliado);
        notice("Link copiado. Nenhuma mensagem enviada.",true);
      }catch{notice("Não foi possível copiar o link. Verifique a permissão do navegador.");}
    });
    const remove=document.createElement("button");
    remove.type="button";remove.className="secondary";
    remove.dataset.remove=d.id;remove.textContent="Excluir";
    remove.addEventListener("click",async()=>{
      if(!window.confirm("Excluir apenas este rascunho local?"))return;
      try{
        await api(base+"/"+encodeURIComponent(d.id),{method:"DELETE"});
        notice("Rascunho excluído, sem afetar as ofertas operacionais.",true);
        await load();
      }catch(error){notice(error.message);}
    });
    actions.append(product,copy,remove);
    article.append(title,amount,state,actions);
    return article;
  }
  function paint(items){
    list.replaceChildren();
    if(!items.length){
      const empty=document.createElement("p");
      empty.className="ml-assist-help";
      empty.textContent="Nenhum rascunho assistido. Links salvos aqui não são enviados automaticamente.";
      list.append(empty);return;
    }
    for(const item of items)list.append(card(item));
  }
  async function load(){
    const data=await api(base);
    paint(data.rascunhos);
  }
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    if(!form.reportValidity()||submit.disabled)return;
    submit.disabled=true;
    const previous=submit.textContent;
    submit.textContent="Salvando rascunho...";
    const payload={
      titulo:byId("mlAssistTitle").value,
      urlProduto:byId("mlAssistProduct").value,
      urlAfiliado:byId("mlAssistAffiliate").value,
      precoAtual:byId("mlAssistPrice").value,
      precoAnterior:byId("mlAssistPrevious").value,
      confirmacoes:{
        preco:byId("mlAssistPriceCheck").checked,
        disponibilidade:byId("mlAssistStockCheck").checked,
        reputacaoVerde:byId("mlAssistSellerCheck").checked,
        linkAfiliado:byId("mlAssistLinkCheck").checked
      }
    };
    try{
      await api(base,{method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify(payload)});
      form.reset();
      notice("Rascunho salvo localmente para revisão. Nenhuma oferta foi enviada.",true);
      await load();
    }catch(error){notice(error.message);}
    finally{submit.disabled=false;submit.textContent=previous;}
  });
  load().catch(()=>notice("Rascunhos assistidos indisponíveis. Atualize a Central."));
})();
