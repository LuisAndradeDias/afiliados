const css = `
:root{color-scheme:dark;--bg:#051923;--panel:#0b2935;--panel2:#0e3440;--stroke:#2c535e;--mint:#73edc6;--soft:#a9c5cc;--gold:#dfc485;--white:#f2faf8;--danger:#eaa49d}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at 100% 0,#104744 0,transparent 36%),var(--bg);color:var(--white);font:14px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;min-height:100vh}
button,input,textarea{font:inherit}button,a{cursor:pointer}a{color:var(--mint);text-decoration:none}a:hover{text-decoration:underline}
button:disabled{opacity:.45;cursor:not-allowed}button:focus-visible,input:focus-visible,textarea:focus-visible,a:focus-visible{outline:3px solid var(--mint);outline-offset:3px}
[hidden]{display:none!important}.wrap{max-width:1320px;margin:0 auto;padding:0 28px 64px}
header{display:flex;justify-content:space-between;align-items:center;gap:15px;border-bottom:1px solid var(--stroke);padding:22px 0}
.brand{display:flex;align-items:center;gap:12px;min-width:0}.brand-mark{display:grid;place-items:center;width:43px;height:43px;border-radius:12px;color:#0a3b2d;font-weight:950;background:linear-gradient(135deg,#bbec93,var(--mint))}
.brand-name{font-weight:900;letter-spacing:.025em}.brand-name span{color:var(--gold)}.brand small{display:block;color:var(--soft);font-size:11px;letter-spacing:.06em}
.top-actions{display:flex;align-items:center;gap:17px;flex-wrap:wrap;font-size:12px}.top-actions button{background:none;border:0;color:var(--soft)}
.login{max-width:490px;margin:85px auto;padding:30px}.surface{border:1px solid var(--stroke);background:linear-gradient(145deg,#0b2c39,#081f2c);border-radius:16px}
.login h1{font-size:29px;margin:6px 0}.login p{color:var(--soft)}.login input{width:100%;margin:10px 0 14px}
label{display:block;color:#e3f4ee;font-weight:650;font-size:12px;margin-bottom:7px}input,textarea{border:1px solid #476672;border-radius:10px;background:#051c29;color:var(--white);width:100%;padding:12px 13px;min-width:0}input::placeholder,textarea::placeholder{color:#86a6ad}textarea{resize:vertical;min-height:154px}
.primary,.secondary,.quiet{border-radius:10px;border:1px solid transparent;min-height:43px;padding:10px 15px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none}
.primary{background:var(--mint);color:#062d27}.primary:hover{background:#a5ffdf;text-decoration:none}.secondary{color:#e3fbf2;background:#123b45;border-color:#377b72}.secondary:hover{background:#174c52;text-decoration:none}
.quiet{background:transparent;border-color:var(--stroke);color:#c5e5dc}.quiet:hover{background:#153743;text-decoration:none}
.eyebrow{font-size:11px;color:var(--gold);font-weight:800;letter-spacing:.16em;text-transform:uppercase}
.hero{display:flex;justify-content:space-between;align-items:end;gap:20px;padding:35px 0 24px}.hero h1{font-size:clamp(30px,5vw,49px);margin:7px 0 7px;line-height:1.1;letter-spacing:-.04em}.hero h1 em{color:var(--mint);font-style:normal}
.hero p{margin:0;color:var(--soft);max-width:660px;font-size:14px}.sticker{font-size:11px;border:1px solid #408574;color:var(--mint);background:#124238;padding:8px 11px;border-radius:100px;white-space:nowrap}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:0 0 23px}.metric{padding:17px;border:1px solid var(--stroke);border-radius:14px;background:#0a2b36}.metric small{color:var(--soft);font-size:11px}.metric b{font-size:31px;display:block;color:var(--mint);letter-spacing:-.04em}
.stage-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}.card{padding:23px}.card h2{font-size:19px;margin:0 0 8px;letter-spacing:-.02em}
.card h3{font-size:15px;margin:0 0 10px}.card p{font-size:12px;color:var(--soft);margin:0 0 15px}.step{display:inline-grid;place-items:center;background:var(--mint);color:#073a30;border-radius:100px;width:28px;height:28px;font-size:13px;font-weight:900;margin-right:8px}
.field{margin:13px 0}.field small{display:block;color:var(--soft);font-size:11px;margin-top:6px}.upload{position:relative;display:block;border:1px dashed #62a99a;border-radius:13px;background:#0b343b;padding:19px 14px;text-align:center;font-size:13px;cursor:pointer}.upload strong{display:block;font-size:14px;color:#effef6}.upload small{color:var(--soft);font-size:11px}.upload input{position:absolute;inset:0;opacity:0;cursor:pointer;height:100%;width:100%}
.hint{background:#332a19;border:1px solid #6c5c35;border-radius:11px;color:#f1dcad;padding:12px 13px;font-size:12px;margin:15px 0}
.caution{color:var(--gold)}.good{color:var(--mint)}.muted{color:var(--soft)}.bad{color:var(--danger)}.counts{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}
.counter{padding:6px 9px;border:1px solid #3d5f66;border-radius:8px;background:#08242c;font-size:12px}.counter strong{font-variant-numeric:tabular-nums}
.pills{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.pill-button{padding:5px 9px;font-size:12px;border-radius:100px;color:var(--mint);background:#13403e;border:1px solid #397968}
.preview{padding:14px;border:1px solid #366b62;background:#0b3437;border-radius:11px;white-space:pre-wrap;overflow-wrap:anywhere;color:#e5faf4;font-size:13px;min-height:90px}
.row-actions{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin-top:16px}.rule{height:1px;background:var(--stroke);margin:17px 0}
.section-header{display:flex;align-items:center;justify-content:space-between;gap:15px;margin:28px 0 13px}.section-header h2{font-size:22px;margin:0}
.ledger{padding:0;overflow:hidden}.list-row{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:17px 19px;border-bottom:1px solid var(--stroke)}
.list-row:last-child{border-bottom:0}.list-row strong{display:block;font-size:14px}.list-row small{display:block;font-size:11px;color:var(--soft);margin-top:3px}
.list-row .actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.list-row button{font-size:12px;padding:8px 10px;min-height:36px}
.tag{display:inline-flex;padding:4px 8px;border-radius:100px;background:#133a3b;color:#acf0d7;border:1px solid #366a5b;font-size:11px;font-weight:750}
.tag.warn{color:#eac891;border-color:#74603d;background:#322c1e}.tag.off{color:#ffb7b0;border-color:#7b504b;background:#342323}
.empty{padding:25px;text-align:center;color:var(--soft);font-size:13px}.view-title{display:flex;gap:13px;align-items:start;justify-content:space-between;flex-wrap:wrap}.view-title h3{font-size:18px;margin:0}
.toolbar{display:flex;flex-wrap:wrap;gap:9px;align-items:center}.toolbar input{max-width:300px}
footer{margin-top:40px;text-align:center;color:var(--soft);font-size:11px}
.toast{border-radius:10px;padding:12px 15px;background:#104139;border:1px solid #3b8d76;color:#d9ffed;margin:15px 0;font-size:13px}
.toast.error{background:#432a2b;color:#ffe2de;border-color:#a35e5b}
.dialog{width:min(590px,calc(100vw - 25px));border-radius:17px;background:#092633;color:var(--white);border:1px solid #59a68d;padding:24px;box-shadow:0 30px 100px #0008}
.dialog::backdrop{background:#000b}.dialog h2{font-size:23px;margin:0 0 8px}.dialog p{font-size:12px;color:var(--soft)}
.dialog textarea{min-height:160px}.consent-line{display:flex;align-items:flex-start;gap:10px;margin:13px 0;font-size:12px}
.consent-line input{width:18px;height:18px;flex:none;accent-color:var(--mint);margin:0}
.sender-setup{margin:18px 0 10px;padding:12px;border:1px solid var(--stroke);border-radius:12px;background:#0a313a}
.sender-setup summary{cursor:pointer;color:var(--mint);font-weight:750;font-size:12px}
.sender-setup[open] summary{margin-bottom:13px}
#senderStatus{font-size:11px;margin:4px 0 13px;line-height:1.45}
.legacy{padding:14px;align-self:start}
.legacy>summary{cursor:pointer;font-size:13px;font-weight:800;color:#adedd8}
.legacy[open]>summary{margin-bottom:8px}
.legacy .card{padding:10px 0;border:0}
.setup-steps{display:flex;gap:8px;flex-wrap:wrap;margin:15px 0 20px}
.setup-step{padding:7px 10px;border-radius:100px;border:1px solid #31545c;background:#092b36;color:#accbd0;font-size:11px}
.setup-step.active{background:#16443e;border-color:#397866;color:#a5ffe0;font-weight:850}
.cloud-grid{display:grid;grid-template-columns:minmax(0,1.18fr) minmax(0,.82fr);gap:20px;align-items:start}
.cloud-grid textarea{min-height:218px;line-height:1.55;font-size:13px}
.cloud-grid .field{margin:0 0 14px}
.cloud-mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.cloud-lower{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.cloud-lower h3{font-size:15px;margin:0 0 7px}
.cloud-lower p{font-size:12px;margin:0 0 13px}
.divider-thin{height:1px;background:var(--stroke);margin:24px 0}
.phone-preview{background:linear-gradient(135deg,#132d36,#0b222e);padding:15px;border:1px solid #3b6b68;border-radius:18px;max-width:380px;margin:0 auto}
.phone-top{display:flex;align-items:center;gap:10px;border-bottom:1px solid #355560;padding:0 0 14px}
.phone-top strong{font-size:13px;display:block}.phone-top small{font-size:11px;color:var(--soft);display:block}
.phone-avatar{display:grid;place-items:center;width:38px;height:38px;flex:none;border-radius:99px;background:#59d8b0;color:#06372d;font-weight:950}
.bubble{position:relative;background:#164238;border:1px solid #397468;border-radius:13px 13px 4px 13px;margin:18px 0 8px;padding:14px 13px 25px;color:#ecfff7}
.bubble-body{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}
.bubble-time{position:absolute;right:11px;bottom:5px;font-size:9px;color:#acccbf}
.phone-choice{background:#103941;border:1px solid #3b6a73;border-radius:7px;color:#87eecb;padding:11px;text-align:center;font-size:12px;font-weight:800;margin-top:6px}
.phone-note{color:var(--soft);font-size:10px;text-align:center;margin:11px 0 0!important}
.import-only{display:block;margin-top:18px}
.import-only .card{width:100%}
.cloud-queues{display:grid;gap:9px}
.cloud-queue-item{border:1px solid var(--stroke);background:#0d3340;padding:13px;border-radius:11px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.cloud-queue-item strong{display:block;font-size:13px}
.cloud-queue-item small{display:block;color:var(--soft);font-size:11px}
.cloud-queue-item button{font-size:11px;flex:none}
@media(max-width:900px){.stage-grid,.cloud-grid,.cloud-lower{grid-template-columns:1fr}.metrics{grid-template-columns:repeat(2,1fr)}}
@media(max-width:460px){.cloud-mini-grid{grid-template-columns:1fr}.cloud-queue-item{align-items:flex-start;flex-direction:column}}
@media(max-width:580px){.wrap{padding:0 15px 40px}.top-actions{gap:8px}.brand-name{font-size:12px}.hero{align-items:start;flex-direction:column}.card{padding:17px}.metrics{gap:8px}.metric{padding:13px}.metric b{font-size:25px}.list-row{padding:14px;align-items:flex-start;flex-direction:column}.toolbar input{max-width:100%}.dialog{padding:17px}}
`;

export function renderCampanhas() {
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#051923"><meta name="referrer" content="no-referrer">
<title>Campanhas | Caça Promos VIP</title>
<link rel="icon" href="/favicon.svg">
<style>${css}</style><script defer src="/assets/campanhas.js"></script>
</head><body>
<div class="wrap">
<header>
  <div class="brand"><span class="brand-mark">CP</span><div><div class="brand-name">CAÇA PROMOS <span>VIP 👑</span></div><small>CENTRAL DE CAMPANHAS</small></div></div>
  <nav class="top-actions" aria-label="Navegação">
    <a href="#manualStage">WhatsApp Web grátis</a>
    <a href="#importStage">Planilha</a>
    <a href="#complaintsDetail">Denúncias</a>
    <a href="/campanhas" aria-current="page">Campanhas</a>
    <span class="sticker">Uso local · sem login</span>
  </nav>
</header>
<div id="feedback" class="toast" role="status" aria-live="polite" hidden></div>

<main id="appView">
  <section class="hero">
    <div><div class="eyebrow">Convites supervisionados · Sem API paga</div>
      <h1>Mensagens com <em>controle.</em></h1>
      <p>Use seu WhatsApp Web para convidar pessoas que autorizaram receber mensagens. A conversa abre com o texto pronto; você confirma cada envio manualmente.</p></div>
    <span class="sticker">WhatsApp Web · Sem custo de API</span>
  </section>

  <section class="metrics" aria-label="Resumo">
    <div class="metric"><small>Números na planilha</small><b id="metricImported">0</b></div>
    <div class="metric"><small>Aptos a receber</small><b id="metricEligible">0</b></div>
    <div class="metric"><small>Sem opt-in confirmado</small><b id="metricBlocked">0</b></div>
    <div class="metric"><small>Filas de convites</small><b id="metricQueues">0</b></div>
  </section>

  <section class="card surface" id="manualStage" aria-labelledby="manualTitle" style="margin-bottom:18px">
    <div class="view-title">
      <div>
        <span class="eyebrow">Modo gratuito recomendado · 1 conversa por vez</span>
        <h2 id="manualTitle">Convites pelo seu WhatsApp Web</h2>
        <p>Reutiliza o Chrome e o Playwright das promoções: abre a conversa, preenche a mensagem e aguarda sua confirmação para clicar em Enviar uma única vez. Não dispara listas automaticamente.</p>
      </div>
      <span class="tag">Supervisionado</span>
    </div>
    <div class="counts" style="margin-bottom:12px">
      <span class="counter" id="manualDaily">0 / 50 conversas hoje</span>
      <span class="counter" id="manualConfirmed">0 envios confirmados</span>
      <span class="counter">1 por vez · sem disparo automático</span>
    </div>
    <div class="hint"><strong>Importante:</strong> no WhatsApp Web não existem botões interativos personalizados. A mensagem terá o <strong>link do grupo</strong> e a instrução de responder <strong>SAIR</strong> ou <strong>DENUNCIAR</strong>. Ao receber essa resposta, registre o bloqueio no painel. O envio para telefones apenas extraídos de grupos continua bloqueado. O limite interno de 50 por dia não garante evitar bloqueios do WhatsApp.</div>
    <p>Primeiro <a href="#singleText">escreva ou edite sua mensagem única abaixo</a> e <a href="#importStage">importe a planilha de contatos autorizados</a>. Depois volte aqui.</p>
    <label class="consent-line" style="margin:10px 0 15px">
      <input id="useChrome" type="checkbox" checked>
      <span>Usar a automação de Chrome das promoções para preparar e enviar,
      sempre após confirmação minha no painel.</span>
    </label>
    <div class="row-actions">
      <button id="createManualQueue" type="button" class="primary" disabled>Criar fila para WhatsApp Web</button>
      <button id="refreshManualQueues" type="button" class="quiet">Atualizar filas</button>
    </div>
    <div id="manualQueueList" class="cloud-queues" style="margin-top:16px">
      <div class="empty">Nenhuma fila manual preparada.</div>
    </div>
  </section>

  <section id="manualQueueDetail" class="card surface" hidden aria-labelledby="manualQueueTitle" style="margin-bottom:18px">
    <div class="view-title">
      <div><span class="eyebrow">Fila supervisionada</span>
        <h2 id="manualQueueTitle">Convites pelo WhatsApp Web</h2>
        <p id="manualQueueSummary">Escolha um contato autorizado para preparar uma conversa.</p></div>
      <button id="closeManualQueue" type="button" class="quiet">Fechar fila</button>
    </div>
    <div id="manualComposer" class="surface" hidden style="padding:18px;margin:15px 0">
      <strong id="manualRecipient">Contato</strong>
      <p class="muted">Confira o número e o texto. No modo automático supervisionado, clique em Enviar agora no painel; no modo manual, use o link da alternativa.</p>
      <label for="manualMessageReady">Texto idêntico para todos (link e descadastro incluídos)</label>
      <textarea id="manualMessageReady" readonly rows="8"></textarea>
      <div class="hint" style="margin-top:14px">
        <strong>Mesma automação das promoções:</strong> o Chrome usa sua sessão atual,
        preenche a conversa e aguarda seu clique em <strong>Enviar agora</strong>.
        Confira o nome/número na tela do WhatsApp antes de confirmar.
      </div>
      <p id="chromeStatus" class="muted" role="status" aria-live="polite">
        Aguardando o Chrome abrir e preencher a conversa...
      </p>
      <div class="row-actions">
        <button id="chromePrepare" type="button" class="secondary">Preparar novamente no Chrome</button>
        <button id="chromeSend" type="button" class="primary" disabled>Enviar agora pelo WhatsApp</button>
        <button id="chromeCancel" type="button" class="quiet" disabled>Cancelar janela</button>
      </div>
      <details class="legacy">
        <summary>Alternativa manual, sem automação</summary>
        <p>Se o WhatsApp estiver ocupado com o robô de promoções,
          utilize este link e envie você mesmo.</p>
        <a id="manualOpenWa" class="secondary" href="#" target="_blank" rel="noopener noreferrer">Abrir conversa no WhatsApp ↗</a>
      </details>
      <label class="consent-line">
        <input id="manualSentConfirm" type="checkbox">
        <span><strong>Apenas no modo manual:</strong> confirmo que enviei a mensagem nesta conversa.</span>
      </label>
      <div class="row-actions">
        <button id="manualMarkSent" type="button" class="secondary" disabled>Registrar envio confirmado</button>
        <button id="manualIgnore" type="button" class="quiet">Ignorar contato</button>
        <button id="manualComplaint" type="button" class="quiet">Recebi denúncia / SAIR</button>
        <button id="manualCancel" type="button" class="quiet">Cancelar preparação</button>
      </div>
      <p class="muted">O botão Enviar agora clica uma única vez no WhatsApp e tenta conferir a mensagem enviada na própria conversa. Em caso de dúvida, pare e verifique manualmente. Denúncias devem ser registradas somente após uma reclamação real.</p>
    </div>
    <div id="manualQueuePeople" class="ledger surface"></div>
  </section>

  <section class="card surface" id="metaStage" aria-labelledby="metaTitle" style="margin-bottom:18px">
    <div class="view-title">
      <div><span class="eyebrow">Editor de mensagem única · WhatsApp Web e Meta opcional</span>
        <h2 id="metaTitle">Sua mensagem de convite</h2>
        <p id="metaStatus">Preparando a conexão com a Meta. Ainda não é necessário ter número.</p></div>
      <span id="metaConnectionBadge" class="tag warn">Aguardando número</span>
    </div>
    <div class="setup-steps" aria-label="Etapas de preparação">
      <span class="setup-step active">01 · Escrever convite</span>
      <span class="setup-step">02 · Importar CSV</span>
      <span class="setup-step">03 · Simular fila</span>
      <span class="setup-step">04 · Conectar Meta</span>
    </div>
    <div class="cloud-grid">
      <div>
        <div class="field"><label for="singleText">Mensagem enviada a TODOS, sem alterações</label>
          <textarea id="singleText" maxlength="1024" rows="9" spellcheck="true"
            placeholder="Escreva um convite único para todos os destinatários..."></textarea>
          <small class="muted"><span id="singleLength">0</span>/1.024 caracteres · Não usa nomes nem variáveis</small>
        </div>
        <div class="field"><label for="groupLink">Link do grupo de ofertas</label>
          <input id="groupLink" type="url" maxlength="160" placeholder="https://chat.whatsapp.com/...">
          <small class="muted">No modo gratuito, o link entra no texto da mensagem. Na Cloud API, seria enviado após a resposta.</small>
        </div>
        <div class="cloud-mini-grid">
          <div class="field"><label for="cloudCampaignName">Nome da campanha</label>
            <input id="cloudCampaignName" maxlength="80" value="Convite para grupo de ofertas"></div>
          <div class="field"><label for="templateName">Modelo na Meta</label>
            <input id="templateName" maxlength="128" value="convite_ofertas_v1" spellcheck="false"></div>
        </div>
        <div class="row-actions">
          <button id="saveSingle" type="button" class="primary">Salvar mensagem e link</button>
          <button id="simulateSingle" type="button" class="secondary">Simular envio</button>
          <button id="downloadModel" type="button" class="quiet">Exportar modelo Meta</button>
        </div>
        <p id="singleSaveStatus" class="muted" aria-live="polite">Rascunho salvo neste computador, mesmo sem número.</p>
      </div>
      <div>
        <div class="phone-preview">
          <div class="phone-top"><span class="phone-avatar">CP</span>
            <div><strong>Caça Promos VIP 👑</strong><small>Prévia · mesmo texto para todos</small></div></div>
          <div class="bubble"><div id="singlePreview" class="bubble-body">Carregando convite...</div>
            <span class="bubble-time">Prévia</span></div>
          <div class="phone-choice">↗ &nbsp; Entrar no grupo</div>
          <div class="phone-choice">⚑ &nbsp; Denunciar convite</div>
          <p class="phone-note">Botões apenas na futura Cloud API. O WhatsApp Web usa links e resposta por texto.</p>
        </div>
        <div class="hint" id="cloudPreviewNotice">Não haverá envio para números sem opt-in. Denúncias internas bloqueiam campanhas futuras.</div>
      </div>
    </div>
    <div class="divider-thin"></div>
    <div class="cloud-lower">
      <div>
        <h3>Fila de envio oficial</h3>
        <p>Depois de importar a planilha, crie a fila apenas com contatos que consentiram receber convites. Você pode prepará-la agora, mesmo sem o número Meta.</p>
        <div class="counts" aria-live="polite">
          <span class="counter" id="cloudEligible">0 autorizados na planilha</span>
          <span class="counter" id="cloudBlocked">0 fora da fila</span>
          <span class="counter" id="metaDenuncias">0 denúncias internas</span>
          <span class="counter" id="metaBloqueios">0 bloqueados</span>
        </div>
        <div class="row-actions">
          <button id="createCloudQueue" type="button" class="primary" disabled>Preparar fila de convites</button>
          <button id="refreshCloudQueues" type="button" class="quiet">Atualizar filas</button>
        </div>
      </div>
      <div>
        <h3>Conexão com a Meta</h3>
        <p id="cloudActivationStatus">Envio pela API desativado. Preencha os dados da Meta quando tiver o novo número.</p>
        <div class="row-actions">
          <button id="checkMetaModel" type="button" class="secondary">Verificar modelo na Meta</button>
          <button id="reloadMeta" type="button" class="quiet">Verificar conexão</button>
        </div>
        <div class="row-actions">
          <a class="quiet" href="https://business.facebook.com/settings" target="_blank" rel="noopener noreferrer">Meta Business ↗</a>
          <a class="quiet" href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer">Developers ↗</a>
        </div>
        <details class="legacy" id="metaChecklist" style="margin-top:12px">
          <summary>O que falta quando eu tiver o número?</summary>
          <p style="margin:12px 0 6px">1. Criar o WhatsApp Business Account e cadastrar o número na Meta.</p>
          <p>2. Obter Phone Number ID, WABA ID, token de sistema e App Secret.</p>
          <p>3. Aprovar o modelo MARKETING exportado aqui, com a mensagem idêntica e dois botões.</p>
          <p>4. Configurar um webhook público HTTPS seguro; não expor a porta 3045.</p>
          <p>5. Ativar envios controlados após testar a conta e revisar o custo e o opt-in.</p>
        </details>
      </div>
    </div>
    <div class="divider-thin"></div>
    <h3>Campanhas de convite preparadas</h3>
    <div id="cloudQueueList" class="cloud-queues"><div class="empty">Nenhuma fila criada.</div></div>
    <details class="legacy surface" id="complaintsDetail" style="margin-top:17px">
      <summary>Denúncias e bloqueios internos</summary>
      <p style="margin-top:12px">Quem denunciar será bloqueado para campanhas futuras, mesmo se o número reaparecer em outra planilha.</p>
      <div id="complaintsList" class="ledger surface"><div class="empty">Nenhuma denúncia registrada.</div></div>
    </details>
  </section>
  <section id="cloudQueueDetail" class="card surface" hidden aria-labelledby="cloudQueueTitle" style="margin-bottom:18px">
    <div class="view-title">
      <div><span class="eyebrow">Fila oficial de convites</span><h2 id="cloudQueueTitle">Campanha</h2>
        <p id="cloudQueueSummary">Envios ainda não iniciados.</p></div>
      <button id="closeCloudQueue" class="quiet" type="button">Fechar detalhes</button>
    </div>
    <div class="hint">O envio real exige número configurado, modelo MARKETING aprovado, consentimento e sua confirmação. Sem esses requisitos só existe a simulação.</div>
    <div class="row-actions">
      <button id="sendCloudBatch" class="primary" type="button" disabled>Enviar próximo lote (até 10)</button>
      <button id="refreshCloudDetail" class="secondary" type="button">Atualizar status</button>
      <button id="exportCloudReport" class="quiet" type="button">Baixar relatório CSV</button>
    </div>
    <div id="cloudQueuePeople" class="ledger surface"></div>
  </section>

  <section class="import-only">
    <article class="card surface" id="importStage">
      <h2><span class="step">1</span>Importar a planilha</h2>
      <p>Selecione o CSV exportado pela extensão. Ele será lido apenas no navegador e cruzado com as autorizações existentes nesta Central.</p>
      <label class="upload"><strong>Selecionar arquivo CSV ou TXT</strong><small>Até 110 KB / 1.500 linhas • nome;telefone</small>
        <input id="importFile" type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" aria-label="Selecionar CSV">
      </label>
      <div id="importInfo" class="counts" aria-live="polite">
        <span class="counter">Nenhum arquivo selecionado</span>
      </div>
      <div class="hint"><strong>Importante:</strong> participar do grupo ou ter autorizado o registro do telefone não autoriza mensagens comerciais. Apenas contatos que já confirmaram esse consentimento estarão na fila.</div>
      <div class="row-actions">
        <span class="muted" style="font-size:12px">Contatos sem autorização de mensagens não entram na fila.</span>
        <button id="clearImport" type="button" class="quiet">Limpar planilha</button>
      </div>
    </article>

  </section>
  <footer>Caça Promos VIP • Dados locais • Cada envio exige sua confirmação • Respeite solicitações de SAIR</footer>
</main>
</div>

</body></html>`;
}
