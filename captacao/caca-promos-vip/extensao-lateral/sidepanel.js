'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const contatos = new Map();
  const leitor = globalThis.CPVScreenReader;
  let selecao = null;
  let inicio = null;
  let lendo = false;
  let capturaOrigem = null;

  function status(mensagem, tipo = 'ok') {
    $('statusText').textContent = mensagem;
    $('statusDot').className = 'dot' +
      (tipo === 'warning' ? ' warning' : tipo === 'error' ? ' error' : '');
  }

  function autorizado() {
    if ($('consent').checked) return true;
    status('Confirme que pode processar o texto mostrado na imagem.', 'warning');
    $('consent').focus();
    return false;
  }

  function limparSelecao() {
    selecao = null;
    $('selection').hidden = true;
    $('read').disabled = true;
  }

  function mostrarImagem(url, origem) {
    limparSelecao();
    const img = $('screenshot');
    img.onload = () => {
      $('previewPanel').hidden = false;
      status('Imagem pronta. Arraste sobre o trecho que deseja reconhecer.');
    };
    img.onerror = () => {
      $('previewPanel').hidden = true;
      status('Não foi possível abrir esta imagem.', 'error');
    };
    capturaOrigem = origem;
    img.src = url;
  }

  $('capture').addEventListener('click', async () => {
    if (!autorizado()) return;
    $('capture').disabled = true;
    status('Capturando somente a aba visível...', 'warning');
    try {
      if (!chrome?.tabs?.captureVisibleTab) {
        throw new Error('Captura indisponível nesta página. Use a opção de imagem.');
      }
      const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!aba?.id) throw new Error('Nenhuma aba ativa foi encontrada.');
      const url = await chrome.tabs.captureVisibleTab(aba.windowId, { format: 'png' });
      if (!url?.startsWith('data:image/png;base64,')) {
        throw new Error('O Chrome não retornou uma imagem da aba.');
      }
      mostrarImagem(url, 'aba visível');
    } catch (erro) {
      status((erro?.message || 'Falha na captura.') +
        ' Abra o site, clique no ícone da extensão e tente novamente, ou selecione uma imagem.', 'error');
    } finally {
      $('capture').disabled = false;
    }
  });

  $('imageFile').addEventListener('change', async () => {
    const file = $('imageFile').files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > 12 * 1024 * 1024) {
      status('Escolha uma imagem PNG, JPG ou WebP de até 12 MB.', 'error');
      return;
    }
    if (!autorizado()) return;
    const reader = new FileReader();
    reader.onload = () => mostrarImagem(String(reader.result), 'imagem escolhida');
    reader.onerror = () => status('Não foi possível abrir o arquivo local.', 'error');
    reader.readAsDataURL(file);
  });

  const painel = $('preview');
  const posicao = evento => {
    const rect = $('screenshot').getBoundingClientRect();
    return {
      x: Math.min(rect.width, Math.max(0, evento.clientX - rect.left)),
      y: Math.min(rect.height, Math.max(0, evento.clientY - rect.top)),
    };
  };

  function desenhar() {
    if (!selecao) return;
    const box = $('selection');
    box.hidden = false;
    box.style.left = selecao.left + 'px';
    box.style.top = selecao.top + 'px';
    box.style.width = selecao.width + 'px';
    box.style.height = selecao.height + 'px';
    $('read').disabled = selecao.width < 18 || selecao.height < 18;
  }

  painel.addEventListener('pointerdown', evento => {
    if (!$('screenshot').complete || !$('screenshot').naturalWidth) return;
    evento.preventDefault();
    inicio = posicao(evento);
    selecao = { left: inicio.x, top: inicio.y, width: 0, height: 0 };
    painel.setPointerCapture?.(evento.pointerId);
    desenhar();
  });
  painel.addEventListener('pointermove', evento => {
    if (!inicio) return;
    const at = posicao(evento);
    const img = $('screenshot');
    selecao = leitor.normalizarSelecao(inicio.x, inicio.y, at.x, at.y,
      img.getBoundingClientRect().width, img.getBoundingClientRect().height);
    desenhar();
  });
  painel.addEventListener('pointerup', () => {
    inicio = null;
    desenhar();
  });
  painel.addEventListener('pointercancel', () => { inicio = null; });

  $('read').addEventListener('click', async () => {
    if (!autorizado() || !selecao || lendo) return;
    lendo = true;
    $('read').disabled = true;
    status('Reconhecendo o texto na imagem, localmente...', 'warning');
    try {
      const img = $('screenshot');
      const rect = img.getBoundingClientRect();
      const { texto, confianca } = await leitor.reconhecer(
        img, selecao, rect.width, rect.height,
        (etapa, percentual) => {
          if (etapa) status('OCR: ' + etapa + ' (' + percentual + '%)', 'warning');
        });
      if (!texto) {
        status('Nenhum texto encontrado. Tente outra seleção ou uma imagem mais nítida.', 'warning');
        return;
      }
      const atual = $('recognized').value.trim();
      const junto = [atual, texto].filter(Boolean).join('\n');
      $('recognized').value = junto.slice(0, 30000);
      status('Texto reconhecido (' + Math.round(confianca) +
        '% de confiança aproximada). Confira antes de usar os números.');
      // Descartar a captura integral assim que o resultado estiver disponível.
      img.removeAttribute('src');
      $('previewPanel').hidden = true;
      capturaOrigem = null;
      limparSelecao();
      $('recognized').focus();
    } catch (erro) {
      status((erro?.message || 'Falha no OCR.') +
        ' Experimente selecionar outra região ou carregar uma imagem.', 'error');
    } finally {
      lendo = false;
      $('read').disabled = !selecao;
    }
  });

  $('copyText').addEventListener('click', async () => {
    const texto = $('recognized').value;
    if (!texto.trim()) { status('Ainda não há texto para copiar.', 'warning'); return; }
    try {
      await navigator.clipboard.writeText(texto);
      status('Texto reconhecido copiado para a área de transferência.');
    } catch {
      $('recognized').focus();
      $('recognized').select();
      status('O Chrome não permitiu copiar automaticamente. Pressione Ctrl+C.', 'warning');
    }
  });

  function mascara(numero) {
    const dig = numero.replace(/\D/g, '');
    return '+' + dig.slice(0, Math.max(2, dig.length - 8)) + ' •••• ' + dig.slice(-4);
  }

  function atualizarLista(novos = 0, duplicados = 0) {
    $('count').textContent = String(contatos.size);
    $('resultItems').replaceChildren();
    for (const contato of [...contatos.values()].slice(0, 30)) {
      const el = document.createElement('li');
      el.textContent = (contato.nome ? contato.nome + ' · ' : '') +
        mascara(contato.telefone);
      $('resultItems').append(el);
    }
    $('resultNote').textContent = novos + ' novo(s), ' + duplicados +
      ' repetido(s) nesta análise. Confira nomes e telefones antes de exportar.';
    $('export').disabled = !contatos.size;
  }

  $('analyze').addEventListener('click', () => {
    if (!autorizado()) return;
    const texto = $('recognized').value.trim();
    if (!texto) { status('Ainda não há texto para organizar.', 'warning'); return; }
    try {
      const r = globalThis.CPVVisibleExtraction.analisarDetalhado(texto);
      let novos = 0, repetidos = r.repetidos;
      for (const contato of r.contatos) {
        const anterior = contatos.get(contato.telefone);
        if (anterior) {
          repetidos++;
          if (!anterior.nome && contato.nome) anterior.nome = contato.nome;
        } else {
          contatos.set(contato.telefone, { ...contato });
          novos++;
        }
      }
      atualizarLista(novos, repetidos);
      document.querySelector('.extra').open = true;
      status(contatos.size + ' contato(s) organizados localmente. Reveja antes do CSV.');
    } catch (erro) { status(erro?.message || 'Falha ao analisar texto.', 'error'); }
  });

  $('clear').addEventListener('click', () => {
    contatos.clear();
    atualizarLista();
    status('Lista de contatos limpa. O texto reconhecido continua editável.');
  });

  function csvSeguro(valor) {
    let v = String(valor || '').replace(/[\x00-\x1f]/g, ' ').trim().slice(0, 80);
    if (/^[=+@-]/.test(v)) v = "'" + v;
    return '"' + v.replace(/"/g, '""') + '"';
  }

  $('export').addEventListener('click', () => {
    if (!autorizado() || !contatos.size) return;
    const linhas = ['nome;telefone'];
    for (const contato of contatos.values()) {
      const numero = /^\+55\d{10,11}$/.test(contato.telefone)
        ? contato.telefone.slice(1) : contato.telefone;
      linhas.push(csvSeguro(contato.nome) + ';"' + numero + '"');
    }
    const blob = new Blob(['\ufeff' + linhas.join('\r\n') + '\r\n'],
      {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const group = $('group').value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 45);
    anchor.download = 'cpv-contatos-' + (group || 'autorizados') + '.csv';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    status('CSV local exportado. Revise os registros e selecione a origem na Central.');
  });

  $('consent').addEventListener('change', () => {
    if ($('consent').checked) return;
    contatos.clear();
    atualizarLista();
    $('recognized').value = '';
    $('screenshot').removeAttribute('src');
    $('previewPanel').hidden = true;
    limparSelecao();
    status('Autorização desmarcada: texto e resultados descartados.');
  });

  $('close').addEventListener('click', () => {
    leitor.liberar();
    $('screenshot').removeAttribute('src');
    $('recognized').value = '';
    contatos.clear();
    try { window.close(); } catch { /* Chrome controla o fechamento. */ }
  });

  window.addEventListener('beforeunload', () => { leitor.liberar(); });
})();
