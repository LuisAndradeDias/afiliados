/* Navegação entre módulos; somente DOM, sem ações de publicação. */
(() => {
  "use strict";
  if (document.querySelector(".sidebar .nav")) return; // Central/Shopee já têm menu próprio.
  if (document.getElementById("cpvUnifiedNav")) return;
  const pages = [
    ["/central", "Visão geral"], ["/ofertas", "Ofertas"],
    ["/revisao", "Revisão técnica"], ["/shopee", "Shopee"]
  ];
  const nav = document.createElement("nav");
  nav.id = "cpvUnifiedNav";
  nav.className = "cpv-unified-nav";
  nav.setAttribute("aria-label", "Módulos Caça Promos VIP");
  const brand = document.createElement("span");
  brand.className = "cpv-unified-brand";
  brand.textContent = "CAÇA PROMOS VIP";
  nav.append(brand);
  const links = document.createElement("span");
  links.className = "cpv-unified-links";
  const active = location.pathname === "/" ? "/central" : location.pathname;
  for (const [url, label] of pages) {
    const a = document.createElement("a");
    a.href = url; a.textContent = label;
    if (active === url) a.setAttribute("aria-current", "page");
    links.append(a);
  }
  nav.append(links);
  document.body.prepend(nav);
})();