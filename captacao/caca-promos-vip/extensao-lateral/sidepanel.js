'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const contatos = new Map();
  let exemplo = false;

  const mascarar = telefone => {
    const digitos = telefone.replace(/\D/g, '');
    return '+' + digitos.slice(0, Math.max(2, digitos.length - 8)) +
      ' •••• ' + digitos.slice(-4);
  };

  function status(mensagem, tipo = 'ok') {
    $('statusText').textContent = mensagem;
    $('statusDot').className = 'dot' +
      (tipo === 'error' ? ' error' : tipo === 'warning' ? ' warning' : '');
  }

  function limpar(mensagem = 'Aguardando texto copiado pelo operador.') {
    contatos.clear();
    exemplo = false;
    $('resultPanel').hidden = true;
    $('resultItems').replaceChildren();
    $('export').disabled = true;
    status(mensagem);
  }

  function mostrar(quantidade, lista, nota) {
    $('resultPanel').hidden = false;
    $('count').textContent = String(quantidade);
    $('resultNote').textContent = nota;
    $('resultItems').replaceChildren();
    for (const contato of lista.slice(0, 25)) {
      const li = document.createElement('li');
      li.textContent = (contato.nome ? contato.nome + '  ·  ' : '') +
        mascarar(contato.telefone);
      $('resultItems').append(li);
    }
  }

  function autorizacaoConfirmada() {
    if ($('consent').checked) return true;
    status('Confirme a autorização individual antes de importar qualquer número.', 'warning');
    $('consent').focus();
    return false;
  }

  function importarTexto(texto, origem) {
    if (!autorizacaoConfirmada()) return;
    if (!texto || !texto.trim()) {
      status('Não encontrei texto copiado. Selecione e copie a lista primeiro.', 'warning');
      return;
    }
    const leitor = globalThis.CPVVisibleExtraction;
    const revisao = leitor.analisarDetalhado(texto);
    if (!revisao.contatos.length) {
      status('Nenhum telefone válido encontrado. Confira o texto selecionado.', 'warning');
      return;
    }
    if (exemplo) limpar();
    let novos = 0;
    let jaExistiam = 0;
    for (const contato of revisao.contatos) {
      const anterior = contatos.get(contato.telefone);
      if (anterior) {
        jaExistiam++;
        if (!anterior.nome && contato.nome) anterior.nome = contato.nome;
      } else {
        contatos.set(contato.telefone, { ...contato });
        novos++;
      }
    }
    exemplo = false;
    const registros = [...contatos.values()];
    $('export').disabled = !registros.length;
    mostrar(registros.length, registros,
      novos + ' novo(s) nesta importação · ' +
      (jaExistiam + revisao.repetidos) + ' repetido(s) · ' +
      revisao.invalidos + ' linha(s) ignorada(s). ' +
      'Prévia mascarada; dados mantidos somente nesta lateral.');
    status(registros.length + ' contato(s) na lista. ' + novos +
      ' acrescentado(s) via ' + origem + '. Pronto para exportar.');
  }

  $('clipboard').addEventListener('click', async () => {
    if (!autorizacaoConfirmada()) return;
    const botao = $('clipboard');
    botao.disabled = true;
    status('Lendo apenas o texto que você copiou para a área de transferência...', 'warning');
    try {
      if (!navigator.clipboard?.readText) {
        throw new Error('Leitura da área de transferência indisponível neste navegador.');
      }
      const texto = await navigator.clipboard.readText();
      importarTexto(texto, 'texto copiado');
    } catch (erro) {
      status((erro?.message || 'Falha ao ler texto copiado.') +
        ' Alternativa: cole com Ctrl+V no campo manual.', 'error');
    } finally {
      botao.disabled = false;
    }
  });

  $('start').addEventListener('click', () => {
    try {
      importarTexto($('numbers').value, 'texto colado');
    } catch (erro) {
      status(erro?.message || 'Não foi possível analisar a lista.', 'error');
    }
  });

  $('demo').addEventListener('click', () => {
    limpar();
    exemplo = true;
    mostrar(3, [
      { nome: 'Pessoa Exemplo A', telefone: '+5511988881234' },
      { nome: 'Pessoa Exemplo B', telefone: '+5521999995678' },
      { nome: 'Pessoa Exemplo C', telefone: '+5531988889012' },
    ], 'Demonstração fictícia. Nenhum contato foi importado.');
    status('Exemplo exibido. Copie ou cole sua lista autorizada para começar.');
  });

  $('clear').addEventListener('click', () =>
    limpar('Lista limpa. Nenhum contato está armazenado no painel.'));

  $('consent').addEventListener('change', () => {
    if (!$('consent').checked) {
      limpar('Autorização desmarcada. Os registros foram descartados.');
    }
  });

  $('group').addEventListener('change', () => {
    if (contatos.size) {
      limpar('Grupo alterado. Cole novamente os contatos da origem correta.');
    }
  });

  function csvSeguro(valor) {
    let texto = String(valor || '')
      .replace(/[\x00-\x1f]/g, ' ').trim().slice(0, 80);
    if (/^\s*[=+@-]/.test(texto)) texto = "'" + texto;
    return '"' + texto.replace(/"/g, '""') + '"';
  }

  function arquivoNome() {
    const grupo = $('group').value.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 48);
    return 'cpv-contatos-' + (grupo || 'autorizados') + '.csv';
  }

  $('export').addEventListener('click', () => {
    if (!contatos.size || exemplo || !autorizacaoConfirmada()) return;
    // Apenas um campo de telefone validado: digitos puros no Brasil para
    // evitar interpretacao como formula de planilha. A Central escolhe a origem.
    const linhas = ['nome;telefone'];
    for (const contato of contatos.values()) {
      const numero = /^\+55\d{10,11}$/.test(contato.telefone)
        ? contato.telefone.slice(1) : contato.telefone;
      // Telefone vem exclusivamente do normalizador (+ e digitos), sem texto arbitrario.
      linhas.push(csvSeguro(contato.nome) + ';"' + numero + '"');
    }
    const blob = new Blob(['\ufeff' + linhas.join('\r\n') + '\r\n'],
      { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = arquivoNome();
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    status('CSV exportado localmente com ' + contatos.size +
      ' contato(s). Escolha o grupo e registre a autorização na Central.');
  });

  $('close').addEventListener('click', async () => {
    try {
      if (chrome?.sidePanel?.close && chrome?.tabs?.query) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) await chrome.sidePanel.close({ tabId: tab.id });
        else window.close();
      } else window.close();
    } catch { window.close(); }
  });
})();
