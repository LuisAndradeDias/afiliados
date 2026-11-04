/* Dashboard somente leitura. Não escreve arquivos, não publica e não inicia monitores. */
(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const sidebar = byId("sidebar"), scrim = byId("scrim"), menu = byId("menuBtn");
  const mobileMenu = open => {
    sidebar.classList.toggle("open", open);
    scrim.hidden = !open;
    scrim.classList.toggle("open", open);
    menu.setAttribute("aria-expanded", String(open));
  };
  menu.addEventListener("click", () => mobileMenu(!sidebar.classList.contains("open")));
  scrim.addEventListener("click", () => mobileMenu(false));
  document.addEventListener("keydown", event => { if (event.key === "Escape") mobileMenu(false); });
  const estadoHumano = {
    paused: "Pausado", scheduled: "Agendado", searching: "Buscando",
    linking: "Gerando link", preparing: "Preparando", review: "Revisão",
    sending: "Confirmando envio", "offer-pending": "Oferta pendente",
    error: "Atenção"
  };
  function preenchimento(id, valor) { const item = byId(id); if (item) item.textContent = valor; }
  function resumo(s) {
    preenchimento("monitor", s.monitorAlternadoAtivo ? "Ativo" : "Pausado");
    preenchimento("flow", estadoHumano[s.operacaoEstado] || "Não informado");
    preenchimento("next", s.monitorAlternadoProximaPlataforma === "mercado-livre"
      ? "Mercado Livre" : s.monitorAlternadoProximaPlataforma === "amazon" ? "Amazon" : "—");
    preenchimento("review", s.ofertaPreparada ? "Pendente" : "Nenhuma");
    preenchimento("metricAutoSend", s.whatsappAutoEnvioAtivo ? "Ativo" : "Desativado");
    preenchimento("metricCouponsObserved", Number.isSafeInteger(s.mercadoLivreCuponsTotal)
      ? String(s.mercadoLivreCuponsTotal) : "—");
    preenchimento("metricCouponsNote", Number.isSafeInteger(s.mercadoLivreCuponsAtivos)
      ? s.mercadoLivreCuponsAtivos + " campanha(s) potencialmente ativa(s); validar por oferta"
      : "Campanhas não confirmadas");
    const aviso = s.operacaoEstado === "error"
      ? (s.mercadoLivreFluxoMensagem || "O motor reporta um erro. Verifique o painel de ofertas.")
      : s.ofertaPreparada ? "Há uma oferta preparada, ainda não confirmada como enviada."
      : "Conexão local estabelecida. Sem publicação acionada por esta página.";
    preenchimento("centralHealth", aviso);
    preenchimento("headerState", s.operacaoEstado === "error" ? "Motor requer atenção" : "Central conectada");
  }
  async function carregarEstado() {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      if (!res.ok) throw new Error("API indisponível");
      resumo(await res.json());
    } catch {
      preenchimento("headerState", "Motor indisponível");
      preenchimento("monitor", "Indisponível");
      preenchimento("centralHealth", "Não foi possível consultar a Central. Tente atualizar a página.");
    }
  }
  async function carregarHistorico() {
    try {
      const res = await fetch("/api/revisao", { cache: "no-store" });
      if (!res.ok) throw new Error("Histórico indisponível");
      const json = await res.json();
      const total = json.resumo?.enviosConfirmados;
      preenchimento("metricConfirmed", Number.isSafeInteger(total) ? String(total) : "—");
      const iso = json.resumo?.ultimoEnvioEm;
      preenchimento("metricConfirmedNote", iso && Number.isFinite(Date.parse(iso))
        ? "Última confirmação: " + new Date(iso).toLocaleString("pt-BR")
        : "Somente envios registrados com confirmação");
    } catch {
      preenchimento("metricConfirmed", "—");
      preenchimento("metricConfirmedNote", "Histórico local indisponível");
    }
  }
  void carregarEstado();
  void carregarHistorico();
  setInterval(carregarEstado, 8000);
  setInterval(carregarHistorico, 15000);
})();