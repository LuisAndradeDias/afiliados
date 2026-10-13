(() => {
  const button = document.getElementById('unsubscribeButton');
  if (!button) return;
  const out = document.getElementById('unsubscribeMessage');
  button.addEventListener('click', async () => {
    button.disabled = true;
    out.hidden = true;
    try {
      const token = new URLSearchParams(location.search).get('token') || '';
      const r = await fetch('/api/descadastro', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = await r.json();
      if (!r.ok || !json.ok) throw new Error(json.mensagem || 'Link inválido.');
      out.textContent = 'Pedido registrado. Não enviaremos novos convites individuais para este cadastro.';
      button.hidden = true;
    } catch (error) {
      out.textContent = error.message;
      out.classList.add('error');
      button.disabled = false;
    }
    out.hidden = false;
  });
})();
