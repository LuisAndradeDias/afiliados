(()=>{
  const button=document.getElementById('confirmarRecusa');
  const result=document.getElementById('resultado');
  if(!button||!result)return;
  // Pré-visualizações de links não executam ações. Só um toque explícito envia POST.
  button.addEventListener('click',async()=>{
    button.disabled=true;result.hidden=true;result.classList.remove('erro');
    try{
      const token=new URLSearchParams(location.search).get('token')||'';
      const response=await fetch('/api/recusar',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({token}),
      });
      const data=await response.json();
      if(!response.ok||!data.ok)throw new Error(data.mensagem||'Não foi possível registrar.');
      result.textContent='Sua preferência foi registrada: você não deseja novos convites. '+
        'O bloqueio será aplicado assim que o sistema sincronizar seu pedido.';
      button.hidden=true;
    }catch(error){
      result.classList.add('erro');
      result.textContent=error.message||'Não foi possível registrar. Tente novamente.';
      button.disabled=false;
    }
    result.hidden=false;
  });
})();