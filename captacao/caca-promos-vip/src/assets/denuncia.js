(() => {
  const button=document.getElementById('complaintButton');
  const notice=document.getElementById('complaintMessage');
  if(!button||!notice)return;
  // Nenhum GET, prévia de link ou carregamento automático registra denúncia.
  button.addEventListener('click',async()=>{
    button.disabled=true;
    notice.hidden=true;
    notice.classList.remove('error');
    try {
      const token=new URLSearchParams(location.search).get('token')||'';
      const r=await fetch('/api/denunciar',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({token}),
      });
      const result=await r.json();
      if(!r.ok||!result.ok)throw new Error(result.mensagem||'Link inválido.');
      notice.textContent='Sua denúncia foi registrada no Caça Promos VIP. '+
        'Seu número foi bloqueado para novos convites. '+
        'Nenhuma denúncia foi enviada ao WhatsApp ou à Meta.';
      button.hidden=true;
    }catch(erro){
      notice.classList.add('error');
      notice.textContent=erro.message||'Não foi possível registrar sua reclamação.';
      button.disabled=false;
    }
    notice.hidden=false;
  });
})();
