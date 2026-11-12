(() => {
  "use strict";
  const form=document.getElementById("mlAssistForm");
  const list=document.getElementById("mlAssistList");
  const feedback=document.getElementById("mlAssistFeedback");
  const submit=document.getElementById("mlAssistSave");
  if(!form||!list||!feedback||!submit)return;
  // Caçador VIP: um clique leva ao cadastro MELI e expande a seção,
  // sem disparar captura, requisição externa ou envio.
  const assistDetails=document.getElementById("mlAssistDetails");
  const abrirPeloAtalho=()=>{
    if(!assistDetails||location.hash!=="#mlAssistDetails")return;
    // O cadastro MELI está dentro da aba Ferramentas do drawer UX-03.
    // Apenas abre controles existentes; jamais dispara uma ação comercial.
    const settings=document.getElementById("cpvSettingsButton");
    const tab=document.getElementById("cpvSettingsTab-ferramentas");
    if(settings&&tab){
      settings.click();
      tab.click();
    }
    assistDetails.open=true;
  };
  abrirPeloAtalho();
  window.addEventListener("hashchange",abrirPeloAtalho);
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
  // MELI-09: confirmação manual de canal público, independente dos rascunhos.
  const canalStatus=byId("mlCanalStatus");
  const canalConfirmar=byId("mlCanalConfirmar");
  const canalRevogar=byId("mlCanalRevogar");
  const canalApi="/api/mercadolivre/canal";
  async function carregarCanal(){
    const state=await api(canalApi);
    if(canalStatus){
      canalStatus.textContent=state.permitido
        ? "Canal público cadastrado declarado pelo operador. A confirmação não substitui a verificação das regras oficiais."
        : "WhatsApp Mercado Livre bloqueado: "+String(state.mensagem||"canal não confirmado.");
      canalStatus.style.color=state.permitido?"#067647":"#92400e";
    }
    if(canalRevogar)canalRevogar.disabled=!state.permitido;
    return state;
  }
  if(canalConfirmar)canalConfirmar.addEventListener("click",async()=>{
    if(canalConfirmar.disabled)return;
    const ids=["mlCanalPublico","mlCanalCadastrado","mlCanalSemPrivado"];
    if(!ids.every(id=>byId(id).checked)){
      if(canalStatus)canalStatus.textContent="Marque as três confirmações verdadeiras antes de salvar.";
      return;
    }
    canalConfirmar.disabled=true;
    try {
      await api(canalApi,{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({
          acao:"confirmar",grupoPublico:true,cadastradoNoPrograma:true,semDivulgacaoPrivada:true
        })
      });
      await carregarCanal();
    }catch(e){if(canalStatus)canalStatus.textContent=e.message;}
    finally{canalConfirmar.disabled=false;}
  });
  if(canalRevogar)canalRevogar.addEventListener("click",async()=>{
    if(!window.confirm("Revogar a confirmação do destino Mercado Livre? Os envios MELI ficarão bloqueados."))return;
    canalRevogar.disabled=true;
    try{
      await api(canalApi,{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({acao:"revogar"})
      });
      for(const id of ["mlCanalPublico","mlCanalCadastrado","mlCanalSemPrivado"]){
        byId(id).checked=false;
      }
      await carregarCanal();
    }catch(e){if(canalStatus)canalStatus.textContent=e.message;}
    finally{canalRevogar.disabled=false;}
  });
  if(canalStatus)carregarCanal().catch(()=>{
    canalStatus.textContent="Não foi possível verificar o canal; envio Mercado Livre permanece bloqueado.";
  });
  load().catch(()=>notice("Rascunhos assistidos indisponíveis. Atualize a Central."));
})();
