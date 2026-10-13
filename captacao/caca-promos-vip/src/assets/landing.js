(() => {
  const form = document.getElementById('signupForm');
  if (!form) return;
  const status = document.getElementById('signupStatus');
  const button = document.getElementById('signupButton');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.hidden = true;
    status.classList.remove('error');
    status.textContent = '';
    button.disabled = true;
    const origem = location.pathname.startsWith('/c/')
      ? location.pathname.slice(3)
      : (new URLSearchParams(location.search).get('origem') || 'direto');

    try {
      const response = await fetch('/api/cadastro', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nome: document.getElementById('leadName').value,
          telefone: document.getElementById('leadPhone').value,
          origem,
          consentimento: document.getElementById('leadConsent').checked,
          website: document.getElementById('leadWebsite').value,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.mensagem || 'Não foi possível processar o cadastro.');
      const descricao = document.createElement('div');
      descricao.textContent = 'Solicitação registrada. Nenhuma mensagem será enviada até confirmarmos sua autorização.';
      status.append(descricao);

      if (payload.repetido) {
        const texto = document.createElement('p');
        texto.textContent = 'Se você já se cadastrou, não é necessário repetir o pedido. Para corrigir ou cancelar seu contato, fale com o administrador.';
        status.append(texto);
      } else if (payload.codigo) {
        const p = document.createElement('p');
        p.textContent = 'Seu código de confirmação: ';
        const strong = document.createElement('strong');
        strong.textContent = payload.codigo;
        p.append(strong);
        status.append(p);
        if (payload.remetente) {
          const instructions = document.createElement('p');
          instructions.textContent = 'Envie QUERO VIP e o código pelo seu próprio WhatsApp. Nosso administrador verificará a mensagem antes de ativar o cadastro.';
          status.append(instructions);
          const link = document.createElement('a');
          link.href = 'https://wa.me/' + payload.remetente + '?text=' + encodeURIComponent('QUERO VIP ' + payload.codigo);
          link.textContent = 'Confirmar no meu WhatsApp ↗';
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          status.append(link);
        } else {
          const info = document.createElement('p');
          info.textContent = 'O segundo WhatsApp ainda está em configuração. Guarde esse código; o cadastro permanece pendente e não receberá mensagens até a confirmação.';
          status.append(info);
        }
      }
      form.reset();
    } catch (error) {
      status.classList.add('error');
      status.textContent = error.message || 'Erro inesperado';
    } finally {
      button.disabled = false;
      status.hidden = false;
    }
  });
})();
