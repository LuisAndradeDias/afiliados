(() => {
  const painel = document.getElementById('importCard');
  if (!painel) return;
  const $ = id => document.getElementById(id);
  let registros = [];
  let grupos = [];
  let grupoPreferido = '';
  let previaChave = '';
  function chaveAtual() {
    return $('importGroup').value + '\n' + $('importList').value;
  }
  function invalidarPrevia() {
    previaChave = '';
    $('importSave').disabled = true;
    $('importPreviewResult').hidden = true;
    $('importPreviewResult').replaceChildren();
    $('importPreviewResult').classList.remove('error');
  }

  async function api(url, method = 'GET', dados = null) {
    const resposta = await fetch(url, {
      method,
      credentials: 'same-origin',
      ...(method === 'POST' ? {
        headers: { 'content-type': 'application/json', 'x-cpv-admin': '1' },
        body: JSON.stringify(dados),
      } : {}),
    });
    let corpo;
    try { corpo = await resposta.json(); }
    catch { corpo = {}; }
    if (!resposta.ok || corpo.ok === false) {
      throw new Error(corpo.mensagem || `Não foi possível concluir a operação (${resposta.status}).`);
    }
    return corpo;
  }
  function aviso(mensagem, erro = false) {
    const elemento = $('importNotice');
    elemento.textContent = mensagem;
    elemento.classList.toggle('error', erro);
    elemento.hidden = false;
  }
  function td(valor) {
    const celula = document.createElement('td');
    celula.textContent = valor || '';
    return celula;
  }
  function atualizarExportacao() {
    const id = $('importGroup').value;
    const grupo = grupos.find(g => g.id === id);
    const filtro = grupo ? '?origem=' + encodeURIComponent(grupo.origem) : '';
    $('importExport').href = '/api/admin/importados.csv' + filtro;
    $('importExport').download = grupo ? `participantes-${grupo.origem}.csv` : 'participantes-importados.csv';
    const abrir = $('importOpenGroup');
    abrir.hidden = true;
    abrir.removeAttribute('href');
    if (grupo) {
      try {
        const url = new URL(grupo.link);
        if (url.protocol === 'https:' && url.hostname === 'chat.whatsapp.com' &&
            !url.username && !url.password && !url.search && !url.hash) {
          abrir.href = url.toString();
          abrir.hidden = false;
        }
      } catch { /* Links inválidos não são abertos. */ }
    }
    const totalGrupo = grupo ? registros.filter(c => c.origens.includes(grupo.origem)).length : 0;
    $('importGroupCount').textContent = grupo
      ? `${totalGrupo} registro(s) já associados a este grupo.`
      : 'Escolha um grupo para continuar.';
  }
  function renderizar() {
    $('importTotal').textContent = `${registros.length} número(s) organizado(s)`;
    const corpo = $('importBody');
    corpo.replaceChildren();
    const grupo = grupos.find(g => g.id === $('importGroup').value);
    const visiveis = grupo ? registros.filter(c => c.origens.includes(grupo.origem)) : registros;
    if (!visiveis.length) {
      const linha = document.createElement('tr');
      const celula = td('Nenhum número importado. Abra esta seção para adicionar uma lista autorizada.');
      celula.colSpan = 4;
      linha.append(celula);
      corpo.append(linha);
      return;
    }
    for (const contato of visiveis.slice(0, 80)) {
      const linha = document.createElement('tr');
      linha.append(td(contato.nome || 'Sem nome'), td('+' + contato.telefone), td(contato.origens.join(', ')));
      const acoes = document.createElement('td');
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'danger sm';
      botao.textContent = 'Excluir';
      botao.addEventListener('click', async () => {
        if (!confirm('Excluir este número importado e todas as origens vinculadas?')) return;
        try {
          await api('/api/admin/importados/excluir', 'POST', { id: contato.id });
          aviso('Registro excluído da base importada.');
          await carregar();
        } catch (erro) { aviso(erro.message, true); }
      });
      acoes.append(botao);
      linha.append(acoes);
      corpo.append(linha);
    }
    $('importShowing').textContent = visiveis.length > 80 ? 'Exibindo 80 registros deste filtro. Use Exportar CSV para a lista completa.' : '';
  }
  async function carregar() {
    const [respGrupos, respRegistros] = await Promise.all([
      api('/api/admin/grupos'), api('/api/admin/importados'),
    ]);
    grupos = respGrupos.grupos || [];
    registros = respRegistros.contatos || [];
    const seletor = $('importGroup');
    const atual = grupoPreferido || seletor.value;
    seletor.replaceChildren();
    const vazio = document.createElement('option');
    vazio.value = '';
    vazio.textContent = 'Selecione um grupo cadastrado';
    seletor.append(vazio);
    for (const grupo of grupos) {
      const opcao = document.createElement('option');
      opcao.value = grupo.id;
      opcao.textContent = `${grupo.nome} (${grupo.origem})`;
      seletor.append(opcao);
    }
    if (grupos.some(g => g.id === atual)) seletor.value = atual;
    $('importPreview').disabled = !grupos.length;
    $('importSave').disabled = !previaChave || previaChave !== chaveAtual();
    atualizarExportacao();
    renderizar();
  }
  painel.addEventListener('toggle', () => {
    if (painel.open) carregar().catch(erro => aviso(erro.message, true));
  });
  document.querySelectorAll('a[href="#importCard"]').forEach(link => {
    link.addEventListener('click', () => { painel.open = true; });
  });
  window.addEventListener('cpv-select-group', evento => {
    const id = evento.detail?.id;
    if (typeof id !== 'string') return;
    grupoPreferido = id;
    invalidarPrevia();
    painel.open = true;
    carregar().catch(erro => aviso(erro.message, true));
  });
  $('importGroup').addEventListener('change', () => {
    grupoPreferido = '';
    invalidarPrevia();
    atualizarExportacao();
    renderizar();
  });
  $('importList').addEventListener('input', invalidarPrevia);
  $('importFile').addEventListener('change', async evento => {
    const arquivo = evento.target.files?.[0];
    invalidarPrevia();
    if (!arquivo) return;
    if (arquivo.size > 110_000) { aviso('O arquivo deve ter até 110 KB.', true); return; }
    try {
      $('importList').value = await arquivo.text();
      invalidarPrevia();
      aviso(`Arquivo ${arquivo.name} carregado localmente. Confira o grupo e a autorização antes de importar.`);
    } catch { aviso('Não foi possível ler o arquivo selecionado.', true); }
  });
  $('importPreview').addEventListener('click', async () => {
    const botao = $('importPreview');
    const chaveSolicitada = chaveAtual();
    botao.disabled = true;
    botao.textContent = 'Conferindo...';
    invalidarPrevia();
    try {
      const resposta = await api('/api/admin/importados/previa', 'POST', {
        grupoId: $('importGroup').value,
        lista: $('importList').value,
      });
      if (chaveSolicitada !== chaveAtual()) {
        aviso('A lista mudou durante a conferência. Verifique novamente.', true);
        return;
      }
      const resultado = resposta.previa;
      previaChave = chaveSolicitada;
      const caixa = $('importPreviewResult');
      const detalhe = resultado.invalidos
        ? ' Linhas sem número válido: ' + resultado.linhasInvalidas.join(', ') +
          (resultado.invalidos > resultado.linhasInvalidas.length ? ' e outras.' : '.')
        : '';
      caixa.textContent = 'Prévia (sem salvar): ' + resultado.novos + ' novos, ' +
        resultado.repetidos + ' repetidos, ' + resultado.invalidos + ' inválidos.' +
        detalhe + ' Confira a autorização antes de confirmar. Nenhuma mensagem será enviada.';
      caixa.hidden = false;
      $('importSave').disabled = false;
    } catch (erro) {
      const caixa = $('importPreviewResult');
      caixa.textContent = erro.message;
      caixa.classList.add('error');
      caixa.hidden = false;
    } finally {
      botao.disabled = !grupos.length;
      botao.textContent = 'Conferir números antes de salvar';
    }
  });
  $('importForm').addEventListener('submit', async evento => {
    evento.preventDefault();
    if (!previaChave || previaChave !== chaveAtual()) {
      aviso('Confira primeiro a prévia atualizada desta lista.', true);
      return;
    }
    const botao = $('importSave');
    botao.disabled = true;
    botao.textContent = 'Importando…';
    try {
      const resultado = await api('/api/admin/importados', 'POST', {
        grupoId: $('importGroup').value,
        lista: $('importList').value,
        referenciaPermissao: $('importEvidence').value.trim(),
        autorizacaoColeta: $('importConsent').checked,
      });
      aviso(`${resultado.resultado.novos} novo(s), ${resultado.resultado.repetidos} repetido(s), ${resultado.resultado.invalidos} inválido(s). Nenhum envio foi realizado.`);
      $('importList').value = '';
      $('importFile').value = '';
      $('importConsent').checked = false;
      invalidarPrevia();
      await carregar();
    } catch (erro) { aviso(erro.message, true); }
    finally { botao.disabled = !previaChave || previaChave !== chaveAtual(); botao.textContent = 'Confirmar importação'; }
  });
})();
