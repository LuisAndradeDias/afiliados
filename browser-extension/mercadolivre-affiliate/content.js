(() => {
  if (window.__meliAutoLinkLoaded) return;
  window.__meliAutoLinkLoaded = true;

  const POLL_MS = 1600;
  const COUPON_SCAN_MS = 15000;
  let processando = false;
  let jobAtual = "";
  let ultimoScanCupom = 0;

  function normalizar(texto) {
    return (texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function visivel(el) {
    if (!(el instanceof HTMLElement)) return false;
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      box.width > 0 &&
      box.height > 0
    );
  }

  function mostrarStatus(texto, tipo = "info") {
    let box = document.getElementById("afiliados-auto-link-status");
    if (!box) {
      box = document.createElement("div");
      box.id = "afiliados-auto-link-status";
      Object.assign(box.style, {
        position: "fixed",
        right: "18px",
        bottom: "18px",
        zIndex: "2147483647",
        maxWidth: "360px",
        padding: "12px 14px",
        borderRadius: "12px",
        font: "600 13px/1.45 system-ui, sans-serif",
        boxShadow: "0 12px 32px rgba(0,0,0,.22)",
        border: "1px solid rgba(0,0,0,.12)"
      });
      document.documentElement.appendChild(box);
    }

    const cores = {
      info: ["#eff6ff", "#1d4ed8"],
      ok: ["#ecfdf5", "#047857"],
      erro: ["#fff1f2", "#be123c"]
    };
    const [fundo, cor] = cores[tipo] || cores.info;
    box.style.background = fundo;
    box.style.color = cor;
    box.textContent = texto;
  }

  function enviar(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            ok: false,
            mensagem: chrome.runtime.lastError.message
          });
          return;
        }
        resolve(response || { ok: false, mensagem: "Sem resposta." });
      });
    });
  }

  function elementosClicaveis() {
    return [
      ...document.querySelectorAll(
        'a, button, input[type="submit"], input[type="button"], [role="button"], [tabindex="0"]'
      )
    ].filter(visivel);
  }

  function localizarGerador() {
    const termos = ["gerador de links", "gerar links", "criar link"];

    const direto = elementosClicaveis().find((el) => {
      const texto = normalizar(
        [el.textContent, el.getAttribute("aria-label"), el.getAttribute("title")]
          .filter(Boolean)
          .join(" ")
      );
      return termos.some((termo) => texto.includes(termo));
    });
    if (direto) return direto;

    const textos = [...document.querySelectorAll("span, p, div, strong")]
      .filter(visivel)
      .filter((el) => {
        const texto = normalizar(el.textContent);
        return termos.some(
          (termo) => texto === termo || texto.startsWith(termo)
        );
      });

    for (const texto of textos) {
      const clicavel = texto.closest(
        'a, button, [role="button"], [tabindex="0"]'
      );
      if (clicavel && visivel(clicavel)) return clicavel;
    }

    return null;
  }

  function localizarCampoUrl() {
    const campos = [
      ...document.querySelectorAll(
        'textarea, input[type="url"], input[type="text"], input:not([type])'
      )
    ].filter(visivel);

    const avaliar = (el) => {
      const contexto = normalizar(
        [
          el.getAttribute("placeholder"),
          el.getAttribute("aria-label"),
          el.getAttribute("name"),
          el.getAttribute("role"),
          el.id,
          el.closest("label")?.textContent,
          el.parentElement?.textContent?.slice(0, 220),
          el.parentElement?.parentElement?.textContent?.slice(0, 220)
        ]
          .filter(Boolean)
          .join(" ")
      );

      const campoPesquisa =
        contexto.includes("pesquis") ||
        contexto.includes("buscar") ||
        contexto.includes("search") ||
        contexto.includes("produtos selecionados") ||
        contexto.includes("mais relevantes") ||
        el.getAttribute("role") === "searchbox";

      if (campoPesquisa) {
        return { el, score: -100, contexto };
      }

      let score = 0;
      if (el.getAttribute("type") === "url") score += 8;
      if (contexto.includes("url")) score += 7;
      if (contexto.includes("link")) score += 6;
      if (contexto.includes("produto")) score += 4;
      if (contexto.includes("cole")) score += 4;
      if (contexto.includes("insira")) score += 2;

      return { el, score, contexto };
    };

    const melhor = campos
      .map(avaliar)
      .sort((a, b) => b.score - a.score)[0];

    // Nunca escolhe um campo gen\u00e9rico s\u00f3 porque \u00e9 o \u00fanico input da p\u00e1gina.
    // O Gerador de Links precisa apresentar ind\u00edcios claros de URL/link/produto.
    return melhor && melhor.score >= 6 ? melhor.el : null;
  }

  function botaoDesabilitado(el) {
    if ((el instanceof HTMLButtonElement || el instanceof HTMLInputElement) &&
        el.disabled) return true;
    return el.getAttribute("aria-disabled") === "true";
  }

  function localizarBotaoGerar(aceitarDesabilitado = false) {
    const campo = localizarCampoUrl();
    const formulario = campo?.closest("form, dialog, [role='dialog'], section, article");
    const candidatos = elementosClicaveis()
      .map((el) => {
        const texto = normalizar(
          [el.textContent, el.getAttribute("value"), el.getAttribute("aria-label"),
           el.getAttribute("title")].filter(Boolean).join(" ")
        );
        const valido = /^(?:gerar|criar)$/.test(texto) ||
          /\b(?:gerar|criar)\s+(?:o\s+|meu\s+|novo\s+)?(?:link|links|url|urls)\b/.test(texto);
        const noFormulario = formulario?.contains(el) ? 8 : 0;
        const exato = /^(?:gerar|criar)(?:\s+links?)?$/.test(texto) ? 4 : 0;
        return { el, texto, valido, score: noFormulario + exato };
      })
      .filter(({ valido, el }) => valido &&
        (aceitarDesabilitado || !botaoDesabilitado(el)))
      .sort((a, b) => b.score - a.score);
    return candidatos[0]?.el || null;
  }

  function escolherEtiquetaNativa() {
    const selects = [...document.querySelectorAll("select")].filter(visivel);
    for (const el of selects) {
      const contexto = normalizar([
        el.getAttribute("aria-label"), el.getAttribute("name"),
        el.closest("label")?.textContent,
        el.parentElement?.textContent?.slice(0,150)
      ].filter(Boolean).join(" "));
      if (!/(etiqueta|tag)/.test(contexto)) continue;
      if (el.value && !/selecion|escolh|etiqueta/.test(
        normalizar(el.selectedOptions?.[0]?.textContent))) return false;
      const opcoes = [...el.options].filter(o => o.value && !o.disabled &&
        !/(selecion|escolh|criar|nova etiqueta)/.test(normalizar(o.textContent)));
      const padrao = opcoes.find(o =>
        /(padrao|principal|default)/.test(normalizar(o.textContent))) ||
        (opcoes.length === 1 ? opcoes[0] : null);
      if (!padrao) return false;
      el.value = padrao.value;
      el.dispatchEvent(new Event("input",{bubbles:true}));
      el.dispatchEvent(new Event("change",{bubbles:true}));
      return true;
    }
    return false;
  }

  async function escolherEtiquetaUnica() {
    if (escolherEtiquetaNativa()) return true;
    const combos = elementosClicaveis().filter(el =>
      (el.matches('[role="combobox"],[aria-haspopup="listbox"]') ||
       el instanceof HTMLButtonElement) &&
      /(etiqueta|tag)/.test(normalizar([
        el.getAttribute("aria-label"),el.textContent?.slice(0,120)
      ].filter(Boolean).join(" ")))
    );
    if (!combos.length) return false;
    combos[0].click();
    await new Promise(resolve=>setTimeout(resolve,350));
    const opts = [...document.querySelectorAll('[role="option"]')].filter(visivel)
      .filter(el => !/(selecion|criar|nova etiqueta)/.test(normalizar(el.textContent)));
    const opcao = opts.find(el =>
      /(padrao|principal|default)/.test(normalizar(el.textContent))) ||
      (opts.length === 1 ? opts[0] : null);
    if (!opcao) return false;
    opcao.click();
    return true;
  }

  function preencher(el, valor) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

    if (setter) setter.call(el, valor);
    else el.value = valor;

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.focus();
  }

  function linksNaTela() {
    const encontrados = new Set();

    for (const el of document.querySelectorAll(
      'a[href], input, textarea, [role="textbox"], p, span, div'
    )) {
      if (!visivel(el)) continue;

      const valores = [];
      if (el instanceof HTMLAnchorElement) valores.push(el.href);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        valores.push(el.value);
      }
      if (el.children.length === 0) valores.push(el.textContent || "");

      for (const bruto of valores) {
        const texto = (bruto || "").trim();
        const meli = texto.match(/https:\/\/meli\.la\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/i);
        if (meli) encontrados.add(meli[0]);

        const sec = texto.match(
          /https:\/\/(?:www\.)?mercadolivre\.com(?:\.br)?\/sec\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/i
        );
        if (sec) encontrados.add(sec[0]);
      }
    }

    return [...encontrados];
  }

  async function esperar(fn, limiteMs, passoMs = 500) {
    const inicio = Date.now();
    while (Date.now() - inicio < limiteMs) {
      const valor = fn();
      if (valor) return valor;
      await new Promise((resolve) => setTimeout(resolve, passoMs));
    }
    return null;
  }

  function blocosCupomNaPagina() {
    const texto = document.body?.innerText || "";
    if (!texto || !/\bCupom\b/.test(texto)) return [];

    const marcador = /\bCupom\s+([A-Z0-9][A-Z0-9_-]{3,29})\b/g;
    const marcadores = [...texto.matchAll(marcador)];
    const blocos = [];

    for (let i = 0; i < marcadores.length && blocos.length < 60; i += 1) {
      const atual = marcadores[i];
      const inicio = atual.index ?? 0;
      const fim =
        i + 1 < marcadores.length
          ? (marcadores[i + 1].index ?? texto.length)
          : Math.min(texto.length, inicio + 3000);

      const bloco = texto
        .slice(inicio, Math.min(fim, inicio + 3000))
        .replace(/\s+/g, " ")
        .trim();

      if (
        /v\u00e1lido|desconto|compra|%\s*OFF|R\$\s*[\d.,]+\s*OFF/i.test(
          bloco
        )
      ) {
        blocos.push(bloco);
      }
    }

    return [...new Set(blocos)];
  }

  async function observarCupons() {
    if (Date.now() - ultimoScanCupom < COUPON_SCAN_MS) return;
    ultimoScanCupom = Date.now();

    const blocks = blocosCupomNaPagina();
    if (blocks.length === 0) return;

    await enviar({
      type: "couponSnapshot",
      url: location.href,
      blocks
    });
  }

  async function processar(job) {
    processando = true;
    jobAtual = job.id;
    mostrarStatus("Automa\u00e7\u00e3o Meli: preparando o Gerador de Links...");

    try {
      await enviar({ type: "startJob", id: job.id });

      let campo = localizarCampoUrl();

      if (!campo) {
        const gerador = await esperar(localizarGerador, 12000);
        if (!gerador) {
          throw new Error(
            "N\u00e3o encontrei o bot\u00e3o Gerador de Links. Abra a \u00e1rea de Afiliados e tente novamente."
          );
        }

        gerador.click();
        mostrarStatus("Automa\u00e7\u00e3o Meli: abrindo o Gerador de Links...");
        campo = await esperar(localizarCampoUrl, 15000);
      }

      if (!campo) {
        throw new Error("N\u00e3o encontrei o campo para colar a URL do produto.");
      }

      const url = new URL(job.urlProduto);
      const hostMercadoLivre = /(^|\.)mercadolivre\.com(?:\.br)?$/.test(url.hostname);
      // URLs oficiais de catalogo (/p/MLB...) e anuncios individuais
      // (/MLB-12345-nome-_JM) podem ser aceitas pelo Gerador de Links.
      const catalogo = /^\/p\/MLB[A-Za-z0-9_-]+\/?$/i.test(url.pathname);
      const anuncio = /^\/MLB-\d+(?:-[^/?#]*)?\/?$/i.test(url.pathname);
      if (url.protocol !== "https:" || url.username || url.password ||
          url.port || !hostMercadoLivre || (!catalogo && !anuncio)) {
        throw new Error("O produto informado n\u00e3o \u00e9 uma p\u00e1gina de cat\u00e1logo ou an\u00fancio autorizada.");
      }
      preencher(campo, job.urlProduto);
      campo.blur();
      mostrarStatus("Automa\u00e7\u00e3o Meli: URL preenchida. Localizando o Gerador...");

      let botao = await esperar(() => localizarBotaoGerar(), 3500);
      if (!botao) {
        const etiquetaEscolhida = await escolherEtiquetaUnica();
        if (etiquetaEscolhida) {
          mostrarStatus("Automa\u00e7\u00e3o Meli: etiqueta padr\u00e3o selecionada. Gerando link...");
          botao = await esperar(() => localizarBotaoGerar(), 6000);
        }
      }
      if (!botao) {
        if (localizarBotaoGerar(true)) {
          throw new Error("Bot\u00e3o Gerar desabilitado. A etiqueta pode estar correta; confirme se a URL corresponde a um an\u00fancio eleg\u00edvel e foi aceita pelo portal.");
        }
        throw new Error("A Central de Afiliados n\u00e3o mostrou o bot\u00e3o Criar/Gerar link. Abra o Gerador oficial.");
      }

      // Em execu\u00e7\u00f5es consecutivas o resultado anterior pode continuar vis\u00edvel.
      // Guardamos os links existentes para nunca devolver o link da oferta anterior.
      const linksAntes = new Set(linksNaTela());
      botao.click();

      const link = await esperar(() => {
        const links = linksNaTela();
        return links.find((url) =>
          (
            /^https:\/\/meli\.la\//i.test(url) ||
            /mercadolivre\.com(?:\.br)?\/sec\//i.test(url)
          ) &&
          !linksAntes.has(url)
        );
      }, 20000);

      if (!link) {
        throw new Error(
          "O Mercado Livre n\u00e3o exibiu um link oficial reconhec\u00edvel ap\u00f3s gerar."
        );
      }

      const resposta = await enviar({
        type: "result",
        id: job.id,
        link
      });

      if (!resposta?.ok) {
        throw new Error(resposta?.mensagem || "O painel recusou o link gerado.");
      }

      mostrarStatus("Link oficial gerado e salvo no painel.", "ok");
      await new Promise((resolve) => setTimeout(resolve, 3500));
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : String(error);
      mostrarStatus("Automa\u00e7\u00e3o Meli: " + mensagem, "erro");
      await enviar({
        type: "result",
        id: job.id,
        error: mensagem
      });
    } finally {
      processando = false;
    }
  }

  function paginaAfiliados() {
    return /(?:^|\/)(?:afiliados?|creators?|criadores?)(?:[/-]|$)/i
      .test(location.pathname);
  }

  async function ciclo() {
    await enviar({ type: "ping" });
    await observarCupons();

    // Outras abas Mercado Livre nao podem disputar um link pendente.
    if (processando || !paginaAfiliados()) return;

    const resposta = await enviar({ type: "getJob" });
    const job = resposta?.job;

    if (
      resposta?.ok &&
      job &&
      job.id &&
      job.id !== jobAtual &&
      (job.status === "pending" || job.status === "running")
    ) {
      processar(job);
    }
  }

  ciclo();
  setInterval(ciclo, POLL_MS);
})();
