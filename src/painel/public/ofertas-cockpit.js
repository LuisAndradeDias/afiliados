/* Cockpit da Central de Ofertas. Interface local apenas. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const abas = ["contas","operacao","publicacao","diagnostico"];
  let estado = {}, filtro = "todos", pausado = false, textoLog = "", focoAnterior = null;
  const escrever = (id,txt) => {
    const e=$(id); if(e && e.textContent!==txt)e.textContent=txt;
  };
  const origem = valor => {
    const s=String(valor||"").toLowerCase();
    if(s.includes("mercado")||s.includes("meli"))return "Mercado Livre";
    if(s.includes("amazon"))return "Amazon";
    if(s.includes("shopee"))return "Shopee";
    return "";
  };
  const tarefas = s => Array.isArray(s.executando)?s.executando:[];
  function estadoHumano(s) {
    const em = name=>tarefas(s).includes(name);
    const atual=origem(s.operacaoPlataforma||s.ofertaPlataformaAtual||s.plataformaAtual);
    let title="Ciclo pausado",detail="Nenhuma busca automática em execução.",kind="paused";
    if(em("login")){
      title="Verificando WhatsApp e grupo";detail="Conferência de sessão sem enviar mensagens.";kind="working";
    }else if(s.whatsappEnvioPendente||s.operacaoEstado==="sending"){
      title="Aguardando confirmação do WhatsApp";detail="A mensagem precisa ser confirmada na conversa.";kind="waiting";
    }else if(em("preparar")||em("mercadolivre-whatsapp")||s.operacaoEstado==="preparing"){
      title="Preparando oferta para revisão";detail="Montando os dados da oferta antes da divulgação.";kind="working";
    }else if(s.ofertaPreparada && s.canalElegibilidade?.podePublicar!==true){
      title="Oferta pendente · envio bloqueado";
      detail=s.canalElegibilidade?.motivo||"O canal de destino ainda não está homologado.";
      kind="blocked";
    }else if(s.ofertaPreparada){
      title=s.whatsappRevisaoPronta?"Oferta pronta para revisão no WhatsApp":"Oferta preparada · aguardando revisão";
      detail="Confira os dados comerciais antes da divulgação.";kind="waiting";
    }else if(em("mercadolivre-buscar")||
      (s.operacaoEstado==="searching"&&atual==="Mercado Livre")||
      (s.operacaoEstado==="linking"&&atual==="Mercado Livre")){
      title=s.operacaoEstado==="linking"?"Validando link do Mercado Livre":"Buscando ofertas no Mercado Livre";
      detail="Consultando anúncios, preços e disponibilidade comprovados.";kind="working";
    }else if(em("buscar")||(s.operacaoEstado==="searching"&&atual==="Amazon")){
      title="Buscando ofertas na Amazon";detail="Analisando oportunidades com os filtros configurados.";kind="working";
    }else if(s.operacaoEstado==="searching"&&atual==="Shopee"){
      title="Buscando ofertas na Shopee";
      detail="Atividade informada pelo motor; consulte os logs para detalhes.";kind="working";
    }else if(s.operacaoEstado==="error"){
      title="Operação precisa de atenção";
      detail=s.mercadoLivreFluxoMensagem||"Consulte os logs para o diagnóstico.";kind="blocked";
    }else if(s.monitorAlternadoAtivo){
      title="Aguardando próxima busca";detail="Automação ativa, respeitando os intervalos.";kind="waiting";
    }
    return {title,detail,kind,atual:atual||"Sem fonte ativa",
      proxima:origem(s.monitorAlternadoProximaPlataforma)||"Não definida"};
  }
  function renderizarSituacao(s) {
    const a=estadoHumano(s);
    escrever("opsNowTitle",a.title);escrever("opsNowDetail",a.detail);
    escrever("opsNowSource",a.atual);escrever("opsNowNext",a.proxima);
    escrever("opsNowMode",s.monitorAlternadoAtivo?"Monitor ligado":"Monitor pausado");
    $("opsNowBanner").dataset.situacao=a.kind;
    const badge=$("cpvStatus");
    if(badge){badge.textContent=a.title;badge.title=a.detail;badge.dataset.situacao=a.kind;}
    escrever("opsChannelState",s.canalElegibilidade?.podePublicar===true
      ?"Envio disponível"
      :"Envio indisponível");
    escrever("opsSettingsRunState",s.monitorAlternadoAtivo?"Ciclo em execução":"Ciclo pausado");
    const modo=$("tempoCurtoButton")?.getAttribute("aria-pressed")==="true"?"curto":"medio";
    $("opsSettingsRhythmMedium")?.setAttribute("aria-pressed",String(modo==="medio"));
    $("opsSettingsRhythmShort")?.setAttribute("aria-pressed",String(modo==="curto"));
    const avisos=[];
    if(s.canalElegibilidade?.podePublicar===false)avisos.push("Envio indisponível para o destino atual");
    if(!s.whatsappAutoEnvioAtivo)avisos.push("Envio automático desativado");
    if(s.ofertaPreparada)avisos.push("Oferta preparada aguardando decisão");
    if(!avisos.length)avisos.push("Nenhuma pendência adicional informada");
    const list=$("opsAlerts");
    const key=avisos.join("|");
    if(list?.dataset.key!==key){
      list?.replaceChildren(...avisos.map(t=>{const li=document.createElement("li");li.textContent=t;return li;}));
      if(list)list.dataset.key=key;
    }
  }
  const linhas = s => Array.isArray(s.logs)
    ?s.logs.filter(t=>typeof t==="string").slice(-300):[];
  const parseLinha = linha => {
    const m=linha.match(/^\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.*)$/);
    return m?{time:m[1],source:m[2],message:m[3]}
      :{time:"",source:"Sistema",message:linha};
  };
  function logFiltrado(linha) {
    if(filtro==="todos")return true;
    const src=parseLinha(linha).source.toLowerCase();
    if(filtro==="mercadolivre")return /mercadolivre|meli|cupom/.test(src);
    if(filtro==="amazon")return /amazon|^buscar$/.test(src);
    if(filtro==="whatsapp")return /whatsapp|preparar|login|envio/.test(src);
    return /painel|monitor|automatico|intervalo|sistema/.test(src);
  }
  function renderizarTerminal(s,force=false) {
    if(pausado&&!force)return;
    const pre=$("logs");if(!pre)return;
    const filtradas=linhas(s).filter(logFiltrado).slice(-180);
    const conteudo=filtradas.length?filtradas.join("\n"):
      filtro==="todos"?"Aguardando registros da Central...":"Nenhum registro desta origem na amostra recente.";
    const noFim=pre.scrollTop+pre.clientHeight>=pre.scrollHeight-45;
    if(conteudo!==textoLog){
      textoLog=conteudo;pre.textContent=conteudo;
      if(force||noFim)pre.scrollTop=pre.scrollHeight;
    }
    escrever("opsLogCount",filtradas.length+" linhas");
    escrever("opsLogUpdated","Atualizado "+
      new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}));
  }
  function renderizarHistorico(s) {
    const list=$("opsHistoryList");if(!list)return;
    const items=linhas(s).map(parseLinha).filter(x=>
      /oferta|envi|bloque|buscar|busca|ciclo|iniciad|finalizad|erro|cupom|sess[aã]o/i
       .test(x.message+" "+x.source)).slice(-6).reverse();
    const key=items.map(x=>x.time+x.source+x.message).join("|");
    if(list.dataset.key===key)return;
    list.dataset.key=key;
    const children=items.map(item=>{
      const li=document.createElement("li"),meta=document.createElement("div"),
        t=document.createElement("time"),src=document.createElement("span"),p=document.createElement("p");
      meta.className="ops-history-meta";t.textContent=item.time||"—";src.textContent=item.source;
      p.textContent=item.message;meta.append(t,src);li.append(meta,p);return li;
    });
    if(!children.length){const li=document.createElement("li");
      li.textContent="Nenhum evento recente registrado nesta sessão.";children.push(li);}
    list.replaceChildren(...children);
    escrever("opsHistoryCount",items.length+" eventos");
  }
  function tab(aba) {
    if(!abas.includes(aba))return;
    for(const name of abas){
      const button=document.querySelector('[data-ops-settings-tab="'+name+'"]');
      const panel=$("opsSettingsPanel-"+name),active=name===aba;
      button?.setAttribute("aria-selected",String(active));
      button?.setAttribute("tabindex",active?"0":"-1");
      if(panel)panel.hidden=!active;
    }
  }
  function abrir(aba="contas") {
    const overlay=$("opsSettingsOverlay");if(!overlay)return;
    focoAnterior=document.activeElement instanceof HTMLElement?document.activeElement:null;
    tab(aba);overlay.hidden=false;
    document.body.classList.add("ops-drawer-open");$("opsSettingsClose")?.focus();
  }
  function fechar() {
    const overlay=$("opsSettingsOverlay");if(!overlay||overlay.hidden)return;
    overlay.hidden=true;document.body.classList.remove("ops-drawer-open");
    focoAnterior?.focus();
  }
  function montar() {
    const shell=document.querySelector("main.shell");
    if(!shell||$("opsNowBanner"))return;
    const refs=["launchCard","flowCard","reviewCard","instagramCard","logs"].map($);
    const caixas=[...shell.querySelectorAll("details.toolbox")];
    if(refs.some(x=>!x)||caixas.length!==3)return;
    const [launch,flow,review,instagram,logs]=refs;

    const banner=document.createElement("section");
    banner.id="opsNowBanner";banner.className="ops-now-banner";
    banner.setAttribute("aria-label","Situação atual da Central");
    banner.innerHTML=`
      <div class="ops-now-main">
        <span class="ops-kicker"><span class="ops-pulse" aria-hidden="true"></span> AGORA NA CENTRAL</span>
        <h2 id="opsNowTitle" aria-live="polite">Consultando operação...</h2>
        <p id="opsNowDetail">Lendo dados reais do painel.</p>
      </div>
      <div class="ops-now-stats">
        <div><span>Fonte atual</span><strong id="opsNowSource">—</strong></div>
        <div><span>Próxima fonte</span><strong id="opsNowNext">—</strong></div>
        <div><span>Ciclo</span><strong id="opsNowMode">Verificando</strong></div>
      </div>
      <button id="opsSettingsOpen" type="button" class="ops-settings-open" aria-haspopup="dialog"
        aria-controls="opsSettingsDialog"><span aria-hidden="true">⚙</span> Configurações</button>`;
    shell.insertBefore(banner,shell.querySelector(".health"));

    const grid=document.createElement("div"),main=document.createElement("div"),
      rail=document.createElement("aside");
    grid.className="ops-dashboard-layout";main.className="ops-dashboard-main";
    rail.className="ops-dashboard-rail";
    rail.setAttribute("aria-label","Acompanhamento operacional");
    [launch,flow,review,instagram].forEach(node=>main.appendChild(node));
    grid.append(main,rail);
    $("toast").insertAdjacentElement("afterend",grid);

    rail.innerHTML=`
      <section class="ops-terminal card" aria-label="Logs ao vivo">
        <header class="ops-panel-head">
          <div><span class="ops-terminal-led" aria-hidden="true"></span>
            <strong>Terminal ao vivo</strong><small>Registros reais da Central</small></div>
          <button id="opsLogPause" type="button" aria-pressed="false">Pausar</button>
        </header>
        <div class="ops-log-toolbar">
          <label for="opsLogFilter">Origem</label>
          <select id="opsLogFilter" aria-label="Filtrar logs por origem">
            <option value="todos">Todas</option><option value="amazon">Amazon</option>
            <option value="mercadolivre">Mercado Livre</option>
            <option value="whatsapp">WhatsApp</option><option value="sistema">Sistema</option>
          </select>
          <button id="opsLogsOpenFull" type="button" aria-expanded="false">Expandir</button>
        </div>
        <div id="opsConsole" class="ops-console-screen" role="log" aria-label="Log da operação"></div>
        <footer class="ops-console-foot"><span id="opsLogCount">0 linhas</span>
          <span id="opsLogUpdated">Aguardando dados</span></footer>
      </section>
      <section class="ops-recent card">
        <header class="ops-panel-head"><div><strong>Histórico recente</strong>
          <small>Eventos desta sessão, não histórico completo</small></div>
          <span id="opsHistoryCount">0 eventos</span></header>
        <ol id="opsHistoryList" class="ops-history-list"></ol>
      </section>
      <section class="ops-alerts card">
        <header class="ops-panel-head"><div><strong>Alertas operacionais</strong>
          <small>Informações do estado atual</small></div></header>
        <ul id="opsAlerts" class="ops-alert-list"></ul>
      </section>`;
    $("opsConsole").appendChild(logs);
    const overlay=document.createElement("div");
    overlay.id="opsSettingsOverlay";overlay.className="ops-settings-overlay";overlay.hidden=true;
    overlay.innerHTML=`
      <div class="ops-settings-backdrop" data-ops-dismiss></div>
      <section id="opsSettingsDialog" class="ops-settings-drawer" role="dialog"
          aria-modal="true" aria-label="Configurações da Central">
        <header class="ops-settings-head">
          <div><span class="ops-settings-kicker">CENTRAL DE OFERTAS</span>
            <h2>Configurações</h2>
            <p>Contas, operação, publicação e diagnóstico.</p></div>
          <button id="opsSettingsClose" type="button" aria-label="Fechar configurações">✕</button>
        </header>
        <nav class="ops-settings-tabs" role="tablist" aria-label="Áreas de configurações">
          <button role="tab" type="button" data-ops-settings-tab="contas"
            aria-controls="opsSettingsPanel-contas">Contas</button>
          <button role="tab" type="button" data-ops-settings-tab="operacao"
            aria-controls="opsSettingsPanel-operacao">Operação</button>
          <button role="tab" type="button" data-ops-settings-tab="publicacao"
            aria-controls="opsSettingsPanel-publicacao">Publicação</button>
          <button role="tab" type="button" data-ops-settings-tab="diagnostico"
            aria-controls="opsSettingsPanel-diagnostico">Diagnóstico</button>
        </nav>
        <div class="ops-settings-body">
          <section id="opsSettingsPanel-contas" role="tabpanel" class="ops-settings-panel"></section>
          <section id="opsSettingsPanel-operacao" role="tabpanel" class="ops-settings-panel" hidden>
            <div class="ops-settings-info">
              <h3>Ritmo do ciclo</h3>
              <p>Estes botões usam o mesmo controle do ciclo, sem duplicar a lógica operacional.</p>
              <strong id="opsSettingsRunState">Consultando ciclo...</strong>
              <div class="ops-rhythm-actions">
                <button id="opsSettingsRhythmMedium" type="button">Tempo médio</button>
                <button id="opsSettingsRhythmShort" type="button">Tempo curto</button>
              </div>
              <a id="opsSettingsGoCycle" href="#launchCard">Abrir controles completos do ciclo</a>
            </div>
          </section>
          <section id="opsSettingsPanel-publicacao" role="tabpanel" class="ops-settings-panel" hidden>
            <div class="ops-settings-info">
              <h3>Destino WhatsApp</h3>
              <p>Grupo usado pela Central para preparar a próxima oferta.</p>
              <strong id="opsChannelState">Consultando envio...</strong>
            </div>
            <div id="opsGroupConfigHost"></div>
          </section>
          <section id="opsSettingsPanel-diagnostico" role="tabpanel"
            class="ops-settings-panel" hidden></section>
        </div>
        <footer class="ops-settings-foot">Configurações locais da Central de Ofertas.</footer>
      </section>`;
    document.body.appendChild(overlay);
    const [tools,accounts,monitor]=caixas;
    const legacyHost=tools.parentElement;
    for(const [element,id] of [[accounts,"opsSettingsPanel-contas"],
        [tools,"opsSettingsPanel-diagnostico"],
        [monitor,"opsSettingsPanel-diagnostico"]]){
      element.open=true;element.classList.add("ops-moved-toolbox");
      $(id).appendChild(element);
    }
    // O contêiner anterior ficou vazio; remover somente o invólucro.
    if(legacyHost?.matches("section.section") &&
       !legacyHost.querySelector("details.toolbox"))legacyHost.remove();
    const advanced=$("whatsappDestination")?.querySelector(".group-advanced");
    if(advanced){
      advanced.open=true;
      $("opsGroupConfigHost").appendChild(advanced);
      const shortcut=document.createElement("button");
      shortcut.type="button";shortcut.id="opsGroupSettingsShortcut";
      shortcut.className="secondary ops-group-shortcut";
      shortcut.textContent="Alterar grupo nas configurações";
      shortcut.addEventListener("click",()=>abrir("publicacao"));
      $("openWhatsappConnectionButton")?.insertAdjacentElement("beforebegin",shortcut);
    }
    const setupButton=document.createElement("button");
    setupButton.id="opsPublishSetupButton";
    setupButton.type="button";
    setupButton.className="secondary ops-publish-checklist-button";
    setupButton.textContent="Configurar destino";
    setupButton.addEventListener("click",()=>abrir("publicacao"));
    const sendActions=$("reopenWhatsappButton")?.parentElement;
    if(sendActions) sendActions.prepend(setupButton);
    $("opsSettingsOpen").addEventListener("click",()=>abrir());
    $("opsSettingsClose").addEventListener("click",fechar);
    overlay.querySelector("[data-ops-dismiss]").addEventListener("click",fechar);
    overlay.querySelectorAll("[data-ops-settings-tab]").forEach(btn=>{
      btn.addEventListener("click",()=>tab(btn.dataset.opsSettingsTab));
      btn.addEventListener("keydown",event=>{
        if(!["ArrowLeft","ArrowRight"].includes(event.key))return;
        event.preventDefault();
        const i=abas.indexOf(btn.dataset.opsSettingsTab);
        const next=abas[(i+(event.key==="ArrowRight"?1:-1)+abas.length)%abas.length];
        tab(next);overlay.querySelector('[data-ops-settings-tab="'+next+'"]')?.focus();
      });
    });
    document.addEventListener("keydown",event=>{
      if(overlay.hidden)return;
      if(event.key==="Escape"){event.preventDefault();fechar();return;}
      if(event.key!=="Tab")return;
      const focusables=[...overlay.querySelectorAll(
        'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled])'
      )].filter(x=>x.getClientRects().length>0);
      if(!focusables.length)return;
      if(event.shiftKey&&document.activeElement===focusables[0]){
        event.preventDefault();focusables.at(-1).focus();
      }else if(!event.shiftKey&&document.activeElement===focusables.at(-1)){
        event.preventDefault();focusables[0].focus();
      }
    });
    $("opsSettingsGoCycle").addEventListener("click",fechar);
    $("opsSettingsRhythmMedium").addEventListener("click",()=>$("tempoMedioButton")?.click());
    $("opsSettingsRhythmShort").addEventListener("click",()=>$("tempoCurtoButton")?.click());
    $("opsLogFilter").addEventListener("change",e=>{
      filtro=e.target.value;renderizarTerminal(estado,true);
    });
    $("opsLogPause").addEventListener("click",()=>{
      pausado=!pausado;$("opsLogPause").setAttribute("aria-pressed",String(pausado));
      escrever("opsLogPause",pausado?"Retomar":"Pausar");
      if(pausado)escrever("opsLogUpdated","Visualização pausada");
      else renderizarTerminal(estado,true);
    });
    $("opsLogsOpenFull").addEventListener("click",()=>{
      const expanded=rail.classList.toggle("ops-console-expanded");
      escrever("opsLogsOpenFull",expanded?"Reduzir":"Expandir");
      $("opsLogsOpenFull").setAttribute("aria-expanded",String(expanded));
    });
    tab("contas");
    window.cpvCockpit={
      update(s){
        estado=s||{};
        renderizarSituacao(estado);
        renderizarHistorico(estado);
        renderizarTerminal(estado);
      },
      offline(){
        escrever("opsNowTitle","Sem conexão com a Central");
        escrever("opsNowDetail","Não foi possível consultar a operação agora.");
        $("opsNowBanner").dataset.situacao="blocked";
      }
    };
    // Uma leitura inicial; o refresh original permanece o único polling periódico.
    fetch("/api/status",{cache:"no-store"})
      .then(resp=>{if(!resp.ok)throw Error("API");return resp.json();})
      .then(s=>window.cpvCockpit.update(s))
      .catch(()=>window.cpvCockpit.offline());
  }
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",montar,{once:true});
  }else montar();
})();
