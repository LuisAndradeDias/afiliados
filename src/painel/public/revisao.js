/* Revisão técnica: renderização com textContent e somente GET. */
(() => {
  "use strict";
  const id = name => document.getElementById(name);
  const filtros = [...document.querySelectorAll("[data-rev-filter]")];
  let fichas = [], filtro = "todos";
  const set = (name, value) => { const node = id(name); if (node) node.textContent = value; };
  const valor = x => typeof x === "number" && Number.isFinite(x)
    ? x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "Não registrado";
  function par(parent, tag, content, className) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = content;
    parent.append(element);
    return element;
  }
  function exibir() {
    const list = id("revList");
    list.replaceChildren();
    const active = fichas.filter(f => filtro === "todos" || f.origem === filtro);
    if (!active.length) {
      par(list, "div", "Nenhum registro desta origem disponível. O motor de ofertas não foi alterado.", "rev-panel rev-empty");
      return;
    }
    for (const f of active) {
      const card = document.createElement("article");
      card.className = "rev-panel rev-card";
      par(card, "span", f.origem === "oferta-preparada" ? "Oferta preparada" : "Observação Mercado Livre", "rev-chip");
      par(card, "h3", String(f.titulo || "Produto sem título"));
      const line = document.createElement("div");
      line.className = "rev-fields";
      for (const [name, value] of [
        ["Marketplace", String(f.plataforma || "Não informado")],
        ["Produto", String(f.produtoId || "—")],
        ["Preço", "R$ " + valor(f.precoAtual)],
        ["Desconto observado", typeof f.descontoPercentual === "number" ? f.descontoPercentual + "%" : "Não registrado"],
        ["Cupom", String(f.cupomCodigo || "Nenhum comprovado")]
      ]) {
        const span = document.createElement("span");
        par(span, "b", name + ": ");
        span.append(document.createTextNode(value));
        line.append(span);
      }
      card.append(line);
      if (f.link) {
        const a = document.createElement("a");
        a.textContent = "Consultar link registrado";
        a.href = f.link; a.target = "_blank"; a.rel = "noopener noreferrer";
        card.append(a);
      }
      const details = document.createElement("details");
      par(details, "summary", "Observações técnicas");
      const ul = document.createElement("ul");
      for (const check of (Array.isArray(f.verificacoes) ? f.verificacoes : [])) {
        par(ul, "li", String(check.nome || "") + ": " + String(check.observacao || ""));
      }
      details.append(ul); card.append(details); list.append(card);
    }
  }
  function avisos(lista) {
    const root = id("revAlerts");
    root.replaceChildren();
    if (!Array.isArray(lista) || !lista.length) return;
    const p = par(root, "p", lista.join(" · "), "rev-alert");
    p.setAttribute("role", "status");
  }
  async function atualizar() {
    try {
      const [revisaoResponse, statusResponse] = await Promise.all([
        fetch("/api/revisao", { cache: "no-store" }),
        fetch("/api/status", { cache: "no-store" })
      ]);
      if (!revisaoResponse.ok || !statusResponse.ok) throw new Error("API indisponível");
      const data = await revisaoResponse.json(), status = await statusResponse.json();
      if (data.modo !== "somente-leitura") throw new Error("Fonte de dados inesperada");
      fichas = Array.isArray(data.fichas) ? data.fichas : [];
      set("revObserved", Number.isSafeInteger(data.resumo?.ofertasObservadas)
        ? String(data.resumo.ofertasObservadas) : "—");
      set("revSent", Number.isSafeInteger(data.resumo?.enviosConfirmados)
        ? String(data.resumo.enviosConfirmados) : "—");
      set("revAuto", status.whatsappAutoEnvioAtivo ? "Ativo" : "Desativado");
      avisos(data.avisos); exibir();
    } catch {
      avisos(["Não foi possível consultar a revisão. Nenhum arquivo ou configuração foi alterado."]);
      set("revObserved", "—"); set("revSent", "—"); set("revAuto", "—");
      fichas = []; exibir();
    }
  }
  for (const b of filtros) b.addEventListener("click", () => {
    filtro = b.dataset.revFilter;
    for (const button of filtros) button.setAttribute("aria-pressed", String(button === b));
    exibir();
  });
  id("revRefresh").addEventListener("click", atualizar);
  void atualizar();
})();