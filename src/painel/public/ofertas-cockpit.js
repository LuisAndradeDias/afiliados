/**
 * UX-03 | Cockpit operacional. Somente apresentação, sem novas ações de escrita.
 * Reorganiza NÓS já existentes, sem clonar IDs, botões nem listeners.
 * Única fonte de atualizações: evento cpv:status da atualização original.
 */
(() => {
  "use strict";

  const main = document.querySelector("main.shell");
  const hero = document.querySelector(".hero .hero-inner");
  if (!main || !hero || document.getElementById("cpvOpsPanel")) return;
  document.body.classList.add("cpv-ux03");
  const byId = id => document.getElementById(id);
  // Proteger valores ainda não salvos contra o refresh de status da UI antiga.
  for (const id of ["amazonTag", "mlAffiliateLink"]) {
    const field = byId(id);
    field?.addEventListener("input", () => { field.dataset.cpvDirty = "true"; });
  }
  const create = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const label = (id, text) => {
    const el = byId(id);
    if (el && el.textContent !== String(text ?? "")) el.textContent = String(text ?? "");
  };

  // 1. Cabeçalho com configurações sempre no mesmo lugar.
  const actions = create("div", "cpv-header-actions");
  const settingsButton = create("button", "cpv-settings-trigger", "⚙  Configurações");
  settingsButton.id = "cpvSettingsButton";
  settingsButton.type = "button";
  settingsButton.setAttribute("aria-haspopup", "dialog");
  settingsButton.setAttribute("aria-controls", "cpvSettingsDialog");
  const consoleButton = create("button", "cpv-console-jump", "Ver console");
  consoleButton.type = "button";
  consoleButton.id = "cpvConsoleJump";
  actions.append(settingsButton, consoleButton);
  hero.append(actions);

  // 2. Realce do trabalho real. Nunca deduz publicação somente por clique.
  const status = create("section", "cpv-live-banner");
  status.id = "cpvOpsPanel";
  status.setAttribute("role", "region");
  status.setAttribute("aria-label", "O que o robô está fazendo agora");
  status.dataset.state = "loading";
  status.innerHTML = [
    '<div class="cpv-live-symbol" aria-hidden="true">◉</div>',
    '<div class="cpv-live-main">',
    '  <div class="cpv-live-overline"><span id="cpvLiveDot" class="cpv-live-dot"></span> CENTRAL EM TEMPO REAL <span id="cpvLiveState">CONSULTANDO</span></div>',
    '  <h2 id="cpvLiveTitle" aria-live="polite" aria-atomic="true">Consultando o estado da operação…</h2>',
    '  <p id="cpvOpsDetail">Aguardando retorno do motor local.</p>',
    '  <div class="cpv-live-tags">',
    '    <span>Fonte: <b id="cpvOpsSource">—</b></span>',
    '    <span>Próxima: <b id="cpvOpsNext">—</b></span>',
    '    <span>WhatsApp: <b id="cpvOpsWhatsapp">—</b></span>',
    '  </div>',
    '</div>',
    '<div class="cpv-live-aside">',
    '  <span id="cpvOpsPill" class="cpv-live-pill">Verificando</span>',
    '  <span id="cpvLiveClock" class="cpv-live-clock">Aguardando atualização</span>',
    '</div>',
    '<span id="cpvOpsCoupons" class="cpv-sr-only">—</span>'
  ].join("");
  const toast = byId("toast");
  if (toast) toast.after(status);
  else main.prepend(status);

  // 3. Mesma operação original, agora com telemetria à direita.
  const layout = create("div", "cpv-work-layout");
  const primary = create("div", "cpv-work-primary");
  const side = create("aside", "cpv-work-aside");
  side.setAttribute("aria-label", "Console e linha do tempo");
  layout.append(primary, side);
  status.after(layout);
  for (const selector of ["#launchCard", ".health", "#flowCard", "#reviewCard"]) {
    const node = main.querySelector(selector);
    if (node) primary.append(node);
  }
  // Quarta plataforma como atalho de consulta, sem afirmar que a API foi conectada.
  const health = primary.querySelector(".health");
  if (health && !health.querySelector(".cpv-health-shopee")) {
    const card = create("a", "health-item cpv-health-shopee");
    card.href = "/shopee";
    card.innerHTML = '<span class="cpv-health-shopee-icon" aria-hidden="true">S</span>' +
      '<span class="health-copy"><small>Shopee</small><strong>Ver integração ↗</strong></span>';
    health.append(card);
  }

  const terminal = create("section", "cpv-terminal");
  terminal.id = "cpvTerminal";
  terminal.innerHTML = [
    '<div class="cpv-terminal-header">',
    '  <div class="cpv-terminal-title"><span class="cpv-terminal-lights" aria-hidden="true">● ● ●</span>',
    '    <strong>Console da operação</strong><small>Eventos reais do motor</small></div>',
    '  <span id="cpvTerminalConnection" class="cpv-terminal-online">Consultando</span>',
    '</div>',
    '<div class="cpv-terminal-controls">',
    '  <label for="cpvTerminalFilter">Fonte</label>',
    '  <select id="cpvTerminalFilter">',
    '    <option value="all">Todas</option>',
    '    <option value="amazon">Amazon</option>',
    '    <option value="meli">Mercado Livre</option>',
    '    <option value="whatsapp">WhatsApp</option>',
    '    <option value="system">Sistema</option>',
    '  </select>',
    '  <button type="button" id="cpvTerminalPause" aria-pressed="false">Pausar</button>',
    '</div>',
    '<pre id="cpvTerminalOutput" class="cpv-terminal-body" tabindex="0" aria-label="Últimos logs do motor">Aguardando registros reais…</pre>',
    '<div class="cpv-terminal-footer">',
    '  <span id="cpvTerminalCount">0 linhas</span>',
    '  <span id="cpvTerminalMode">Atualização automática</span>',
    '</div>'
  ].join("");
  const history = create("section", "cpv-history");
  history.id = "cpvHistory";
  history.innerHTML = [
    '<div class="cpv-history-head"><div><span class="cpv-side-kicker">HISTÓRICO RECENTE</span>',
    '  <h3>Linha do tempo</h3></div>',
    '  <a href="/revisao" class="cpv-history-link">Abrir revisão ↗</a></div>',
    '<p>Eventos observados nos logs atuais; não representam todo o histórico persistido.</p>',
    '<ol id="cpvHistoryItems" class="cpv-history-list"><li>Consultando eventos…</li></ol>',
    '<div id="cpvLastConfirmed" class="cpv-last-confirmed">Último envio: verificando registro.</div>'
  ].join("");
  const quick = create("section", "cpv-side-quick");
  quick.innerHTML = [
    '<span class="cpv-side-kicker">CONTROLE DA CENTRAL</span>',
    '<strong>Configurações em um lugar só</strong>',
    '<p>Contas, monitoramento, integrações e ferramentas, sem alterar automaticamente nenhuma opção.</p>'
  ].join("");
  const quickSettings = create("button", "cpv-side-settings", "Abrir configurações");
  quickSettings.type = "button";
  quick.append(quickSettings);
  side.append(terminal, history, quick);

  // 4. Drawer acessível, reaproveitando os três blocos ORIGINAIS.
  const scrim = create("div", "cpv-settings-backdrop");
  scrim.id = "cpvSettingsBackdrop";
  scrim.hidden = true;
  const dialog = create("aside", "cpv-settings-dialog");
  dialog.id = "cpvSettingsDialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "cpvSettingsTitle");
  dialog.hidden = true;

  const drawerHead = create("div", "cpv-settings-head");
  const titleWrap = create("div", "");
  titleWrap.append(create("span", "cpv-side-kicker", "CENTRAL UNIFICADA"),
    create("h2", "", "Configurações"));
  titleWrap.querySelector("h2").id = "cpvSettingsTitle";
  const close = create("button", "cpv-settings-close", "✕");
  close.id = "cpvSettingsClose";
  close.type = "button";
  close.setAttribute("aria-label", "Fechar configurações");
  drawerHead.append(titleWrap, close);

  const desc = create("p", "cpv-settings-hint",
    "Altere somente o necessário. Abrir esta tela não modifica a operação.");
  const tabs = create("div", "cpv-settings-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Seções de configuração");
  const body = create("div", "cpv-settings-content");
  const tabDefs = [
    { key: "contas", label: "Contas e conexões", oldIndex: 1 },
    { key: "monitor", label: "Monitoramento", oldIndex: 2 },
    { key: "ferramentas", label: "Ferramentas", oldIndex: 0 }
  ];
  const originalDetails = [...main.querySelectorAll("details.toolbox")];
  const originalWrapper = originalDetails[0]?.parentElement;
  for (const def of tabDefs) {
    const tab = create("button", "cpv-settings-tab", def.label);
    tab.id = "cpvSettingsTab-" + def.key;
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", "cpvSettingsPage-" + def.key);
    tab.dataset.tab = def.key;
    const panel = create("section", "cpv-settings-page");
    panel.id = "cpvSettingsPage-" + def.key;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
    panel.hidden = true;
    const original = originalDetails[def.oldIndex];
    if (original) {
      original.open = true;
      original.classList.add("cpv-settings-original");
      panel.append(original);
    }
    if (def.key === "monitor") {
      const guard = create("div", "cpv-settings-rules");
      guard.innerHTML = [
        '<h3>Regras aplicadas pelo motor</h3>',
        '<p>Indicadores somente leitura. Ritmos antigos de outros ramos não foram reativados.</p>',
        '<div class="cpv-rule-stats">',
        '  <div><small>Desconto mínimo</small><strong id="cpvRuleDiscount">—</strong></div>',
        '  <div><small>Cooldown de envio</small><strong id="cpvRuleCooldown">—</strong></div>',
        '  <div><small>Intervalo de prévia</small><strong id="cpvRulePreview">—</strong></div>',
        '  <div><small>Cadência do ciclo</small><strong id="cpvRuleCadence">—</strong></div>',
        '</div>'
      ].join("");
      panel.prepend(guard);
      panel.append(create("p", "cpv-logs-hint",
        "Os registros completos da sessão podem ser acompanhados no Console da operação; abrir esta aba não limpa nem pausa os logs."));
    }
    tabs.append(tab);
    body.append(panel);
  }
  if (originalWrapper && originalWrapper.children.length === 0) originalWrapper.remove();
  const drawerFoot = create("div", "cpv-settings-foot",
    "Ações de limpar histórico ou parar monitor precisam ser acionadas explicitamente.");
  dialog.append(drawerHead, desc, tabs, body, drawerFoot);
  document.body.append(scrim, dialog);

  let lastFocus = null, currentTab = "contas";
  const activateTab = key => {
    currentTab = key;
    for (const def of tabDefs) {
      const chosen = def.key === key;
      const tab = byId("cpvSettingsTab-" + def.key);
      const panel = byId("cpvSettingsPage-" + def.key);
      if (tab) {
        tab.setAttribute("aria-selected", String(chosen));
        tab.tabIndex = chosen ? 0 : -1;
        tab.classList.toggle("active", chosen);
      }
      if (panel) panel.hidden = !chosen;
    }
  };
  const closeSettings = () => {
    if (dialog.hidden) return;
    dialog.hidden = true;
    scrim.hidden = true;
    document.body.classList.remove("cpv-settings-open");
    if (lastFocus?.isConnected) lastFocus.focus();
  };
  const openSettings = (key = "contas") => {
    lastFocus = document.activeElement;
    activateTab(key);
    dialog.hidden = false;
    scrim.hidden = false;
    document.body.classList.add("cpv-settings-open");
    close.focus();
  };
  settingsButton.addEventListener("click", () => openSettings());
  quickSettings.addEventListener("click", () => openSettings());
  close.addEventListener("click", closeSettings);
  scrim.addEventListener("click", closeSettings);
  for (const button of tabs.querySelectorAll("button")) {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  }
  tabs.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = tabDefs.findIndex(def => def.key === currentTab);
    const nextIndex = event.key === "Home" ? 0 :
      event.key === "End" ? tabDefs.length - 1 :
      (index + (event.key === "ArrowRight" ? 1 : -1) + tabDefs.length) % tabDefs.length;
    activateTab(tabDefs[nextIndex].key);
    byId("cpvSettingsTab-" + currentTab).focus();
  });
  document.addEventListener("keydown", event => {
    if (dialog.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault(); closeSettings();
    } else if (event.key === "Tab") {
      const focusable = [...dialog.querySelectorAll(
        'button:not([disabled]):not([hidden]),a[href],input:not([disabled]),select:not([disabled])'
      )].filter(node => node.getClientRects().length && node.closest("[hidden]") === null);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
  });
  activateTab("contas");
  consoleButton.addEventListener("click", () =>
    terminal.scrollIntoView({ behavior: "smooth", block: "start" })
  );

  const sourceName = raw => {
    const val = String(raw ?? "").toLowerCase();
    if (val.includes("mercado") || val.includes("meli")) return "Mercado Livre";
    if (val.includes("amazon")) return "Amazon";
    if (val.includes("shopee")) return "Shopee";
    return "Não informada";
  };
  const redact = raw => String(raw)
    .replace(/(bearer\s+)[^\s"'<>]+/gi, "$1[REDACTED]")
    .replace(/((?:client.?secret|secret.?key|access.?token|refresh.?token|acesso.?token|authorization|senha|password)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/(https?:\/\/[^\s]*?(?:access_token|refresh_token|client_secret)=)[^&\s]+/gi, "$1[REDACTED]");
  const logClass = line => {
    const val = String(line).toLowerCase();
    if (/whatsapp|envio|preparar/.test(val)) return "whatsapp";
    if (/mercado.?livre|\bmeli\b|\bml-/.test(val)) return "meli";
    if (/amazon/.test(val)) return "amazon";
    return "system";
  };
  const isEvent = line =>
    /conclu[ií]|confirmad|enviad|iniciad|iniciando|oferta|buscand|busca|erro|falha|pausad|cupom|bloquead/i.test(line);
  const clock = ms => {
    if (!Number.isFinite(Number(ms)) || Number(ms) <= 0) return null;
    const t = new Date(Number(ms));
    return Number.isNaN(t.getTime()) ? null : t.toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
    });
  };

  let paused = false, filter = "all", latest = [], lastState = null;
  const output = byId("cpvTerminalOutput");
  const terminalPause = byId("cpvTerminalPause");
  const terminalFilter = byId("cpvTerminalFilter");

  const paintTerminal = () => {
    if (paused) return;
    const atBottom = output.scrollHeight - output.clientHeight - output.scrollTop < 60;
    const selected = latest.filter(line => filter === "all" || logClass(line) === filter).slice(-65);
    const lines = selected.length
      ? selected.map(line => "› " + redact(line)).join("\n")
      : latest.length
        ? "Nenhum evento corresponde ao filtro selecionado."
        : "Nenhum registro recente informado pelo motor.";
    if (output.textContent !== lines) output.textContent = lines;
    label("cpvTerminalCount", selected.length + " linha(s)");
    if (atBottom || output.scrollTop === 0) output.scrollTop = output.scrollHeight;
  };
  terminalFilter.addEventListener("change", () => {
    filter = terminalFilter.value;
    paintTerminal();
  });
  terminalPause.addEventListener("click", () => {
    paused = !paused;
    terminalPause.textContent = paused ? "Retomar" : "Pausar";
    terminalPause.setAttribute("aria-pressed", String(paused));
    label("cpvTerminalMode", paused ? "Visualização pausada · dados não pararam" : "Atualização automática");
    if (!paused) paintTerminal();
  });

  let lastHistorySignature = "";
  const paintHistory = s => {
    const events = latest.filter(isEvent).slice(-5).reverse();
    const signature = JSON.stringify([events, s.ultimoEnvioConcluidoEm ?? null]);
    if (signature === lastHistorySignature) return;
    lastHistorySignature = signature;
    const list = byId("cpvHistoryItems");
    list.replaceChildren();
    if (!events.length) {
      list.append(create("li", "cpv-history-empty", "Nenhum evento recente disponível."));
    } else {
      for (const line of events) {
        const item = create("li", "cpv-history-item");
        const mark = create("span", "cpv-history-mark");
        mark.setAttribute("aria-hidden", "true");
        const body = create("div", "cpv-history-event");
        const kind = logClass(line);
        body.append(create("small", "", kind === "meli" ? "MERCADO LIVRE" :
          kind === "amazon" ? "AMAZON" : kind === "whatsapp" ? "WHATSAPP" : "SISTEMA"));
        body.append(create("span", "", redact(line).replace(/^\[[^\]]+\]\s*(?:\[[^\]]+\]\s*)?/, "").slice(0, 178)));
        item.append(mark, body);
        list.append(item);
      }
    }
    const confirmed = clock(s.ultimoEnvioConcluidoEm);
    label("cpvLastConfirmed", confirmed
      ? "Último envio confirmado pelo motor: " + confirmed + "."
      : "Nenhum horário de envio confirmado foi informado.");
  };

  const deriveState = s => {
    const jobs = Array.isArray(s.executando) ? s.executando.map(x => String(x).toLowerCase()) : [];
    const state = String(s.operacaoEstado || (s.monitorAlternadoAtivo ? "scheduled" : "paused"));
    const platform = sourceName(s.operacaoPlataforma || s.ofertaPlataformaAtual ||
      s.plataformaAtual || (jobs.some(x => x.includes("mercado")) ? "mercado-livre" :
      jobs.some(x => x.includes("amazon") || x === "buscar") ? "amazon" : ""));
    const next = sourceName(s.monitorAlternadoProximaPlataforma);
    const pending = s.whatsappEnvioPendente || state === "sending";
    const exists = Boolean(s.ofertaPreparada || s.mensagem);
    const isSearching = state === "searching" ||
      jobs.some(x => x.includes("buscar") || x.includes("automatico"));
    const errorNoOffer = state === "error" &&
      /(?:nenhuma oferta|n[aã]o encontrou ofertas|sem ofertas eleg[ií]veis)/i.test(String(s.mercadoLivreFluxoMensagem || ""));
    if (pending) return {
      heading: "Aguardando confirmação do WhatsApp",
      detail: "O envio só será considerado concluído após confirmação real do aplicativo.",
      pill: "CONFIRMAÇÃO PENDENTE", tone: "attention", platform, next
    };
    if (exists && (state === "offer-pending" || state === "review" || s.whatsappRevisaoPronta)) return {
      heading: "Oferta preparada · revisão pendente",
      detail: s.whatsappRevisaoPronta
        ? "A oferta está aberta para revisão no WhatsApp. Confira o destino antes de enviar."
        : "Existe uma oferta pendente. Confira os controles e as restrições antes de reabrir ou enviar.",
      pill: "AÇÃO NECESSÁRIA", tone: "attention", platform, next
    };
    if (state === "preparing" || jobs.some(x => x.includes("preparar") || x === "login")) return {
      heading: "Preparando a oferta no WhatsApp",
      detail: "Montando a imagem e a mensagem; ainda não há envio confirmado.",
      pill: "PREPARANDO", tone: "working", platform, next
    };
    if (state === "linking") return {
      heading: "Validando link de afiliado",
      detail: "Aguardando a integração concluir a geração do link oficial.",
      pill: "EM ANDAMENTO", tone: "working", platform, next
    };
    if (isSearching) return {
      heading: platform !== "Não informada" ? "Buscando ofertas · " + platform :
        "Buscando ofertas nas plataformas",
      detail: "Aplicando os filtros e as verificações de ofertas do motor.",
      pill: "BUSCA EM ANDAMENTO", tone: "working", platform, next
    };
    const bloqueio = s.mercadoLivreBuscaBloqueio;
    if (bloqueio && Number(bloqueio.ate) > Date.now()) return {
      heading: bloqueio.tipo === "permissao"
        ? "Mercado Livre: acesso negado pela API"
        : "Mercado Livre: limite da API atingido",
      detail: bloqueio.mensagem + " Nova tentativa permitida apos " +
        new Date(Number(bloqueio.ate)).toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"}) + ".",
      pill: bloqueio.tipo === "permissao" ? "ACESSO NEGADO (403)" : "AGUARDANDO API (429)",
      tone: "attention", platform: "Mercado Livre", next
    };
    if (errorNoOffer) return {
      heading: "Última busca sem ofertas elegíveis",
      detail: "O Mercado Livre concluiu a rodada sem encontrar ofertas que atendam aos filtros atuais.",
      pill: "SEM OFERTAS", tone: "neutral", platform: "Mercado Livre", next
    };
    if (state === "error") return {
      heading: "A última operação requer atenção",
      detail: "Consulte os registros no console para identificar o que o motor informou.",
      pill: "VERIFICAR LOGS", tone: "attention", platform, next
    };
    if (s.monitorAlternadoAtivo) return {
      heading: "Aguardando a próxima busca",
      detail: next !== "Não informada"
        ? "O monitor está ativo. Próxima plataforma prevista: " + next + "."
        : "O monitor está ativo e segue o agendamento do motor.",
      pill: "MONITOR ATIVO", tone: "scheduled", platform, next
    };
    return {
      heading: "Automação pausada",
      detail: "Nenhuma busca automática em andamento. Use o controle principal para iniciar quando desejar.",
      pill: "PAUSADO", tone: "neutral", platform: "Nenhuma", next
    };
  };

  const render = s => {
    if (!s || typeof s !== "object") return;
    lastState = s;
    const state = deriveState(s);
    status.dataset.state = state.tone;
    label("cpvLiveTitle", state.heading);
    label("cpvOpsDetail", state.detail);
    label("cpvOpsPill", state.pill);
    label("cpvLiveState", state.pill);
    label("cpvOpsSource", state.platform);
    label("cpvOpsNext", s.monitorAlternadoAtivo ? state.next : "Ciclo pausado");
    label("cpvOpsWhatsapp", s.whatsappAutoEnvioAtivo ? "Autoenvio ativo" : "Envio supervisionado");
    label("cpvOpsCoupons", Number.isSafeInteger(s.mercadoLivreCuponsTotal)
      ? String(s.mercadoLivreCuponsTotal) : "Não informado");
    label("cpvLiveClock", "Atualizado às " + new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    }));
    label("cpvTerminalConnection", "Dados recebidos");
    latest = Array.isArray(s.logs) ? s.logs.filter(x => typeof x === "string").slice(-120) : [];
    paintTerminal();
    paintHistory(s);
    label("cpvRuleDiscount", Number.isFinite(Number(s.descontoMinimo)) ? s.descontoMinimo + "%" : "—");
    label("cpvRuleCooldown", Number.isFinite(Number(s.cooldownHoras)) ? s.cooldownHoras + " h" : "—");
    label("cpvRulePreview", Number.isFinite(Number(s.previewCooldownMinutos))
      ? s.previewCooldownMinutos + " min" : "—");
    label("cpvRuleCadence", Number.isFinite(Number(s.monitorAlternadoSlotSegundos))
      ? s.monitorAlternadoSlotSegundos + " s por slot" : "Não informada");
    const review = byId("reviewCard");
    if (review) review.classList.toggle("cpv-without-image", !s.imagemUrl);
  };
  const unavailable = () => {
    status.dataset.state = "attention";
    label("cpvLiveTitle", "Estado da operação indisponível");
    label("cpvOpsDetail", "Falha ao consultar os dados locais. Nenhuma ação foi executada.");
    label("cpvOpsPill", "SEM RESPOSTA");
    label("cpvLiveState", "SEM RESPOSTA");
    label("cpvTerminalConnection", "Sem conexão");
    label("cpvLiveClock", "Sem atualização recente");
  };
  document.addEventListener("cpv:status", event => render(event.detail));
  document.addEventListener("cpv:status-error", unavailable);

  // Primeira leitura sem esperar o primeiro ciclo de atualização do painel.
  fetch("/api/status", { cache: "no-store" })
    .then(res => { if (!res.ok) throw new Error("HTTP status"); return res.json(); })
    .then(render).catch(unavailable);
})();
