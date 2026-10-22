(() => {
  'use strict';
  if (document.body.dataset.page !== 'respostas') return;

  const $ = (selector) => document.querySelector(selector);
  const table = $('#rbRows');
  const feedback = $('#rbFeedback');
  const labels = {
    'aceite-pendente-operador': 'Aceitou — encaminhar manualmente',
    'recusa-bloqueada': 'Recusa registrada — bloqueado',
    'impedido-bloqueado': 'Bloqueado — não enviar',
    'pendente-consentimento': 'Conferir consentimento',
    'pendente-identidade': 'Identidade não verificada — nenhuma ação',
    'auto-na-fila': 'Convite na fila de resposta automática',
    'auto-tentando': 'Tentativa de resposta iniciada — aguarde',
    'auto-link-enviado-api': 'Link aceito pelo WhatyGo — confirmar no celular',
    'auto-incerto': 'Resposta incerta — não reenviar automaticamente',
    'auto-interrompido': 'Automação interrompida — conferir manualmente',
    'auto-limite-contato': 'Limite de 1 resposta por contato em 24 horas',
    'auto-limite-diario': 'Limite diário de respostas automáticas atingido',
  };
  const nums = {
    recebido: '#rbAll',
    aceites: '#rbAccept',
    recusas: '#rbDecline',
    bloqueios: '#rbBlocked',
    pendentes: '#rbPending',
  };
  let items = [];
  let filter = 'todos';
  let pending = false;
  let updatingAuto = false;

  function cell(row, value) {
    const td = document.createElement('td');
    td.textContent = value;
    row.appendChild(td);
    return td;
  }

  function render() {
    const shown = items.filter((entry) => filter === 'todos' ||
      (filter === 'pendentes' && (entry.status.startsWith('pendente-') ||
        ['auto-na-fila','auto-tentando','auto-incerto','auto-interrompido'].includes(entry.status))) ||
      entry.acao === filter);
    table.replaceChildren();
    if (shown.length === 0) {
      const tr = document.createElement('tr');
      const td = cell(tr, 'Nenhuma resposta encontrada neste filtro.');
      td.colSpan = 5;
      td.className = 'state-empty';
      table.appendChild(tr);
      return;
    }
    for (const entry of shown) {
      const tr = document.createElement('tr');
      const d = new Date(entry.instante);
      cell(tr, Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR'));
      cell(tr, entry.telefone || 'Não identificado');
      cell(tr, entry.acao === 'aceitar' ? 'Entrar no grupo' : 'Não tenho interesse');
      cell(tr, labels[entry.status] || 'Aguardando análise');

      const td = document.createElement('td');
      if (entry.linkGrupo) {
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'btn btn-quiet';
        action.textContent = 'Copiar convite';
        action.addEventListener('click', async () => {
          try {
            const group = new URL(entry.linkGrupo);
            if (group.protocol !== 'https:' || group.hostname !== 'chat.whatsapp.com') throw Error('Link de grupo inválido');
            await navigator.clipboard.writeText(group.href);
            action.textContent = 'Link copiado';
          } catch {
            feedback.textContent = 'Não foi possível copiar o link. Confira as permissões do navegador.';
          }
        });
        td.appendChild(action);
      } else {
        const link = document.createElement('a');
        link.className = 'text-link';
        link.href = entry.status === 'recusa-bloqueada' ? '/denuncias' : '/contatos';
        link.textContent = entry.status === 'recusa-bloqueada' ? 'Ver bloqueios →' : 'Conferir cadastro →';
        td.appendChild(link);
      }
      tr.appendChild(td);
      table.appendChild(tr);
    }
  }

  function renderAuto(configuration) {
    const enabled = configuration?.habilitada === true;
    $('#rbAutoStatus').textContent = enabled ? 'Habilitado' : 'Desativado';
    $('#rbAutoEnable').hidden = enabled;
    $('#rbAutoDisable').hidden = !enabled;
    $('#rbAutoEnable').style.display = enabled ? 'none' : 'inline-flex';
    $('#rbAutoDisable').style.display = enabled ? 'inline-flex' : 'none';
    $('#rbAutoConsent').disabled = enabled;
    $('#rbAutoExplanation').textContent = enabled
      ? 'Ativo somente para novos cliques verificados de contatos autorizados. O link será enviado uma vez, sem reenvio automático.'
      : 'Desativado: cliques ficam registrados para revisão. Contatos bloqueados, sem consentimento ou com identidade incerta não recebem links.';
  }

  async function changeAuto(enabled) {
    if (updatingAuto) return;
    const confirm = $('#rbAutoConsent');
    const message = $('#rbAutoFeedback');
    if (enabled && !confirm.checked) {
      message.textContent = 'Marque a confirmação de consentimento antes de ativar.';
      return;
    }
    updatingAuto = true;
    $('#rbAutoEnable').disabled = true;
    $('#rbAutoDisable').disabled = true;
    try {
      const response = await fetch('/api/local/whatygo/automacao', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-cpv-local': '1' },
        credentials: 'same-origin',
        body: JSON.stringify({ habilitada: enabled, confirmado: enabled && confirm.checked }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.mensagem || 'Não foi possível alterar a automação.');
      }
      confirm.checked = false;
      renderAuto(result.automacao);
      message.textContent = enabled
        ? 'Automação habilitada. Somente novos cliques de contatos autorizados receberão um link.'
        : 'Automação desativada. Nenhum novo envio automático será iniciado.';
      await refresh();
    } catch (error) {
      message.textContent = error.message || 'Falha ao salvar configuração.';
    } finally {
      updatingAuto = false;
      $('#rbAutoEnable').disabled = false;
      $('#rbAutoDisable').disabled = false;
    }
  }

  async function refresh() {
    if (pending) return;
    pending = true;
    try {
      const response = await fetch('/api/local/whatygo/respostas', { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error('A Central não respondeu à consulta.');
      const data = await response.json();
      if (!data.ok || !Array.isArray(data.registros)) throw new Error('Formato da resposta inválido.');
      items = data.registros;
      renderAuto(data.automacao);
      for (const [key, selector] of Object.entries(nums)) {
        const el = $(selector);
        if (el) el.textContent = String(data.total?.[key] ?? 0);
      }
      feedback.textContent = data.total?.recebido
        ? 'Eventos registrados. A resposta automática pode enviar o link, mas a entrada no grupo depende do destinatário.'
        : 'Monitorando cliques novos. As respostas anteriores à integração não têm identidade registrada.';
      render();
    } catch (error) {
      feedback.textContent = error.message || 'Falha ao consultar respostas.';
    } finally {
      pending = false;
    }
  }

  $('#rbAutoEnable')?.addEventListener('click', () => changeAuto(true));
  $('#rbAutoDisable')?.addEventListener('click', () => changeAuto(false));
  $('#rbRefresh')?.addEventListener('click', refresh);
  $('#rbFilters')?.addEventListener('click', (event) => {
    const target = event.target.closest('button[data-choice]');
    if (!target) return;
    filter = target.dataset.choice;
    for (const button of document.querySelectorAll('#rbFilters button')) {
      const selected = button === target;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
    render();
  });
  refresh();
  setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 15000);
})();
