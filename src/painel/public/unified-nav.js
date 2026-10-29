/*
 * UX Unificada v2 — Caça Promos VIP.
 * Aparência aprovada em prévia independente. Este arquivo não publica
 * ofertas, não altera autorização/canal, não gera links e não envia mensagens.
 * Controles DOM e seus eventos operacionais são PRESERVADOS.
 */
(() => {
  "use strict";
  const itens = [
    { href: "/", icon: "▦", label: "Painel de métricas" },
    { href: "/ofertas", icon: "◈", label: "Central de Ofertas" },
    { href: "/revisao", icon: "▤", label: "Revisão e evidências" },
    { href: "/shopee", icon: "S", label: "Shopee" }
  ];
  const telas = {
    "/": {
      chave: "home", trilha: "Métricas", titulo: "Painel de métricas"
    },
    "/ofertas": {
      chave: "ofertas", trilha: "Ofertas",
      kicker: "OPERAÇÃO COMERCIAL", titulo: "Central de Ofertas",
      descricao: "Amazon, Mercado Livre e Shopee organizados na mesma experiência. Consulte os estados, os controles e as ofertas em um só lugar.",
      acao: "Ver revisão", destino: "/revisao"
    },
    "/revisao": {
      chave: "revisao", trilha: "Revisão",
      kicker: "QUALIDADE E CONTROLE", titulo: "Revisão e evidências",
      descricao: "Confira registros, situações e motivos de bloqueio em um ambiente de análise, antes de qualquer divulgação.",
      acao: "Abrir ofertas", destino: "/ofertas"
    },
    "/shopee": {
      chave: "shopee", trilha: "Shopee",
      kicker: "MARKETPLACE", titulo: "Shopee",
      descricao: "Preparação de links de afiliado e informações de integração, dentro do mesmo padrão visual da Central.",
      acao: "Ver ofertas", destino: "/ofertas"
    }
  };
  const raiz = location.pathname === "/central" ? "/" : location.pathname;
  const tela = telas[raiz];
  if (!tela) return;

  function el(tag, classe = "", text) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (text !== undefined) elemento.textContent = text;
    return elemento;
  }
  function montarNavegacao(sidebar) {
    sidebar.querySelectorAll(":scope > .nav, :scope > .nav-title").forEach(n => n.remove());
    const foot = sidebar.querySelector(":scope > .side-foot");
    const titulo = el("div", "nav-title", "INÍCIO");
    const nav = el("nav", "nav");
    nav.setAttribute("aria-label", "Navegação principal");
    for (const item of itens) {
      const a = el("a");
      a.href = item.href;
      if (item.href === raiz) a.setAttribute("aria-current", "page");
      a.append(el("span", "cpv-nav-icon ux-icon", item.icon));
      a.append(el("span", "", item.label));
      nav.append(a);
    }
    sidebar.insertBefore(titulo, foot || null);
    sidebar.insertBefore(nav, foot || null);
    sidebar.dataset.cpvNav = "true";
  }
  function normalizarRodape(sidebar) {
    let foot = sidebar.querySelector(":scope > .side-foot");
    if (!foot) {
      foot = el("div", "side-foot");
      sidebar.append(foot);
    }
    const titulo = el("b", "", "Operação local");
    foot.replaceChildren(titulo, document.createTextNode(
      "Automação e WhatsApp seguem protegidos pelas regras da Central."
    ));
  }
  function criarSidebar() {
    const side = el("aside", "sidebar cpv-sidebar");
    side.id = "sidebar";
    side.setAttribute("aria-label", "Menu principal");
    const brand = el("div", "brand");
    const text = el("span");
    text.append(el("strong", "", "CAÇA PROMOS VIP"));
    text.append(el("small", "", "Plataforma unificada"));
    brand.append(el("span", "logo", "CP"), text);
    side.append(brand);
    normalizarRodape(side);
    return side;
  }
  function criarTopbar() {
    const top = el("header", "cpv-topbar");
    top.setAttribute("aria-label", "Estado da Central");
    const left = el("div", "cpv-top-left");
    const menu = el("button", "cpv-mobile-menu", "☰");
    menu.id = "menuBtn";
    menu.type = "button";
    menu.setAttribute("aria-label", "Abrir menu");
    menu.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-controls", "sidebar");
    const breadcrumb = el("span", "cpv-crumb");
    breadcrumb.append(document.createTextNode("Caça Promos VIP  /  "));
    breadcrumb.append(el("strong", "", tela.trilha));
    left.append(menu, breadcrumb);
    const estado = el("span", "cpv-status", "Consultando operação...");
    estado.id = "cpvStatus";
    top.append(left, estado);
    return top;
  }
  function vincularMenuNovo(sidebar) {
    const button = document.getElementById("menuBtn");
    const scrim = document.getElementById("scrim");
    if (!button || !scrim) return;
    const trocar = (open) => {
      sidebar.classList.toggle("open", open);
      scrim.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      button.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    };
    button.addEventListener("click", () => trocar(!sidebar.classList.contains("open")));
    scrim.addEventListener("click", () => trocar(false));
    sidebar.addEventListener("click", event => {
      if (event.target instanceof Element && event.target.closest("a")) trocar(false);
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && sidebar.classList.contains("open")) {
        trocar(false);
        button.focus();
      }
    });
  }
  function headingComum() {
    const node = el("section", "ux-page-heading");
    const copy = el("div");
    copy.append(el("div", "ux-heading-kicker", tela.kicker));
    copy.append(el("h1", "", tela.titulo));
    copy.append(el("p", "", tela.descricao));
    node.append(copy);
    if (tela.destino) {
      const action = el("a", "ux-heading-action", tela.acao + " ↗");
      action.href = tela.destino;
      node.append(action);
    }
    return node;
  }
  function atualizarHome(workspace, main) {
    const heading = main.querySelector(":scope > .heading");
    if (heading) {
      heading.classList.add("ux-page-heading");
      heading.querySelector(".eyebrow")?.classList.add("ux-heading-kicker");
      heading.querySelector("a.btn")?.classList.add("ux-heading-action");
      workspace.insertBefore(heading, main);
    }
    const grid = main.querySelector(":scope > .grid");
    if (!grid || grid.querySelector('[data-ux-v2-review="true"]')) return;
    const cards = [...grid.querySelectorAll(":scope > .module")];
    if (cards.length < 4) return;
    // Esconder somente atalhos; os módulos, APIs e seus eventos permanecem intactos.
    cards[1].dataset.uxV2Hidden = "true";
    cards[2].dataset.uxV2Hidden = "true";
    const review = el("article", "panel module");
    review.dataset.uxV2Review = "true";
    review.append(el("span", "symbol", "▤"));
    review.append(el("h2", "", "Revisão e evidências"));
    review.append(el("p", "",
      "Análise de ofertas, rastreabilidade dos preços e motivos de bloqueio."));
    const action = el("a", "btn", "Ver revisão ↗");
    action.href = "/revisao";
    review.append(action);
    grid.insertBefore(review, cards[3]);
  }
  function aplicarV2(sidebar, workspace) {
    document.body.classList.add("cpv-v2", "ux-" + tela.chave);
    const frame = sidebar.closest(".app,.cpv-app");
    frame?.classList.add("cpv-app");
    workspace.classList.add("cpv-workspace");
    sidebar.classList.add("cpv-sidebar");
    const main = workspace.querySelector(":scope > main");
    if (!main) return;
    main.classList.add("cpv-source-main");
    const topbar = workspace.querySelector(":scope > .cpv-topbar,:scope > header.top");
    if (topbar) topbar.classList.add("cpv-topbar");
    if (tela.chave === "home") {
      atualizarHome(workspace, main);
    } else {
      const heading = headingComum();
      const hero = workspace.querySelector(":scope > .hero,:scope > .top:not(.cpv-topbar)");
      workspace.insertBefore(heading, hero || main);
    }
    normalizarRodape(sidebar);
    montarNavegacao(sidebar);
  }
  async function atualizarStatusVisual() {
    const status = document.getElementById("cpvStatus");
    if (!status) return;
    try {
      const resp = await fetch("/api/status", {
        cache:"no-store", credentials:"same-origin"
      });
      if (!resp.ok) throw Error("API");
      const data = await resp.json();
      const pausada = data.operacaoEstado === "paused";
      status.dataset.paused = String(pausada);
      status.textContent = pausada ? "Automação pausada" :
        data.operacaoEstado === "review" ? "Oferta em revisão" :
        "Estado: " + String(data.operacaoEstado || "indisponível");
    } catch {
      status.textContent = "Estado indisponível";
    }
  }
  function ativar() {
    // Home e Shopee já possuem shell e scripts operacionais próprios.
    const existente = document.querySelector(".app > aside.sidebar");
    if (existente) {
      const workspace = existente.closest(".app")?.querySelector(":scope > .workspace");
      if (workspace) aplicarV2(existente, workspace);
      return;
    }
    // Ofertas e Revisão são incorporadas ao MESMO shell visual.
    const visualHeader = document.querySelector("body > header");
    const main = document.querySelector("body > main");
    if (!visualHeader || !main) return;
    const navAntiga = document.querySelector("body > nav.ofertas-workspace-nav") ||
      visualHeader.querySelector(":scope > nav.nav");
    const frame = el("div", "cpv-app");
    const workspace = el("div", "cpv-workspace");
    const sidebar = criarSidebar();
    const scrim = el("div", "cpv-scrim");
    scrim.id = "scrim";
    scrim.hidden = true;
    const topbar = criarTopbar();
    document.body.insertBefore(scrim, visualHeader);
    document.body.insertBefore(frame, visualHeader);
    frame.append(sidebar, workspace);
    workspace.append(topbar, visualHeader, main);
    navAntiga?.remove();
    document.body.classList.add("cpv-framed");
    aplicarV2(sidebar, workspace);
    vincularMenuNovo(sidebar);
    atualizarStatusVisual();
    window.setInterval(atualizarStatusVisual, 15000);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ativar, { once:true });
  } else {
    ativar();
  }
})();
