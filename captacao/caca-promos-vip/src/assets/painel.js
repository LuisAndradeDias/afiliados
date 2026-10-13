(() => {
  const $ = (id) => document.getElementById(id);
  const state = { contacts: [], metrics: {}, summary: {}, prepared: null };

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
  function feedback(message, error = false) {
    const box = $('appFeedback');
    box.textContent = message;
    box.classList.toggle('error', error);
    box.hidden = false;
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
    const visible = state.contacts.filter(c => {
      if (filter !== 'todos' && c.status !== filter) return false;
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
  function updateCampaign() {
    const slug = $('campaignSlug').value.trim().toLowerCase();
    const valid = /^[a-z][a-z0-9-]{0,31}$/.test(slug);
    const base = new URL(location.href);
    const link = valid ? base.origin + '/c/' + slug : '';
    $('campaignLink').textContent = valid ? link : 'Identificador inválido: use letras minúsculas, números e hífens.';
    $('copyInvite').disabled = !valid;
    $('copyUrl').disabled = !valid;
    const local = /^(localhost|127\.0\.0\.1)$/i.test(base.hostname);
    $('campaignLink').classList.toggle('local', local);
    $('publicWarning').textContent = local
      ? '⚠ Esta URL funciona somente no computador local. Publique com HTTPS antes de compartilhá-la nos grupos.'
      : 'Só compartilhe em comunidades onde o administrador permitiu divulgar convites.';
    return link;
  }

  async function refresh() {
    const [overview, contacts] = await Promise.all([
      request('/api/admin/resumo'), request('/api/admin/contatos')
    ]);
    state.contacts = contacts.contatos;
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
    renderContacts();
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
  $('searchContacts').addEventListener('input', renderContacts);
  $('filterContacts').addEventListener('change', renderContacts);
  $('campaignSlug').addEventListener('input', updateCampaign);
  $('copyUrl').addEventListener('click', async () => {
    const link = updateCampaign();
    if (!link) return;
    try { await navigator.clipboard.writeText(link); feedback('Link copiado.'); }
    catch { feedback('Seu navegador não permitiu copiar. Selecione e copie o link manualmente.', true); }
  });
  $('copyInvite').addEventListener('click', async () => {
    const link = updateCampaign();
    if (!link) return;
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
