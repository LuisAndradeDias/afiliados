(() => {
  const $ = (id) => document.getElementById(id);
  const state = { contacts: [], groups: [], metrics: {}, summary: {}, prepared: null };

  async function request(url, options = {}) {
    const init = { credentials: 'same-origin', ...options };
    if (init.method && init.method !== 'GET') {
      init.headers = { 'content-type': 'application/json', 'x-cpv-admin': '1', ...(init.headers || {}) };
    }
    const resp = await fetch(url, init);
    let data;
    try { data = await resp.json(); } catch { data = {}; }
    if (!resp.ok || data.ok === false) {
      if (resp.status === 401 && url !== '/api/admin/login') showLogin();
      throw new Error(data.mensagem || ('Erro na solicitação (' + resp.status + ')'));
    }
    return data;
  }

  function showLogin() {
    $('loginView').hidden = false;
    $('appView').hidden = true;
  }
  function showApp() {
    $('loginView').hidden = true;
    $('appView').hidden = false;
  }
  let feedbackTimer;
  function feedback(message, error = false) {
    const box = $('appFeedback');
    clearTimeout(feedbackTimer);
    box.textContent = message;
    box.classList.toggle('error', error);
    box.hidden = false;
    if (!error) feedbackTimer = setTimeout(() => { box.hidden = true; }, 6500);
  }
  function formatted(date) {
    if (!date) return 'Ainda não';
    const parsed = new Date(date);
    return Number.isFinite(parsed.valueOf()) ? parsed.toLocaleString('pt-BR') : date;
  }
  function badge(status) {
    const b = document.createElement('span');
    b.className = 'badge ' + (status === 'ativo' ? '' : status === 'pendente' ? 'wait' : 'off');
    b.textContent = status === 'ativo' ? 'Autorizado' : status === 'pendente' ? 'Pendente' : 'Descadastrado';
    return b;
  }
  function td(text) {
    const elem = document.createElement('td');
    elem.textContent = text || '';
    return elem;
  }
  function action(label, callback, type = 'secondary') {
    const button = document.createElement('button');
    button.className = type + ' sm';
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', callback);
    return button;
  }

  function renderContacts() {
    const query = $('searchContacts').value.trim().toLowerCase();
    const filter = $('filterContacts').value;
    const origem = $('groupContactsFilter').value;
    const visible = state.contacts.filter(c => {
      if (filter !== 'todos' && c.status !== filter) return false;
      if (origem !== 'todos' && c.origem !== origem) return false;
      return [c.nome, c.telefone, c.origem].some(v => String(v || '').toLowerCase().includes(query));
    });
    const body = $('contactsBody');
    body.replaceChildren();
    if (!visible.length) {
      const line = document.createElement('tr');
      const cell = td('Nenhum contato nessa seleção.');
      cell.colSpan = 5;
      line.append(cell);
      body.append(line);
      return;
    }
    for (const c of visible) {
      const tr = document.createElement('tr');
      const person = td(c.nome || 'Sem nome');
      const tel = document.createElement('small');
      tel.textContent = '+' + c.telefone;
      person.append(tel);
      tr.append(person, td(c.origem));
      const statusCell = document.createElement('td');
      statusCell.append(badge(c.status));
      if (c.ultimoEnvioManualEm) {
        const seen = document.createElement('small');
        seen.textContent = 'Último envio informado: ' + formatted(c.ultimoEnvioManualEm);
        statusCell.append(seen);
      }
      tr.append(statusCell);
      const consent = td(formatted(c.consentimentoDeclaradoEm));
      const proof = document.createElement('small');
      proof.textContent = c.status === 'ativo'
        ? 'Confirmado: ' + formatted(c.consentimentoConfirmadoEm)
        : c.status === 'pendente' ? 'Código: ' + c.codigoConfirmacao : 'Cancelado: ' + formatted(c.descadastroEm);
      consent.append(proof);
      tr.append(consent);
      const buttonsCell = document.createElement('td');
      const actions = document.createElement('div');
      actions.className = 'actions';
      if (c.status === 'pendente') {
        actions.append(action('Conferir código', () => openConfirm(c)));
      } else if (c.status === 'ativo') {
        actions.append(action('Preparar convite', () => openMessage(c)));
      }
      if (c.status !== 'descadastrado') {
        actions.append(action('Descadastrar', () => unsubscribe(c), 'danger'));
      } else {
        actions.append(action('Excluir dados', () => eraseContact(c), 'danger'));
      }
      buttonsCell.append(actions);
      tr.append(buttonsCell);
      body.append(tr);
    }
  }
  function atualizarFiltroOrigens() {
    const seletor = $('groupContactsFilter');
    const atual = seletor.value;
    const origens = [...new Set([
      ...state.groups.map(g => g.origem),
      ...state.contacts.map(c => c.origem),
    ])].sort();
    const opcoes = [['todos', 'Todas as origens'], ...origens.map(o => [o, o])];
    seletor.replaceChildren(...opcoes.map(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      return opt;
    }));
    seletor.value = opcoes.some(([value]) => value === atual) ? atual : 'todos';
  }

  async function alterarPermissaoGrupo(grupo, permitido) {
    const mensagem = permitido
      ? 'Você recebeu autorização do administrador para divulgar o convite neste grupo?'
      : 'Revogar a autorização de divulgação deste grupo?';
    if (!confirm(mensagem)) return;
    try {
      await request('/api/admin/grupos/permissao', {
        method: 'POST',
        body: JSON.stringify({ id: grupo.id, permitido }),
      });
      feedback(permitido ? 'Permissão registrada.' : 'Permissão revogada.');
      await refresh();
    } catch (error) { feedback(error.message, true); }
  }

  async function excluirGrupo(grupo) {
    if (!confirm('Excluir este grupo do painel? Os contatos que já deram autorização manterão sua origem registrada.')) return;
    try {
      await request('/api/admin/grupos/excluir', {
        method: 'POST', body: JSON.stringify({ id: grupo.id }),
      });
      feedback('Grupo retirado da lista. O histórico de consentimento foi mantido.');
      await refresh();
    } catch (error) { feedback(error.message, true); }
  }

  function renderGrupos() {
    const container = $('groupsList');
    $('groupCount').textContent = state.groups.length + (state.groups.length === 1 ? ' grupo' : ' grupos');
    container.replaceChildren();
    if (!state.groups.length) {
      const vazio = document.createElement('div');
      vazio.className = 'group-empty';
      vazio.textContent = 'Nenhum grupo adicionado ainda. Cadastre um link acima para organizar suas campanhas.';
      container.append(vazio);
      return;
    }

    for (const grupo of state.groups) {
      const card = document.createElement('article');
      card.className = 'group-item';
      const top = document.createElement('div');
      top.className = 'group-item-top';
      const titulo = document.createElement('h4');
      titulo.textContent = grupo.nome;
      const situacao = document.createElement('span');
      situacao.className = 'badge ' + (grupo.permissaoDivulgacao ? '' : 'wait');
      situacao.textContent = grupo.permissaoDivulgacao ? 'Divulgação autorizada' : 'Aguardando autorização';
      top.append(titulo, situacao);
      const origem = document.createElement('p');
      origem.className = 'meta';
      origem.textContent = 'Origem na planilha: ' + grupo.origem;
      const explicacao = document.createElement('p');
      explicacao.className = 'fineprint';
      explicacao.textContent = grupo.permissaoDivulgacao
        ? 'O convite pode ser compartilhado após publicação da página em HTTPS.'
        : 'Você pode abrir o grupo para consulta. Peça permissão antes de divulgar.';
      const buttons = document.createElement('div');
      buttons.className = 'actions';

      try {
        const url = new URL(grupo.link);
        if (url.protocol === 'https:' && url.hostname === 'chat.whatsapp.com') {
          const abrir = document.createElement('a');
          abrir.className = 'button secondary sm';
          abrir.href = url.toString();
          abrir.target = '_blank';
          abrir.rel = 'noopener noreferrer';
          abrir.textContent = 'Abrir no WhatsApp ↗';
          buttons.append(abrir);
        }
      } catch { /* URL inválida nunca é aberta. */ }

      buttons.append(action('Importar lista autorizada', () => {
        const destino = $('importCard');
        window.dispatchEvent(new CustomEvent('cpv-select-group', { detail: { id: grupo.id } }));
        destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }));
      buttons.append(action('Usar nesta campanha', () => {
        $('campaignSlug').value = grupo.origem;
        $('groupContactsFilter').value = grupo.origem;
        updateCampaign();
        renderContacts();
        $('campaignCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
        feedback('Origem ' + grupo.origem + ' selecionada. Somente cadastros voluntários entram na planilha.');
      }, 'ghost'));

      const exportar = document.createElement('a');
      exportar.className = 'button secondary sm';
      exportar.href = '/api/admin/contatos.csv?origem=' + encodeURIComponent(grupo.origem);
      exportar.download = 'interessados-' + grupo.origem + '.csv';
      exportar.textContent = 'Planilha da origem ↓';
      buttons.append(exportar);

      buttons.append(action(
        grupo.permissaoDivulgacao ? 'Revogar autorização' : 'Marcar autorização',
        () => alterarPermissaoGrupo(grupo, !grupo.permissaoDivulgacao),
        'ghost'
      ));
      buttons.append(action('Excluir grupo', () => excluirGrupo(grupo), 'danger'));
      card.append(top, origem, explicacao, buttons);
      container.append(card);
    }
  }

  function updateCampaign() {
    const slug = $('campaignSlug').value.trim().toLowerCase();
    const valid = /^[a-z][a-z0-9-]{0,31}$/.test(slug);
    const base = new URL(location.href);
    const link = valid ? base.origin + '/c/' + slug : '';
    $('campaignLink').textContent = valid ? link : 'Identificador inválido: use letras minúsculas, números e hífens.';
    $('copyUrl').disabled = !valid;
    const local = /^(localhost|127\.0\.0\.1)$/i.test(base.hostname);
    const cadastro = state.groups.find(g => g.origem === slug);
    $('copyInvite').disabled = !valid || local || Boolean(cadastro && !cadastro.permissaoDivulgacao);
    $('campaignLink').classList.toggle('local', local);
    $('publicWarning').textContent = local
      ? 'Esta URL é apenas local. Você pode testá-la aqui, mas só divulgue após publicar em HTTPS.'
      : cadastro && !cadastro.permissaoDivulgacao
        ? 'Divulgação aguardando permissão do administrador do grupo.'
        : 'Compartilhe apenas em comunidades em que o administrador permitiu convites.';
    return link;
  }

  async function refresh() {
    const [overview, contacts, groups] = await Promise.all([
      request('/api/admin/resumo'), request('/api/admin/contatos'), request('/api/admin/grupos')
    ]);
    state.contacts = contacts.contatos;
    state.groups = groups.grupos;
    state.summary = overview.contatos;
    state.metrics = overview.metricas;
    $('statVisits').textContent = String(overview.metricas.totalVisitas);
    $('statClicks').textContent = String(overview.metricas.totalCliques);
    $('statActive').textContent = String(overview.contatos.ativos);
    $('statPending').textContent = String(overview.contatos.pendentes);
    $('senderStatus').textContent = overview.contatos.remetenteConfigurado ? 'Número cadastrado' : 'Não configurado';
    $('senderStatus').classList.toggle('wait', !overview.contatos.remetenteConfigurado);
    if (document.activeElement !== $('senderNumber')) {
      $('senderNumber').value = overview.contatos.remetente || '';
    }
    atualizarFiltroOrigens();
    renderContacts();
    renderGrupos();
    updateCampaign();
    const body = $('originsBody');
    body.replaceChildren();
    const items = Object.entries(overview.metricas.campanhas || {}).sort((a,b) => b[1].visitas - a[1].visitas);
    if (!items.length) {
      const row = document.createElement('tr');
      const cell = td('Nenhuma campanha registrada.');
      cell.colSpan = 3;
      row.append(cell);
      body.append(row);
    } else {
      for (const [name, m] of items) {
        const row = document.createElement('tr');
        row.append(td(name), td(String(m.visitas)), td(String(m.cliques)));
        body.append(row);
      }
    }
  }

  async function openConfirm(contact) {
    $('expectedCode').textContent = contact.codigoConfirmacao;
    $('receivedCode').value = '';
    $('verifiedCheckbox').checked = false;
    $('confirmDialog').dataset.id = contact.id;
    $('confirmDialog').showModal();
  }
  async function openMessage(contact) {
    try {
      const data = await request('/api/admin/convite?id=' + encodeURIComponent(contact.id));
      state.prepared = data;
      $('messageText').value = data.mensagem;
      $('openWhatsapp').href = data.url;
      $('messageDialog').showModal();
    } catch (error) { feedback(error.message, true); }
  }
  async function unsubscribe(contact) {
    if (!confirm('Cancelar a autorização deste contato? Não serão preparados novos convites para ele.')) return;
    try {
      await request('/api/admin/descadastrar', { method: 'POST', body: JSON.stringify({ id: contact.id }) });
      feedback('Contato descadastrado.');
      await refresh();
    } catch (error) { feedback(error.message, true); }
  }

  async function eraseContact(contact) {
    if (!confirm('Excluir permanentemente os dados pessoais deste contato descadastrado? Esta ação não pode ser desfeita.')) return;
    try {
      await request('/api/admin/excluir', { method: 'POST', body: JSON.stringify({ id: contact.id }) });
      feedback('Os dados foram apagados do arquivo de contatos.');
      await refresh();
    } catch (error) { feedback(error.message, true); }
  }

  $('loginForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    $('loginFeedback').hidden = true;
    try {
      await request('/api/admin/login', { method: 'POST', body: JSON.stringify({ chave: $('adminKey').value }) });
      $('adminKey').value = '';
      showApp();
      await refresh();
    } catch (error) {
      $('loginFeedback').textContent = error.message;
      $('loginFeedback').classList.add('error');
      $('loginFeedback').hidden = false;
    }
  });
  $('logoutBtn').addEventListener('click', async () => {
    try { await request('/api/admin/logout', { method: 'POST', body: '{}' }); } catch {}
    showLogin();
  });
  $('senderForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      await request('/api/admin/remetente', { method: 'POST', body: JSON.stringify({ telefone: $('senderNumber').value.trim() }) });
      feedback('Número secundário salvo. Ainda não há integração para envio automático.');
      await refresh();
    } catch (error) { feedback(error.message, true); }
  });
  $('groupName').addEventListener('input', () => {
    if ($('groupOrigin').dataset.manual === 'true') return;
    const slug = $('groupName').value.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
    $('groupOrigin').value = /^[a-z]/.test(slug) ? slug : 'grupo-' + slug.slice(0, 26);
  });
  $('groupOrigin').addEventListener('input', () => {
    $('groupOrigin').dataset.manual = 'true';
    $('groupOrigin').value = $('groupOrigin').value.toLowerCase();
  });
  $('groupForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const salvar = $('saveGroup');
    salvar.disabled = true;
    salvar.textContent = 'Salvando…';
    try {
      await request('/api/admin/grupos', {
        method: 'POST',
        body: JSON.stringify({
          nome: $('groupName').value.trim(),
          link: $('groupLink').value.trim(),
          origem: $('groupOrigin').value.trim().toLowerCase(),
          permissaoDivulgacao: $('groupPermission').checked,
        }),
      });
      $('groupForm').reset();
      delete $('groupOrigin').dataset.manual;
      feedback('Grupo registrado. Abra o link no WhatsApp ou escolha a origem para analisar interessados.');
      await refresh();
    } catch (error) { feedback(error.message, true); }
    finally {
      salvar.disabled = false;
      salvar.textContent = 'Adicionar grupo';
    }
  });

  document.querySelectorAll('.quick-nav a').forEach((link) => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.quick-nav a').forEach(a => a.removeAttribute('aria-current'));
      link.setAttribute('aria-current', 'page');
    });
  });

  $('searchContacts').addEventListener('input', renderContacts);
  $('filterContacts').addEventListener('change', renderContacts);
  $('groupContactsFilter').addEventListener('change', renderContacts);
  $('campaignSlug').addEventListener('input', updateCampaign);
  $('copyUrl').addEventListener('click', async () => {
    const link = updateCampaign();
    if (!link) return;
    try { await navigator.clipboard.writeText(link); feedback('Link copiado.'); }
    catch { feedback('Seu navegador não permitiu copiar. Selecione e copie o link manualmente.', true); }
  });
  $('copyInvite').addEventListener('click', async () => {
    const bloqueado = $('copyInvite').disabled;
    const link = updateCampaign();
    if (!link || bloqueado) {
      feedback('Confirme a permissão do grupo e publique a página em HTTPS antes de divulgar convites.', true);
      return;
    }
    const message = '👑 Olá! Com autorização do administrador, compartilho o Caça Promos VIP, um grupo gratuito de ofertas da Amazon e do Mercado Livre. Se tiver interesse, veja as informações e participe voluntariamente: ' + link + ' — A gente caça. Você economiza!';
    try { await navigator.clipboard.writeText(message); feedback('Mensagem de parceria copiada. Divulgue apenas com autorização.'); }
    catch { feedback('Não foi possível copiar automaticamente.', true); }
  });
  $('confirmCancel').addEventListener('click', () => $('confirmDialog').close());
  $('confirmSave').addEventListener('click', async () => {
    if (!$('verifiedCheckbox').checked) {
      alert('Antes de confirmar, verifique a mensagem recebida no segundo WhatsApp.');
      return;
    }
    try {
      await request('/api/admin/confirmar', { method: 'POST', body: JSON.stringify({
        id: $('confirmDialog').dataset.id,
        codigo: $('receivedCode').value,
        evidencia: 'mensagem-recebida',
      }) });
      $('confirmDialog').close();
      feedback('Autorização confirmada e registrada.');
      await refresh();
    } catch (error) { alert(error.message); }
  });
  $('messageClose').addEventListener('click', () => $('messageDialog').close());
  $('copyMessage').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('messageText').value); feedback('Mensagem copiada. Confira o número remetente antes de usar.'); }
    catch { feedback('Copie manualmente a mensagem.', true); }
  });
  $('markSent').addEventListener('click', async () => {
    if (!state.prepared) return;
    if (!confirm('Você realmente enviou esta mensagem pelo segundo WhatsApp?')) return;
    try {
      await request('/api/admin/registrar-envio', { method: 'POST', body: JSON.stringify({ id: state.prepared.id }) });
      $('messageDialog').close();
      feedback('Envio manual informado no histórico. Nenhuma mensagem foi enviada pelo sistema.');
      await refresh();
    } catch (error) { feedback(error.message, true); }
  });

  updateCampaign();
  refresh().then(showApp).catch(showLogin);
})();
