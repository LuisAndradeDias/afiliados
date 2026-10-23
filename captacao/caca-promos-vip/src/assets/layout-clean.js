(() => {
  'use strict';
  if (document.body.dataset.layout !== 'clean') return;
  const $ = (id) => document.getElementById(id);
  const button = $('cleanMenuButton');
  const overlay = $('cleanOverlay');
  const sidebar = $('cleanSidebar');
  const narrow = window.matchMedia('(max-width: 850px)');
  let lastFocus = null;
  function menu(open) {
    if (!button || !overlay || !sidebar) return;
    const on = !!open && narrow.matches;
    document.body.classList.toggle('clean-menu-open', on);
    overlay.hidden = !on;
    button.setAttribute('aria-expanded', String(on));
    button.setAttribute('aria-label', on ? 'Fechar menu' : 'Abrir menu');
    if (on) {
      lastFocus = document.activeElement;
      sidebar.querySelector('.clean-nav-link.is-current, .clean-nav-link')?.focus();
    } else if (document.activeElement && sidebar.contains(document.activeElement)) {
      (lastFocus instanceof HTMLElement ? lastFocus : button).focus();
    }
  }
  button?.addEventListener('click', () =>
    menu(!document.body.classList.contains('clean-menu-open')));
  overlay?.addEventListener('click', () => menu(false));
  sidebar?.addEventListener('click', (event) => {
    if (event.target.closest('a')) menu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (!document.body.classList.contains('clean-menu-open')) return;
    if (event.key === 'Escape') { menu(false); return; }
    if (event.key === 'Tab' && sidebar) {
      const links = [...sidebar.querySelectorAll('a[href]')];
      const first = links[0], last = links[links.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();first?.focus();
      }
    }
  });
  narrow.addEventListener('change', () => menu(false));

  // Small responsive dashboard. All data comes from the existing local APIs.
  if (!$('cleanLatestReplies')) return;
  const set = (id, value) => { const el = $(id); if (el) el.textContent = String(value); };
  const empty = (msg) => {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;td.className = 'clean-empty';td.textContent = msg;
    tr.append(td);return tr;
  };
  async function json(path) {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('Consulta indisponível');
    return response.json();
  }
  const pill = (status) => {
    if (status === 'recusa-bloqueada' || status === 'impedido-bloqueado')
      return ['Bloqueado','is-blocked'];
    if (status === 'auto-link-enviado-api') return ['Envio aceito',''];
    if (status === 'aceite-pendente-operador') return ['Aceite registrado',''];
    if (status === 'aceite-antigo-reativado') return ['Reativado','is-pending'];
    if (status === 'auto-incerto') return ['Conferir envio','is-pending'];
    if (status.startsWith('pendente-')) return ['Pendente','is-pending'];
    if (status === 'auto-na-fila' || status === 'auto-tentando') return ['Em processamento','is-pending'];
    return ['Registrado',''];
  };
  async function loadOverview() {
    const [overview, manual, clicks] = await Promise.allSettled([
      json('/api/local/gestao/resumo'),
      json('/api/local/campanhas/convite/manual/estatisticas'),
      json('/api/local/whatygo/respostas'),
    ]);
    if (overview.status === 'fulfilled' && overview.value.ok) {
      const r = overview.value;
      set('cleanAuthorized', r.contatos?.autorizado ?? '—');
      set('cleanBlocked', r.contatos?.bloqueiosPersistentes ?? '—');
      set('cleanQueues', r.filas?.total ?? '—');
      set('cleanPending', r.filas?.pendentes ?? '—');
      const phases = {
        inativo: 'Pronto para iniciar',
        parado: 'Pronto para iniciar',
        pronto: 'Conversa preparada',
        confirmado: 'Envio confirmado',
        incerto: 'Conferir resultado',
        erro: 'Requer atenção',
        cancelado: 'Disponível para iniciar',
      };
      set('cleanWhatsappStatus', phases[r.whatsapp?.fase] || 'Consulte o envio');
      set('cleanWhatsappHint', 'O envio pelo WhatsApp Web exige confirmação.');
    } else {
      set('cleanWhatsappStatus','Não foi possível verificar');
      set('cleanWhatsappHint','Atualize a página ou abra Enviar convite.');
    }
    if (manual.status === 'fulfilled' && manual.value.ok) {
      const control = manual.value.controle;
      set('cleanToday', control?.iniciadosHoje ?? '—');
      set('cleanDayLimit', 'Limite: ' + (control?.limiteDiario ?? '50') + ' conversas/dia');
    }
    const tbody = $('cleanLatestReplies');
    tbody.replaceChildren();
    if (clicks.status !== 'fulfilled' || !clicks.value.ok) {
      set('cleanReplies', '—');
      tbody.append(empty('Não foi possível consultar as respostas.'));
      return;
    }
    set('cleanReplies', clicks.value.total?.recebido ?? 0);
    const recent = Array.isArray(clicks.value.registros) ? clicks.value.registros.slice(0, 4) : [];
    if (!recent.length) {
      tbody.append(empty('Ainda não há respostas registradas.'));
      return;
    }
    for (const item of recent) {
      const tr = document.createElement('tr');
      const stamp = new Date(item.instante);
      const when = Number.isNaN(stamp.getTime())
        ? '—' : stamp.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })
          + ' · ' + stamp.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
      const values = [
        when,
        item.telefone || 'Não identificado',
        item.acao === 'aceitar' ? 'Entrar no grupo' : 'Não tenho interesse',
      ];
      for (const value of values) {
        const td = document.createElement('td');
        td.textContent = value;tr.append(td);
      }
      const td = document.createElement('td');
      const tag = document.createElement('span');
      const [status, cls] = pill(String(item.status || ''));
      tag.className = 'clean-reply-badge ' + cls;tag.textContent = status;
      td.append(tag);tr.append(td);tbody.append(tr);
    }
  }
  loadOverview().catch(() => {
    $('cleanLatestReplies')?.replaceChildren(empty('Atualize a página para tentar novamente.'));
  });
})();
