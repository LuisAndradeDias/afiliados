'use strict';
(() => {
  const $ = id => document.getElementById(id);
  let resultado = [];
  let exemplo = false;
  const formatar = numero => {
    const digitos = numero.replace(/\D/g, '');
    return '+' + digitos.slice(0, Math.max(2, digitos.length - 8)) +
      ' •••• ' + digitos.slice(-4);
  };
  function status(mensagem, tipo = 'ok') {
    $('statusText').textContent = mensagem;
    $('statusDot').className = 'dot' +
      (tipo === 'error' ? ' error' : tipo === 'warning' ? ' warning' : '');
  }
  function limpar(mensagem = 'Aguardando números copiados') {
    resultado = [];
    exemplo = false;
    $('resultPanel').hidden = true;
    $('resultItems').replaceChildren();
    $('export').disabled = true;
    status(mensagem);
  }
  function mostrar(total, itens, nota) {
    $('resultPanel').hidden = false;
    $('count').textContent = String(total);
    $('resultNote').textContent = nota;
    $('resultItems').replaceChildren();
    for (const numero of itens.slice(0, 15)) {
      const li = document.createElement('li');
      li.textContent = numero;
      $('resultItems').append(li);
    }
  }
  $('start').addEventListener('click', () => {
    if (!$('consent').checked) {
      status('Confirme a autorização individual antes de conferir a lista.', 'warning');
      $('consent').focus();
      return;
    }
    if (!$('numbers').value.trim()) {
      status('Cole na caixa os números visíveis que foram autorizados.', 'warning');
      $('numbers').focus();
      return;
    }
    try {
      const revisao = globalThis.CPVVisibleExtraction.analisarLista($('numbers').value);
      resultado = revisao.phones;
      exemplo = false;
      $('export').disabled = resultado.length === 0;
      mostrar(resultado.length, resultado.map(formatar),
        revisao.repetidos + ' repetido(s) e ' + revisao.invalidos +
        ' linha(s) sem telefone válido. Nenhum dado saiu deste navegador.');
      status(resultado.length
        ? resultado.length + ' número(s) revisado(s). CSV pronto para exportação.'
        : 'Nenhum número válido encontrado no texto colado.',
        resultado.length ? 'ok' : 'warning');
    } catch (erro) {
      limpar();
      status(erro?.message || 'Não foi possível conferir a lista.', 'error');
    }
  });
  $('numbers').addEventListener('input', () => {
    if (resultado.length || exemplo) limpar('Lista alterada. Confira novamente antes de exportar.');
  });
  $('consent').addEventListener('change', () => {
    if (!$('consent').checked) limpar('Autorização desmarcada. Os resultados foram descartados.');
  });
  $('demo').addEventListener('click', () => {
    limpar();
    exemplo = true;
    mostrar(3, ['+55 11 •••• 1234', '+55 21 •••• 5678', '+55 31 •••• 9012'],
      'Exemplo com números fictícios. Não foi gerado um arquivo.');
    status('Exemplo exibido. Cole seus números autorizados para conferir.');
  });
  $('clear').addEventListener('click', () => limpar('Prévia limpa. Nenhum número armazenado.'));
  $('export').addEventListener('click', () => {
    if (!resultado.length || exemplo || !$('consent').checked) return;
    // Telefones já normalizados: a planilha da Central reconhece o prefixo +.
    // Como só há dígitos após o +, não entram fórmulas arbitrárias do usuário.
    const linhas = ['nome;telefone', ...resultado.map(numero => '"";"' + numero + '"')];
    const blob = new Blob(['\ufeff' + linhas.join('\r\n') + '\r\n'],
      { type: 'text/csv;charset=utf-8' });
    const endereco = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = endereco;
    a.download = 'cpv-contatos-autorizados.csv';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(endereco), 1500);
    status('Planilha CSV baixada. Importe-a na Central, vinculando o grupo e as autorizações.');
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
