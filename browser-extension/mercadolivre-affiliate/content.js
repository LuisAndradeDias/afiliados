(() => {
  if (window.__meliAutoLinkLoaded) return;
  window.__meliAutoLinkLoaded = true;

  const POLL_MS = 1600;
  let processando = false;
  let jobAtual = "";

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
        'a, button, [role="button"], [tabindex="0"]'
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

    // Nunca escolhe um campo genérico só porque é o único input da página.
    // O Gerador de Links precisa apresentar indícios claros de URL/link/produto.
    return melhor && melhor.score >= 6 ? melhor.el : null;
  }

  function localizarBotaoGerar() {
    const candidatos = elementosClicaveis()
      .map((el) => ({
        el,
        texto: normalizar(
          [el.textContent, el.getAttribute("aria-label")]
            .filter(Boolean)
            .join(" ")
        )
      }))
      .filter(({ texto }) =>
        texto === "gerar" ||
        texto === "gerar link" ||
        texto === "gerar links" ||
        texto.includes("gerar link")
      );

    return candidatos.find(({ el }) => {
      if (el instanceof HTMLButtonElement) return !el.disabled;
      return el.getAttribute("aria-disabled") !== "true";
    })?.el || null;
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

  async function processar(job) {
    processando = true;
    jobAtual = job.id;
    mostrarStatus("Automação Meli: preparando o Gerador de Links...");

    try {
      await enviar({ type: "startJob", id: job.id });

      let campo = localizarCampoUrl();

      if (!campo) {
        const gerador = await esperar(localizarGerador, 12000);
        if (!gerador) {
          throw new Error(
            "Não encontrei o botão Gerador de Links. Abra a área de Afiliados e tente novamente."
          );
        }

        gerador.click();
        mostrarStatus("Automação Meli: abrindo o Gerador de Links...");
        campo = await esperar(localizarCampoUrl, 15000);
      }

      if (!campo) {
        throw new Error("Não encontrei o campo para colar a URL do produto.");
      }

      preencher(campo, job.urlProduto);
      mostrarStatus("Automação Meli: URL preenchida. Gerando link...");

      const botao = await esperar(localizarBotaoGerar, 10000);
      if (!botao) {
        throw new Error("Não encontrei o botão Gerar.");
      }

      botao.click();

      const link = await esperar(() => {
        const links = linksNaTela();
        return links.find((url) =>
          /^https:\/\/meli\.la\//i.test(url) ||
          /mercadolivre\.com(?:\.br)?\/sec\//i.test(url)
        );
      }, 20000);

      if (!link) {
        throw new Error(
          "O Mercado Livre não exibiu um link oficial reconhecível após gerar."
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
      mostrarStatus("Automação Meli: " + mensagem, "erro");
      await enviar({
        type: "result",
        id: job.id,
        error: mensagem
      });
    } finally {
      processando = false;
    }
  }

  async function ciclo() {
    await enviar({ type: "ping" });

    if (processando) return;

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
