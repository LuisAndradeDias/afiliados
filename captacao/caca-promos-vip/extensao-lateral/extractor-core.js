'use strict';
(() => {
  // Processa somente texto entregue pelo operador ao painel lateral.
  // Nao le dados do WhatsApp, conversas, DOM de outras abas ou paginas.
  const intl = /\+\s*[1-9](?:[ \t().\/-]*\d){7,14}/g;
  const br = /(?<!\d)\(?[1-9]\d\)?[ .-]*\d{4,5}[ .-]*\d{4}(?!\d)/g;
  const cabecalho = /^\s*["']?(nome|telefone|n[uú]mero|whatsapp)\s*[;,\t]/i;
  const desconsiderar = /^(pesquisar membros|pesquisar contatos|membros|participantes|dados do grupo|todos|contatos)$/i;

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

  function nomeLimpo(valor) {
    const texto = String(valor || '')
      .replace(/[\x00-\x1f<>]/g, ' ')
      .replace(/^\s*[~*•:,;-]+/, '')
      .replace(/\s+/g, ' ').trim().slice(0, 80);
    if (texto.length < 2 || desconsiderar.test(texto) || !/[A-Za-zÀ-ÿ]/.test(texto)) return '';
    return texto;
  }

  function nomeDaLinha(linha) {
    intl.lastIndex = 0;
    br.lastIndex = 0;
    return nomeLimpo(String(linha).replace(intl, ' ').replace(br, ' ')
      .replace(/[;"']/g, ' '));
  }

  function analisarDetalhado(valor) {
    const texto = String(valor || '');
    if (new TextEncoder().encode(texto).byteLength > 110000) {
      throw new Error('O limite é de 110 KB por revisão.');
    }
    const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (linhas.length > 1500) throw new Error('O limite é de 1.500 linhas.');
    const index = new Map();
    let repetidos = 0;
    let invalidos = 0;
    let cabecalhos = 0;
    let nomesAssociados = 0;
    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      if (cabecalho.test(linha) || desconsiderar.test(linha)) {
        cabecalhos++;
        continue;
      }
      const telefones = numerosDoTexto(linha);
      if (!telefones.length) {
        // Uma lista copiada pode apresentar nome e telefone em linhas diferentes.
        // So associa o nome quando a linha seguinte contem um telefone valido.
        if (nomeLimpo(linha) && i + 1 < linhas.length &&
            numerosDoTexto(linhas[i + 1]).length === 1) {
          continue;
        }
        invalidos++;
        continue;
      }
      const anterior = i > 0 && !numerosDoTexto(linhas[i - 1]).length &&
        !cabecalho.test(linhas[i - 1]) && !desconsiderar.test(linhas[i - 1])
        ? nomeLimpo(linhas[i - 1]) : '';
      const nome = telefones.length === 1
        ? nomeDaLinha(linha) || anterior : '';
      for (const telefone of telefones) {
        const existente = index.get(telefone);
        if (existente) {
          repetidos++;
          if (!existente.nome && nome) {
            existente.nome = nome;
            nomesAssociados++;
          }
        } else {
          index.set(telefone, { nome, telefone });
          if (nome) nomesAssociados++;
        }
      }
    }
    const contatos = [...index.values()];
    return {
      contatos,
      phones: contatos.map(contato => contato.telefone),
      novos: contatos.length, repetidos, invalidos, cabecalhos,
      nomesAssociados,
    };
  }

  function analisarLista(texto) {
    const r = analisarDetalhado(texto);
    return { phones: r.phones, novos: r.novos, repetidos: r.repetidos,
      invalidos: r.invalidos, cabecalhos: r.cabecalhos };
  }

  globalThis.CPVVisibleExtraction = {
    normalizar, numerosDoTexto, nomeLimpo, analisarLista, analisarDetalhado,
  };
})();
