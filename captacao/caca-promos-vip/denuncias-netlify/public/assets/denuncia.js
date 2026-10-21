(()=>{
 const btn=document.getElementById('denunciar'),out=document.getElementById('resposta');
 if(!btn||!out)return;
 btn.addEventListener('click',async()=>{
  btn.disabled=true;out.hidden=true;out.classList.remove('erro');
  try {
   const token=new URLSearchParams(location.search).get('token')||'';
   const r=await fetch('/api/denunciar',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({token})});
   const result=await r.json();
   if(!r.ok||!result.ok)throw new Error(result.mensagem||'Falha ao registrar.');
   out.textContent='Sua denúncia foi registrada internamente no Caça Promos VIP. '+
    'Vamos bloquear novos convites assim que o sistema sincronizar sua solicitação. '+
    'Nenhuma denúncia foi enviada ao WhatsApp ou à Meta.';
   btn.hidden=true;
  }catch(e){out.classList.add('erro');out.textContent=e.message||'Tente novamente.';btn.disabled=false;}
  out.hidden=false;
 });
})();
