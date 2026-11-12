/**
 * UX-02 | Uma única navegação para todos os módulos.
 * Não publica, não grava configuração e não altera controles do motor.
 * A sidebar é gerada por este arquivo, inclusive em Central e Shopee.
 */
(() => {
  "use strict";
  const route = location.pathname === "/" ? "/central" : location.pathname;
  const modules = [
    { path: "/central", label: "Visão geral", symbol: "⌂" },
    { path: "/ofertas", label: "Central de Ofertas", symbol: "◈" },
    { path: "/revisao", label: "Revisão técnica", symbol: "▣" },
    { path: "/historico-precos", label: "Histórico inteligente", symbol: "⌁" },
    { path: "/cacador", label: "Caçador VIP", symbol: "◎" },
    { path: "/shopee", label: "Shopee", symbol: "S" }
  ];
  const current = modules.find(item => item.path === route) || modules[0];
  document.body.classList.add("cpv-shell-unified");

  const embeddedSidebar = document.getElementById("sidebar");
  const sidebar = embeddedSidebar || document.createElement("aside");
  sidebar.id = "sidebar";
  sidebar.className = "sidebar cpv-nav-sidebar";
  sidebar.setAttribute("aria-label", "Menu principal");

  const logo = document.createElement("span");
  logo.className = "cpv-nav-logo";
  logo.textContent = "CP";
  const name = document.createElement("span");
  name.className = "cpv-nav-brand-text";
  const brandTitle = document.createElement("strong");
  brandTitle.textContent = "CAÇA PROMOS VIP";
  const brandSubtitle = document.createElement("small");
  brandSubtitle.textContent = "Central unificada";
  name.append(brandTitle, brandSubtitle);
  const brand = document.createElement("div");
  brand.className = "cpv-nav-brand";
  brand.append(logo, name);

  const section = document.createElement("span");
  section.className = "cpv-nav-label";
  section.textContent = "MÓDULOS";

  const nav = document.createElement("nav");
  nav.id = "cpvUnifiedNav";
  nav.className = "cpv-nav-links";
  nav.setAttribute("aria-label", "Navegação principal");

  for (const item of modules) {
    const link = document.createElement("a");
    link.href = item.path;
    link.className = "cpv-nav-link";
    const icon = document.createElement("span");
    icon.className = "cpv-nav-icon" + (item.path === "/shopee" ? " cpv-nav-icon-shopee" : "");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = item.symbol;
    const label = document.createElement("span");
    label.className = "cpv-nav-link-label";
    label.textContent = item.label;
    link.append(icon, label);
    if (item.path === current.path) link.setAttribute("aria-current", "page");
    nav.append(link);
  }

  const footer = document.createElement("div");
  footer.className = "cpv-nav-foot";
  const footTitle = document.createElement("strong");
  footTitle.textContent = "Operação local";
  const footNote = document.createElement("p");
  footNote.textContent = route === "/cacador"
    ? "Caçador Mercado Livre: fontes externas desligadas até autorização."
    : "Amazon e Mercado Livre em um só painel. Shopee em preparação.";
  footer.append(footTitle, footNote);
  sidebar.replaceChildren(brand, section, nav, footer);

  let scrim = document.getElementById("scrim");
  if (!scrim) {
    scrim = document.createElement("div");
    scrim.id = "scrim";
    scrim.hidden = true;
    document.body.prepend(scrim);
  }
  scrim.classList.add("cpv-nav-scrim");

  if (!embeddedSidebar) {
    // Ofertas e Revisão não possuíam shell. Reaproveitam o mesmo menu.
    document.body.prepend(sidebar);
    const top = document.createElement("header");
    top.className = "cpv-global-top";
    const left = document.createElement("div");
    left.className = "cpv-global-top-left";
    const button = document.createElement("button");
    button.id = "menuBtn";
    button.className = "cpv-nav-toggle";
    button.type = "button";
    button.setAttribute("aria-label", "Abrir menu");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "sidebar");
    button.textContent = "☰";
    const breadcrumb = document.createElement("span");
    breadcrumb.className = "cpv-global-breadcrumb";
    breadcrumb.append("Caça Promos VIP", document.createTextNode("  /  "));
    const bold = document.createElement("strong");
    bold.textContent = current.label;
    breadcrumb.append(bold);
    left.append(button, breadcrumb);

    const state = document.createElement("span");
    state.className = "cpv-global-operation";
    state.id = "cpvGlobalOperation";
    state.textContent = "Consultando operação…";
    state.setAttribute("role", "status");

    top.append(left, state);
    const originalFirst = [...document.body.children].find(
      node => node !== sidebar && node !== scrim
    );
    if (originalFirst) document.body.insertBefore(top, originalFirst);
    else document.body.append(top);

    const mobileMenu = open => {
      sidebar.classList.toggle("open", open);
      scrim.hidden = !open;
      scrim.classList.toggle("open", open);
      button.setAttribute("aria-expanded", String(open));
    };
    button.addEventListener("click", () =>
      mobileMenu(!sidebar.classList.contains("open"))
    );
    scrim.addEventListener("click", () => mobileMenu(false));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") mobileMenu(false);
    });

    const update = async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) throw new Error("Status indisponível");
        const s = await res.json();
        const semOferta = s.operacaoEstado === "error" &&
          /(?:nenhuma oferta|n[aã]o encontrou ofertas|sem ofertas eleg[ií]veis)/i
            .test(String(s.mercadoLivreFluxoMensagem || ""));
        state.textContent = semOferta ? "Busca sem ofertas"
          : s.operacaoEstado === "error" ? "Operação requer atenção"
          : s.monitorAlternadoAtivo ? "Monitor ativo" : "Monitor pausado";
        state.dataset.state = semOferta ? "paused"
          : s.operacaoEstado === "error" ? "warning"
          : s.monitorAlternadoAtivo ? "active" : "paused";
      } catch {
        state.textContent = "Status indisponível";
        state.dataset.state = "warning";
      }
    };
    void update();
    setInterval(update, 12000);
  } else {
    // Central/Shopee já possuem .top, #menuBtn e handlers da página.
    // A navegação é substituída, mas não criamos handlers duplicados.
    const top = document.querySelector(".workspace > .top");
    top?.classList.add("cpv-global-top");
    const toggle = document.getElementById("menuBtn");
    toggle?.classList.add("cpv-nav-toggle");
    toggle?.setAttribute("aria-controls", "sidebar");
  }
})();
