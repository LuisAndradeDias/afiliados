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
    'aceite-antigo-reativado': 'Reativado depois: faça um novo clique para solicitar o link',
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
        if(entry.status === 'impedido-bloqueado' && !entry.contatoId) {
          link.href='/contatos#reativar-teste';
          link.textContent='Conferir número e bloqueio →';
        } else if(entry.status === 'recusa-bloqueada') {
          link.href='/denuncias';link.textContent='Ver bloqueios →';
        } else {
          link.href='/contatos';link.textContent='Conferir cadastro →';
        }
        td.appendChild(link);
      }
      tr.appendChild(td);
      table.appendChild(tr);
    }
  }

  function renderLastOutcome(registros, total) {
    const indicator = $('#rbLatestOutcome');
    if (!indicator) return;
    const latest = Array.isArray(registros) ? registros[0] : null;
    indicator.replaceChildren();
    if (!latest) {
      indicator.hidden = true;
      return;
    }
    indicator.hidden = false;
    const heading = document.createElement('strong');
    const quando=new Date(latest.instante);
    const dataClique=Number.isNaN(quando.valueOf())?'horário não identificado':
      quando.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
    heading.textContent='Último clique · '+dataClique+' · '+(latest.telefone||'Não identificado')+': ';
    indicator.appendChild(heading);
    const messages = {
      'impedido-bloqueado': 'LINK NÃO ENVIADO. Este número clicou em “Não tenho interesse” anteriormente e permanece bloqueado. A automação ativa não ultrapassa bloqueios.',
      'aceite-antigo-reativado': 'O número foi reativado depois deste clique, mas a solicitação antiga não é reprocessada. Faça um novo envio manual dos botões e toque novamente em Entrar no grupo.',
      'pendente-consentimento': 'LINK NÃO ENVIADO. Este número não possui consentimento válido cadastrado. É preciso uma autorização documentada para testar a resposta automática.',
      'pendente-identidade': 'Nenhum convite enviado: a identidade do destinatário não pôde ser comprovada.',
      'aceite-pendente-operador': 'Aceite registrado. Automação desligada no momento do clique: envio somente manual.',
      'auto-na-fila': 'Aceite válido. O envio aguarda processamento.',
      'auto-tentando': 'Tentativa de envio iniciada. Aguardando retorno do WhatyGo.',
      'auto-link-enviado-api': 'O WhatyGo aceitou o envio do link; confira a entrega e a entrada no aplicativo.',
      'auto-incerto': 'Resultado de envio incerto. Confira manualmente; não há reenvio automático.',
      'auto-limite-contato': 'Nenhum novo convite: limite de um envio por contato a cada 24 horas.',
      'auto-limite-diario': 'Nenhum novo convite: limite diário da automação atingido.',
      'auto-interrompido': 'Envio automático interrompido. Verifique antes de tentar manualmente.',
      'recusa-bloqueada': 'A recusa foi registrada. O contato não receberá novos convites.',
    };
    const outcome = document.createElement('span');
    outcome.textContent = messages[latest.status] || 'Consulte o histórico abaixo.';
    indicator.appendChild(outcome);
    if (latest.status === 'impedido-bloqueado' || latest.status === 'recusa-bloqueada' || latest.status === 'aceite-antigo-reativado') {
      const explanation = document.createElement('span');
      explanation.textContent = latest.status === 'aceite-antigo-reativado'
        ? ' A conta está liberada para um novo teste individual autorizado.'
        : latest.contatoId
        ? ' Uma nova autorização documentada é necessária para desbloquear o contato.'
        : ' Esse número ainda não tem cadastro associado. Confira o DDD na tela de reativação, registre nova autorização do titular e só depois faça um novo teste. Não reaproveite cliques antigos.';
      indicator.appendChild(explanation);
      const link = document.createElement('a');
      link.className = 'text-link';
      link.href = latest.status === 'aceite-antigo-reativado' ? '/enviar'
        : latest.contatoId ? '/contatos?filtro=bloqueado' : '/contatos#reativar-teste';
      link.textContent = latest.status === 'aceite-antigo-reativado' ? ' Preparar novo convite →'
        : latest.contatoId ? ' Consultar contatos bloqueados →' : ' Reativar meu número de teste →';
      indicator.appendChild(link);
    }
    if (Number.isInteger(total?.respostasAutomaticas)) {
      const summary = document.createElement('small');
      summary.textContent = ' Respostas automáticas aceitas pela API: ' + total.respostasAutomaticas + '.';
      indicator.appendChild(summary);
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
      renderLastOutcome(data.registros, data.total);
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
