/* Cockpit técnico de leitura. Não escreve configurações, não envia mensagens. */
(() => {
  "use strict";
  const main = document.querySelector("main");
  if (!main || document.getElementById("cpvOpsPanel")) return;
  const section = document.createElement("section");
  section.id = "cpvOpsPanel";
  section.className = "cpv-ops-panel";
  section.setAttribute("aria-label", "Cockpit da operação atual");
  section.innerHTML = [
    '<div class="cpv-ops-header"><div><strong>Agora na Central</strong>',
    '<p id="cpvOpsDetail">Consultando o motor local...</p></div>',
    '<span id="cpvOpsPill" class="cpv-ops-pill" data-state="working">Verificando</span></div>',
    '<div class="cpv-ops-metrics">',
    '<div class="cpv-ops-metric"><span>Fonte atual</span><strong id="cpvOpsSource">—</strong></div>',
    '<div class="cpv-ops-metric"><span>Próxima busca</span><strong id="cpvOpsNext">—</strong></div>',
    '<div class="cpv-ops-metric"><span>WhatsApp</span><strong id="cpvOpsWhatsapp">—</strong></div>',
    '<div class="cpv-ops-metric"><span>Cupons observados</span><strong id="cpvOpsCoupons">—</strong></div></div>',
    '<details class="cpv-ops-logs"><summary>Últimos registros do motor</summary>',
    '<pre id="cpvOpsLogs">Nenhum registro consultado.</pre></details>'
  ].join("");
  // O controle do ciclo e a oferta vêm antes do diagnóstico auxiliar.
  const launch = main.querySelector("#launchCard");
  const health = main.querySelector(".health");
  if (launch && health) main.insertBefore(launch, health);
  const review = main.querySelector("#reviewCard");
  if (review) review.after(section);
  else main.append(section);
  const get = id => document.getElementById(id);
  const put = (id, value) => { const el = get(id); if (el) el.textContent = value; };
  const fonte = s => {
    const t = String(s || "").toLowerCase();
    if (t.includes("mercado") || t === "meli") return "Mercado Livre";
    if (t.includes("amazon")) return "Amazon";
    return "Nenhuma";
  };
  async function render() {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      if (!res.ok) throw new Error("Central indisponível");
      const s = await res.json();
      const state = String(s.operacaoEstado || "paused");
      const states = {
        paused: "Pausado", scheduled: "Aguardando", searching: "Buscando",
        linking: "Gerando link", preparing: "Preparando", review: "Em revisão",
        sending: "Confirmando", "offer-pending": "Oferta pendente", error: "Atenção"
      };
      const pill = get("cpvOpsPill");
      if (pill) pill.dataset.state = state === "error" ? "warning" :
        ["searching", "linking", "preparing", "review", "sending"].includes(state) ? "working" : "online";
      put("cpvOpsPill", states[state] || "Consultando");
      put("cpvOpsSource", fonte(s.operacaoPlataforma || s.ofertaPlataformaAtual || s.plataformaAtual));
      put("cpvOpsNext", s.monitorAlternadoAtivo
        ? fonte(s.monitorAlternadoProximaPlataforma) : "Monitor pausado");
      put("cpvOpsWhatsapp", s.whatsappAutoEnvioAtivo ? "Autoenvio ativo" : "Envio supervisionado");
      put("cpvOpsCoupons", Number.isSafeInteger(s.mercadoLivreCuponsTotal)
        ? String(s.mercadoLivreCuponsTotal) : "—");
      const detail = state === "error"
        ? (s.mercadoLivreFluxoMensagem || "Verifique o diagnóstico e os registros.")
        : s.ofertaPreparada ? "Existe uma oferta preparada; o histórico depende da confirmação real."
        : s.monitorAlternadoAtivo ? "O monitor está ativo e segue o agendamento atual."
        : "Monitor pausado. Nenhuma busca é iniciada pelo cockpit.";
      put("cpvOpsDetail", detail);
      const lines = Array.isArray(s.logs) ? s.logs.filter(x => typeof x === "string").slice(-40) : [];
      put("cpvOpsLogs", lines.length ? lines.join("\n") : "Nenhum registro recente.");
    } catch {
      put("cpvOpsPill", "Indisponível");
      put("cpvOpsDetail", "Não foi possível consultar o estado. Os controles originais permanecem no painel.");
    }
  }
  void render();
  setInterval(render, 6000);
})();