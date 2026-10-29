/*
 * UX compartilhado — Lovable -> Caça Promos VIP.
 * Exclusivamente apresentação e navegação; nenhuma ação de postagem.
 */
(() => {
  "use strict";
  const grupos = [
    {
      titulo: "INÍCIO",
      links: [
        { href: "/", icon: "⌂", label: "Painel de métricas" },
        { href: "/ofertas", icon: "◈", label: "Central de Ofertas" },
        { href: "/revisao", icon: "▣", label: "Revisão e evidências" },
        { href: "/shopee", icon: "S", label: "Shopee" }
      ]
    },
    {
      titulo: "OPERAÇÃO E PUBLICAÇÃO",
      links: [
        { href: "/ofertas#launchCard", icon: "↻", label: "Ciclo automático" },
        { href: "/ofertas#instagramCard", icon: "▤", label: "Instagram" }
      ]
    },
    {
      titulo: "RELACIONAMENTO",
      links: [
        { href: "/central", captacao: "/enviar", icon: "➤", label: "Enviar convite" },
        { href: "/central", captacao: "/contatos", icon: "♧", label: "Contatos" },
        { href: "/central", captacao: "/campanhas", icon: "▥", label: "Campanhas e filas" },
        { href: "/central", captacao: "/respostas-botoes", icon: "✉", label: "Respostas" },
        { href: "/central", captacao: "/denuncias", icon: "♜", label: "Segurança e bloqueios" }
      ]
    }
  ];
  function elem(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }
  function paginaAtual() {
    const pathname = location.pathname;
    return pathname === "/" || pathname === "/central" ? "/" : pathname;
  }
  function montarNavegacao(sidebar) {
    sidebar.querySelectorAll(":scope > .nav, :scope > .nav-title").forEach((node) => node.remove());
    const rodape = sidebar.querySelector(":scope > .side-foot");
    const trecho = document.createDocumentFragment();
    for (const grupo of grupos) {
      trecho.append(elem("div", "nav-title", grupo.titulo));
      const nav = elem("nav", "nav");
      nav.setAttribute("aria-label", grupo.titulo === "INÍCIO" ? "Navegação principal" : grupo.titulo);
      for (const item of grupo.links) {
        const a = elem("a");
        a.setAttribute("href", item.href);
        if ("captacao" in item) a.dataset.captacao = item.captacao;
        if (!("captacao" in item) && item.href === paginaAtual()) {
          a.setAttribute("aria-current", "page");
        }
        a.append(elem("span", "cpv-nav-icon", item.icon));
        a.append(elem("span", "", item.label));
        nav.append(a);
      }
      trecho.append(nav);
    }
    sidebar.insertBefore(trecho, rodape || null);
    sidebar.dataset.cpvNav = "true";
  }
  function criarSidebar() {
    const aside = elem("aside", "sidebar cpv-sidebar");
    aside.id = "sidebar";
    aside.setAttribute("aria-label", "Menu principal");
    const marca = elem("div", "brand");
    const logo = elem("span", "logo", "CP");
    const rotulo = elem("span");
    rotulo.append(elem("strong", "", "CAÇA PROMOS VIP"));
    rotulo.append(elem("small", "", "Plataforma unificada"));
    marca.append(logo, rotulo);
    aside.append(marca);
    const rodape = elem("div", "side-foot");
    const titulo = elem("b", "", "Operação local");
    rodape.append(titulo, document.createElement("br"));
    rodape.append(document.createTextNode(
      "Acesso direto aos módulos. Automação e WhatsApp continuam protegidos pelas regras da Central."
    ));
    aside.append(rodape);
    return aside;
  }
  function criarCabecalho(view) {
    const topbar = elem("header", "cpv-topbar");
    topbar.setAttribute("aria-label", "Estado da Central");
    const left = elem("div", "cpv-top-left");
    const button = elem("button", "cpv-mobile-menu", "☰");
    button.id = "menuBtn";
    button.type = "button";
    button.setAttribute("aria-label", "Abrir menu");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "sidebar");
    const crumb = elem("span", "cpv-crumb");
    crumb.append(document.createTextNode("Caça Promos VIP  /  "));
    crumb.append(elem("strong", "", view === "ofertas" ? "Ofertas" : "Revisão"));
    left.append(button, crumb);
    const state = elem("span", "cpv-status", "Consultando operação...");
    state.id = "cpvStatus";
    topbar.append(left, state);
    return topbar;
  }
  function vincularMenuNovo(sidebar) {
    const botao = document.getElementById("menuBtn");
    const scrim = document.getElementById("scrim");
    if (!botao || !scrim) return;
    const trocar = (open) => {
      sidebar.classList.toggle("open", open);
      scrim.hidden = !open;
      botao.setAttribute("aria-expanded", String(open));
      botao.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    };
    botao.addEventListener("click", () => trocar(!sidebar.classList.contains("open")));
    scrim.addEventListener("click", () => trocar(false));
    sidebar.querySelectorAll("a").forEach(a => a.addEventListener("click", () => trocar(false)));
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && sidebar.classList.contains("open")) {
        trocar(false);
        botao.focus();
      }
    });
  }
  async function atualizarStatusVisual() {
    const estado = document.getElementById("cpvStatus");
    if (!estado) return;
    try {
      const resposta = await fetch("/api/status", { cache: "no-store", credentials: "same-origin" });
      if (!resposta.ok) throw Error("API");
      const dados = await resposta.json();
      const pausado = dados.operacaoEstado === "paused";
      estado.dataset.paused = String(pausado);
      estado.textContent = pausado ? "Automação pausada" :
        dados.operacaoEstado === "review" ? "Oferta em revisão" :
        "Estado: " + String(dados.operacaoEstado || "indisponível");
    } catch {
      estado.textContent = "Estado indisponível";
    }
  }
  async function detectarCaptacao() {
    if (paginaAtual() === "/") return; // Central.js resolve os links da Home.
    const anchors = [...document.querySelectorAll("#sidebar [data-captacao]")];
    for (const port of [3045, 3040]) {
      const ctrl = new AbortController();
      const timeout = window.setTimeout(() => ctrl.abort(), 1200);
      try {
        await fetch("http://127.0.0.1:" + port + "/saude", {
          mode: "no-cors", cache: "no-store", signal: ctrl.signal
        });
        anchors.forEach(a => {
          a.href = "http://127.0.0.1:" + port + a.dataset.captacao;
        });
        return;
      } catch {
        // Sem serviço disponível, encaminhar à Home, nunca inventar rota.
      } finally {
        window.clearTimeout(timeout);
      }
    }
  }
  function ativar() {
    const existente = document.querySelector(".app > aside.sidebar");
    if (existente) {
      montarNavegacao(existente);
      // central.js e shopee.js mantêm seus próprios controles responsivos.
      detectarCaptacao().catch(() => undefined);
      return;
    }
    const visualHeader = document.querySelector("body > header");
    const main = document.querySelector("body > main");
    if (!visualHeader || !main) return;
    const view = location.pathname === "/revisao" ? "revisao" : "ofertas";
    const antigas = document.querySelector("body > nav.ofertas-workspace-nav") ||
      visualHeader.querySelector(":scope > nav.nav");
    const frame = elem("div", "cpv-app");
    const workspace = elem("div", "cpv-workspace");
    const sidebar = criarSidebar();
    const scrim = elem("div", "cpv-scrim");
    scrim.id = "scrim";
    scrim.hidden = true;
    const topbar = criarCabecalho(view);
    document.body.insertBefore(scrim, visualHeader);
    document.body.insertBefore(frame, visualHeader);
    frame.append(sidebar, workspace);
    workspace.append(topbar, visualHeader, main);
    if (antigas) antigas.remove();
    document.body.classList.add("cpv-framed");
    montarNavegacao(sidebar);
    vincularMenuNovo(sidebar);
    atualizarStatusVisual();
    window.setInterval(atualizarStatusVisual, 15000);
    detectarCaptacao().catch(() => undefined);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ativar, { once: true });
  } else {
    ativar();
  }
})();
