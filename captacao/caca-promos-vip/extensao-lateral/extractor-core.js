'use strict';
(() => {
  // Processamento de texto fornecido voluntariamente pelo operador.
  // Não lê a página do WhatsApp, o DOM, as conversas ou o histórico.
  const intl = /\+\s*[1-9](?:[ \t().-]*\d){7,14}/g;
  const br = /(?<!\d)\(?[1-9]\d\)?[ .-]*\d{4,5}[ .-]*\d{4}(?!\d)/g;
  function normalizar(valor) {
    const texto = String(valor).trim();
    const digitos = texto.replace(/\D/g, '');
    if (texto.startsWith('+')) {
      if (!/^[1-9]\d{7,14}$/.test(digitos)) return null;
      if (digitos.startsWith('55') && !/^55[1-9]\d\d{8,9}$/.test(digitos)) return null;
      return '+' + digitos;
    }
    return /^[1-9]\d\d{8,9}$/.test(digitos) ? '+55' + digitos : null;
  }
  function numerosDoTexto(texto) {
    const encontrados = new Set();
    for (const regex of [intl, br]) {
      regex.lastIndex = 0;
      for (const item of String(texto).matchAll(regex)) {
        const numero = normalizar(item[0]);
        if (numero) encontrados.add(numero);
      }
    }
    return [...encontrados];
  }
  function analisarLista(valor) {
    const texto = String(valor || '');
    if (new TextEncoder().encode(texto).byteLength > 110000) {
      throw new Error('O limite é de 110 KB por revisão.');
    }
    const linhas = texto.split(/\r?\n/).filter(linha => linha.trim());
    if (linhas.length > 1500) throw new Error('O limite é de 1.500 linhas.');
    const telefones = new Set();
    let repetidos = 0, invalidos = 0, cabecalhos = 0;
    for (const linha of linhas) {
      if (/^\s*["']?(nome|telefone|whatsapp)\s*[;,\t]/i.test(linha)) {
        cabecalhos++;
        continue;
      }
      const candidatos = numerosDoTexto(linha);
      if (!candidatos.length) invalidos++;
      for (const numero of candidatos) {
        if (telefones.has(numero)) repetidos++;
        telefones.add(numero);
      }
    }
    return {
      phones: [...telefones],
      novos: telefones.size,
      repetidos,
      invalidos,
      cabecalhos,
    };
  }
  globalThis.CPVVisibleExtraction = { normalizar, numerosDoTexto, analisarLista };
})();
