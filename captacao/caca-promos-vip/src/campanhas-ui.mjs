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
.connection-box{padding:18px;margin:16px 0 21px;border:1px solid #356e63;background:linear-gradient(135deg,#0c3238,#0c2b37);border-radius:13px}
.connection-box h3{margin:4px 0 8px;font-size:18px}
.connection-box .view-title{margin-bottom:12px}
.connection-box .muted{font-size:12px;line-height:1.6}
.connection-box .row-actions{margin:12px 0}
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

:root{--bg:#061923;--panel:#0b2834;--stroke:#294954;--mint:#6be7bd;--soft:#b2cbd0;--white:#f1faf7}
.wrap{max-width:1070px}
body{background:linear-gradient(135deg,#071e28,#061923 65%,#082c2b)}
header{padding:17px 0}
.top-actions{gap:15px}
.hero{padding:25px 0 17px;align-items:center}
.hero h1{font-size:clamp(31px,4.7vw,42px)}
.hero p{font-size:13px;max-width:640px}
.metrics{margin:0 0 16px;gap:9px}
.metric{padding:11px 15px;background:#0a2834}
.metric b{font-size:24px}
.card{padding:23px 26px;margin-bottom:14px!important}
.card h2{font-size:21px}
.step{width:32px;height:32px;margin-right:9px}
.hint{font-size:12px;line-height:1.5}
.connection-box{margin:10px 0 13px;padding:15px}
#manualStage .view-title p,#metaStage .view-title p{margin:4px 0 5px}
#metaStatus,#metaConnectionBadge{display:none}
#metaStage .cloud-grid{grid-template-columns:minmax(0,1fr);gap:11px}
#metaStage .cloud-grid>div:first-child{max-width:780px}
#metaStage textarea{min-height:160px}
#metaStage .phone-preview{margin:12px 0;max-width:445px}
#metaStage #singleSaveStatus{margin:8px 0 0}
#metaStage .field{margin:12px 0}
.preview-details,.minor-tools,.advanced-disclosure,.consent-disclosure,.expandable-connection{
 border:1px solid var(--stroke);border-radius:12px;background:#092c36;margin:12px 0;
}
.preview-details>summary,.minor-tools>summary,.advanced-disclosure>summary,
.consent-disclosure>summary,.expandable-connection>summary{
 list-style:none;cursor:pointer;padding:12px 15px;color:#d7f7eb;font-weight:720;font-size:13px
}
.preview-details>summary::-webkit-details-marker,.minor-tools>summary::-webkit-details-marker,
.advanced-disclosure>summary::-webkit-details-marker,.consent-disclosure>summary::-webkit-details-marker,
.expandable-connection>summary::-webkit-details-marker{display:none}
.preview-details>summary:after,.minor-tools>summary:after,.advanced-disclosure>summary:after,
.consent-disclosure>summary:after,.expandable-connection>summary:after{content:"+";float:right;color:var(--mint)}
.preview-details[open]>summary:after,.minor-tools[open]>summary:after,.advanced-disclosure[open]>summary:after,
.consent-disclosure[open]>summary:after,.expandable-connection[open]>summary:after{content:"−"}
.preview-details>div,.minor-tools>.row-actions,.advanced-disclosure>.row-actions{margin:8px 15px 15px}
.advanced-disclosure{margin-top:22px}
.advanced-disclosure>.muted{margin:10px 15px!important}
.advanced-disclosure>.cloud-lower,.advanced-disclosure>#cloudQueueList,
.advanced-disclosure>#complaintsDetail,.advanced-disclosure>h3,
.advanced-disclosure>.divider-thin{margin-left:15px;margin-right:15px}
.consent-disclosure>.connection-box,.expandable-connection>.connection-box{border:0;margin:0;background:transparent}
.consent-disclosure>summary .muted,.expandable-connection>summary span{font-weight:500;font-size:11px;margin-left:8px}
#manualStage>.hint{margin:12px 0}
#manualStage .counts{margin-top:8px}
#manualStage .row-actions{margin-top:12px}
#manualQueueRequirement{font-size:12px;margin:12px 0;color:var(--soft)}
.queue-search{margin:16px 0 10px}
.queue-search input{max-width:420px}
.queue-controls{margin:16px 0}
.queue-controls .muted{font-size:12px}
#manualQueuePeople .list-row{padding:12px 16px}
#manualQueuePeople .list-row button{min-height:34px;padding:7px 10px}
#manualQueuePeople .list-row strong{font-size:13px}
.list-more{padding:14px;text-align:center}
#manualComposer{border-radius:13px}
#manualAlternative{padding:0}
#manualAlternative>p,#manualAlternative>label,#manualAlternative>div{margin-left:14px;margin-right:14px}
#manualAlternative>div.row-actions{margin-bottom:15px}
#manualQueueList .cloud-queue-item{padding:12px 14px}
.import-only{margin-top:0}
#importStage>.hint{background:none;border-color:var(--stroke);color:var(--soft);font-size:11px}
#metaStage .advanced-disclosure .row-actions{margin-top:10px}
#queueTools>p{padding:0 15px 12px;margin-bottom:0;font-size:11px}
#netlifySyncStatus{font-size:11px}
#complaintsDetail .ledger{margin:8px 14px 14px}
#complaintsDetail .row-actions{margin-bottom:8px}
.queue-head-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.queue-head-actions button{font-size:12px;min-height:39px}
.danger-action{color:#f5b7b2;border-color:#7b5556}
.danger-action:hover{color:#ffe0dc;background:#40272b;text-decoration:none}
.queue-contact-disclosure{margin:20px 0 0}
.queue-contact-disclosure .queue-search{margin:5px 14px 14px}
.queue-contact-disclosure .ledger{border:0;border-top:1px solid var(--stroke);border-radius:0 0 11px 11px}
.queue-contact-disclosure summary .muted{font-size:12px;font-weight:500;margin-left:7px}
@media(max-width:700px){
 .queue-head-actions{width:100%}
 .queue-head-actions button{flex:1}
 .wrap{padding:0 14px 36px}
 .hero{padding:23px 0 18px;display:block}
 .hero .sticker{display:none}
 .card{padding:17px 16px}
 .metrics{grid-template-columns:repeat(2,minmax(0,1fr))}
 .metric b{font-size:22px}
 .top-actions{gap:10px;font-size:11px}
 .connection-box{padding:12px}
 .queue-controls .primary{width:100%}
 .cloud-lower{grid-template-columns:1fr}
}

`;

export function renderCampanhas() {
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#051923"><meta name="referrer" content="no-referrer">
<title>Campanhas | Caça Promos VIP</title>
<link rel="icon" href="/favicon.svg">
<style>${css}</style><link rel="stylesheet" href="/assets/painel-theme.css">
<script defer src="/assets/campanhas.js"></script>
</head><body>
<div class="wrap">
<header>
  <div class="brand"><span class="brand-mark">CP</span><div><div class="brand-name">CAÇA PROMOS <span>VIP 👑</span></div><small>CENTRAL DE GESTÃO</small></div></div>
  <nav class="top-actions" aria-label="Navegação">
    <a href="/inicio">Visão geral</a>
    <a href="/contatos">Contatos</a>
    <a href="/enviar">Enviar convite</a>
    <a href="/campanhas" aria-current="page">Listas e filas</a>
    <a href="/denuncias">Denúncias</a>
    <span class="sticker">Uso local · sem login</span>
  </nav>
</header>
<div id="feedback" class="toast" role="status" aria-live="polite" hidden></div>

<main id="appView">
  <section class="hero">
    <div><div class="eyebrow">ÁREA AVANÇADA · LISTAS E CAMPANHAS</div>
      <h1>Listas <em>e filas.</em></h1>
      <p>Importação de planilhas, campanhas com vários contatos, relatórios e ferramentas avançadas.
      Para enviar apenas um convite, use a tela simplificada.</p></div>
    <span class="sticker">WhatsApp Web · Sem API paga</span>
  </section>
  <div class="hint" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;
     margin:0 0 20px;padding:19px;border:1px solid #61998a;background:#1b3737;border-radius:13px">
    <div><strong style="display:block;font-size:15px;color:#d7fff0">Quer testar no seu próprio WhatsApp?</strong>
      <span style="display:block;font-size:12px;margin-top:4px">
        Você não precisa importar uma planilha nem gerenciar filas para isso.</span></div>
    <a href="/enviar" class="primary" style="padding:12px 17px;border-radius:10px;text-decoration:none;
       background:#78dbb8;color:#092a24;font-weight:800">Abrir envio guiado →</a>
  </div>

  <nav class="workflow-links" aria-label="Etapas dos convites">
    <span>ETAPAS</span>
    <a href="#importStage">1. Selecionar contatos</a>
    <a href="#metaStage">2. Preparar mensagem</a>
    <a href="#manualStage">3. Enviar no WhatsApp</a>
  </nav>

  <section class="metrics" aria-label="Resumo">
    <div class="metric"><small>Importados nesta aba</small><b id="metricImported">0</b></div>
    <div class="metric"><small>Selecionados autorizados</small><b id="metricEligible">0</b></div>
    <div class="metric"><small>Excluídos da seleção</small><b id="metricBlocked">0</b></div>
    <div class="metric"><small>Filas de convites</small><b id="metricQueues">0</b></div>
  </section>

  <section class="import-only">
    <article class="card surface" id="importStage">
      <h2><span class="step">1</span>Selecionar contatos</h2>
      <p class="short-nav-note"><a href="/contatos">Ver cadastro completo, bloqueios e autorizações →</a></p>
      <p>Importe um CSV com as pessoas que autorizaram os convites. Se houver coluna de autorização, apenas linhas marcadas <strong>SIM</strong> serão consideradas.</p>
      <label class="upload"><strong>Selecionar arquivo CSV ou TXT</strong><small>Até 110 KB / 1.500 linhas • nome;telefone</small>
        <input id="importFile" type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" aria-label="Selecionar CSV">
      </label>
      <div id="importInfo" class="counts" aria-live="polite">
        <span class="counter">Nenhum arquivo selecionado</span>
      </div>
      <details id="consentDisclosure" class="consent-disclosure">
      <summary>Registrar autorizações de novos contatos <span class="muted">Origem, data e referência</span></summary>
      <div class="connection-box" aria-labelledby="importConsentTitle">
        <span class="eyebrow">Contatos que autorizaram antes da importação</span>
        <h3 id="importConsentTitle">Registrar novos consentimentos</h3>
        <p class="muted">Se essas pessoas já permitiram o envio de promoções e convites, informe onde e quando isso ocorreu. Não é necessário repetir o cadastro por QR Code ou enviar QUERO VIP.</p>
        <div class="field">
          <label for="consentOrigin">Onde os contatos autorizaram?</label>
          <input id="consentOrigin" maxlength="140" placeholder="Ex.: conversa individual no WhatsApp">
        </div>
        <div class="field">
          <label for="consentDate">Data da autorização</label>
          <input id="consentDate" type="date">
        </div>
        <div class="field">
          <label for="consentReference">Referência do consentimento</label>
          <input id="consentReference" maxlength="240" placeholder="Ex.: mensagens de aceite registradas no WhatsApp">
        </div>
        <label class="consent-line">
          <input type="checkbox" id="consentDeclaration">
          <span>Confirmo que <strong>cada contato deste CSV autorizou mensagens promocionais e convites individuais</strong>, e que posso demonstrar essa autorização caso necessário.</span>
        </label>
        <div class="row-actions">
          <button type="button" id="confirmConsentImport" class="primary" disabled>Registrar autorizações da planilha</button>
        </div>
        <p class="muted" id="consentImportResult" role="status" aria-live="polite">A confirmação não envia mensagens. Contatos que solicitaram SAIR ou foram bloqueados não serão reativados.</p>
      </div>
      </details>
      <p class="muted" style="font-size:11px">Participar de um grupo não é consentimento. Contatos bloqueados ou descadastrados não serão reativados.</p>
      <details class="minor-tools"><summary>Opções da planilha</summary><div class="row-actions"><button id="clearImport" type="button" class="quiet">Desselecionar arquivo</button></div></details>
    </article>

  </section>
  <section class="card surface" id="metaStage" aria-labelledby="metaTitle" style="margin-bottom:18px">
    <div class="view-title">
      <div><span class="eyebrow">Escreva uma vez, confira antes de enviar</span>
        <h2 id="metaTitle"><span class="step">2</span>Sua mensagem</h2>
        <p id="metaStatus">Preparando a conexão com a Meta. Ainda não é necessário ter número.</p></div>
      <span id="metaConnectionBadge" class="tag warn">Aguardando número</span>
    </div>
    <div class="cloud-grid">
      <div>
        <div class="field"><label for="singleText">Mensagem enviada a TODOS, sem alterações</label>
          <textarea id="singleText" maxlength="1024" rows="9" spellcheck="true"
            placeholder="Escreva um convite único para todos os destinatários..."></textarea>
          <small class="muted"><span id="singleLength">0</span>/1.024 caracteres · A opção "Não tenho interesse" é acrescentada quando o site estiver atualizado</small>
        </div>
        <div class="field"><label for="groupLink">Link do grupo de ofertas</label>
          <input id="groupLink" type="url" maxlength="160" placeholder="https://chat.whatsapp.com/...">
          <small class="muted">O link será incluído automaticamente no convite pelo WhatsApp Web.</small>
        </div>
        <details id="campaignOptions" class="minor-tools"><summary>Nome da campanha e modelo</summary>
        <div class="cloud-mini-grid">
          <div class="field"><label for="cloudCampaignName">Nome da campanha</label>
            <input id="cloudCampaignName" maxlength="80" value="Convite para grupo de ofertas"></div>
          <div class="field"><label for="templateName">Modelo na Meta</label>
            <input id="templateName" maxlength="128" value="convite_ofertas_v1" spellcheck="false"></div>
        </div>
        </details>
        <div class="row-actions">
          <button id="saveSingle" type="button" class="primary">Salvar convite</button>
        </div>
        <p id="singleSaveStatus" class="muted" aria-live="polite">Rascunho salvo neste computador, mesmo sem número.</p>
      </div>
      <details id="messagePreview" class="preview-details"><summary>Ver prévia da mensagem</summary>
      <div>
        <div class="phone-preview">
          <div class="phone-top"><span class="phone-avatar">CP</span>
            <div><strong>Caça Promos VIP 👑</strong><small>Prévia · mesmo texto para todos</small></div></div>
          <div class="bubble"><div id="singlePreview" class="bubble-body">Carregando convite...</div>
            <span class="bubble-time">Prévia</span></div>
          <div class="phone-choice">↗ &nbsp; Entrar no grupo</div>
          <div class="phone-choice">↩ &nbsp; Não tenho interesse</div>
          <p class="phone-note">Prévia ilustrativa. No WhatsApp Web gratuito as opções são links, não botões nativos. "Não tenho interesse" registra um pedido de saída, não uma denúncia.</p>
        </div>
        <div class="hint" id="cloudPreviewNotice">Não haverá envio para números sem autorização. Pedidos de saída bloqueiam convites futuros.</div>
      </div>
      </details>
    </div>
    <details id="advancedMeta" class="advanced-disclosure">
      <summary>Recursos avançados: API Meta (paga) e relatórios</summary>
      <p class="muted">O WhatsApp Web gratuito funciona sem configurar esta área.</p>
      <div class="row-actions"><button id="simulateSingle" type="button" class="secondary">Simular campanha</button><button id="downloadModel" type="button" class="quiet">Exportar modelo Meta</button></div>
    <div class="divider-thin"></div>
    <div class="cloud-lower">
      <div>
        <h3>Fila da API Meta (opcional e paga)</h3>
        <p>Esta fila usa a integração oficial de marketing da Meta. Para enviar com seu WhatsApp Web sem API paga, use a fila da seção gratuita acima.</p>
        <div class="counts" aria-live="polite">
          <span class="counter" id="cloudEligible">0 autorizados na planilha</span>
          <span class="counter" id="cloudBlocked">0 fora da fila</span>
          <span class="counter" id="metaDenuncias">0 denúncias internas</span>
          <span class="counter" id="metaBloqueios">0 bloqueados</span>
        </div>
        <div class="row-actions">
          <button id="createCloudQueue" type="button" class="secondary" disabled>Criar fila da API Meta</button>
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
    <h3>Filas da API Meta preparadas</h3>
    <div id="cloudQueueList" class="cloud-queues"><div class="empty">Nenhuma fila criada.</div></div>
     </details>
  </section>
  <section class="card surface" id="manualStage" aria-labelledby="manualTitle" style="margin-bottom:18px">
    <div class="view-title">
      <div>
        <span class="eyebrow">WhatsApp Web gratuito · supervisionado</span>
        <h2 id="manualTitle"><span class="step">3</span>Enviar pelo WhatsApp Web</h2>
        <p>Abra a fila, confira cada número no WhatsApp e confirme o envio individualmente.</p>
      </div>
      <span class="tag">Supervisionado</span>
    </div>
    <details id="connectionDisclosure" class="expandable-connection" open>
      <summary>Conexão do WhatsApp <span id="connectionBrief">Verificando sessão...</span></summary>
    <div class="connection-box" id="whatsappConnectionStage" aria-labelledby="whatsappConnectionTitle">
      <div class="view-title">
        <div>
          <span class="eyebrow">Etapa 1 · Conexão do aparelho</span>
          <h3 id="whatsappConnectionTitle">Conectar seu WhatsApp Web</h3>
          <p>Abre o Chrome das promoções sem escolher contatos e sem enviar mensagens. Use esta etapa antes de preparar a campanha.</p>
        </div>
        <span id="whatsappConnectionBadge" class="tag warn">Não verificado</span>
      </div>
      <p id="whatsappConnectionStatus" class="muted" role="status" aria-live="polite">Verificando a sessão local...</p>
      <div class="row-actions">
        <button id="whatsappConnectOpen" type="button" class="primary">Abrir WhatsApp Web</button>
        <button id="whatsappConnectClose" type="button" class="secondary" disabled>Salvar sessão e fechar</button>
        <button id="whatsappConnectRefresh" type="button" class="quiet">Verificar estado</button>
      </div>
      <p class="muted" style="margin-bottom:0">Se aparecer o QR Code, no celular vá em <strong>WhatsApp → Aparelhos conectados → Conectar aparelho</strong> e escaneie. Quando suas conversas aparecerem, clique em <strong>Salvar sessão e fechar</strong> para liberar o Chrome aos convites. Se o robô de promoções estiver usando esse perfil, encerre-o antes de conectar.</p>
    </div>
    </details>
    <div class="counts" style="margin-bottom:12px">
      <span class="counter" id="manualDaily">0 / 50 conversas hoje</span>
      <span class="counter" id="manualConfirmed">0 envios confirmados</span>
      <span class="counter">1 por vez · sem disparo automático</span>
    </div>
    <p id="complaintLinkStatus" class="muted" aria-live="polite">Verificando a opção Não tenho interesse...</p>
    <details class="minor-tools"><summary>Cuidados com os envios</summary><div class="hint">O WhatsApp Web não oferece botões nativos sem a API Meta. Quando o site HTTPS estiver atualizado, o convite terá um link "Não tenho interesse" para solicitar a interrupção dos convites. Também é possível responder SAIR. O clique não gera denúncia. O limite diário de 50 preparações não garante evitar bloqueios.</div></details>
    <p>Quando a planilha e a mensagem estiverem prontas, crie uma fila para o WhatsApp Web.</p>
    <details id="sendOptions" class="minor-tools">
      <summary>Opções de envio</summary>
      <label class="consent-line" style="margin:10px 0 15px">
        <input id="useChrome" type="checkbox" checked>
        <span>Preparar no Chrome das promoções e confirmar cada envio no painel.</span>
      </label>
    </details>
    <div class="row-actions">
      <button id="createManualQueue" type="button" class="primary" disabled>Criar fila de convites</button>
    </div>
    <p id="manualQueueRequirement" class="hint" role="status" aria-live="polite">
      Verificando os contatos autorizados e a planilha...
    </p>
    <div id="manualQueueList" class="cloud-queues" style="margin-top:16px">
      <div class="empty">Nenhuma fila manual preparada.</div>
    </div>
    <details id="queueTools" class="minor-tools">
      <summary>Gerenciar filas</summary>
      <div class="row-actions">
        <button id="refreshManualQueues" type="button" class="quiet">Atualizar filas</button>
        <button id="clearAllQueues" type="button" class="quiet">Limpar filas antigas</button>
      </div>
      <p class="muted">Apaga somente filas sem envios ou tentativas registrados, com backup privado. Contatos e autorizações ficam preservados.</p>
    </details>
    <details id="complaintsDetail" class="minor-tools">
      <summary>Pedidos de saída e denúncias <span id="complaintsCount" class="muted">(0)</span></summary>
      <p class="muted" style="padding:0 15px">Quando alguém escolher "Não tenho interesse", será registrado um pedido de saída e o número será bloqueado para novos convites. As denúncias anteriores continuam no histórico.</p>
      <p id="netlifySyncStatus" class="muted" style="padding:0 15px">Verificando conexão Netlify...</p>
      <div class="row-actions" style="padding:0 15px 8px">
        <button id="syncNetlifyNow" type="button" class="quiet" disabled>Buscar pedidos no Netlify agora</button>
      </div>
      <div id="complaintsList" class="ledger surface"><div class="empty">Nenhum pedido registrado.</div></div>
    </details>
  </section>

  <section id="manualQueueDetail" class="card surface" hidden aria-labelledby="manualQueueTitle" style="margin-bottom:18px">
    <div class="view-title">
      <div><span class="eyebrow">Fila supervisionada</span>
        <h2 id="manualQueueTitle">Sua fila de convites</h2>
        <p id="manualQueueSummary">Escolha um contato autorizado para preparar uma conversa.</p></div>
      <div class="queue-head-actions">
        <button id="clearCurrentQueue" type="button" class="quiet danger-action">Limpar esta fila</button>
        <button id="closeManualQueue" type="button" class="quiet">Fechar</button>
      </div>
    </div>
    <div class="row-actions queue-controls">
      <button id="prepareNextContact" type="button" class="primary" disabled>Preparar próximo contato</button>
      <span class="muted">Ou escolha um contato na lista abaixo.</span>
    </div>
    <div id="manualComposer" class="surface" hidden style="padding:18px;margin:15px 0">
      <strong id="manualRecipient">Contato</strong>
      <p class="muted">Confira o número e o texto. No modo automático supervisionado, clique em Enviar agora no painel; no modo manual, use o link da alternativa.</p>
      <label for="manualMessageReady">Texto para este destinatário (opção Não tenho interesse quando disponível)</label>
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
        <button id="chromeSend" type="button" class="primary" disabled>Confirmar envio no WhatsApp</button>
        <button id="chromeCancel" type="button" class="quiet" disabled>Cancelar conversa</button>
      </div>
      <details id="manualAlternative" class="legacy">
        <summary>Alternativa manual e outras ações</summary>
        <p>Se o WhatsApp estiver ocupado com o robô de promoções,
          utilize este link e envie você mesmo.</p>
        <a id="manualOpenWa" class="secondary" href="#" target="_blank" rel="noopener noreferrer">Abrir conversa no WhatsApp ↗</a>
      <label class="consent-line">
        <input id="manualSentConfirm" type="checkbox">
        <span><strong>Apenas no modo manual:</strong> confirmo que enviei a mensagem nesta conversa.</span>
      </label>
      <div class="row-actions">
        <button id="manualMarkSent" type="button" class="secondary" disabled>Registrar envio confirmado</button>
        <button id="manualIgnore" type="button" class="quiet">Ignorar contato</button>
        <button id="manualComplaint" type="button" class="quiet">Recebi "Não tenho interesse" / SAIR</button>
        <button id="manualCancel" type="button" class="quiet">Cancelar preparação</button>
      </div>
      </details>
      <p class="muted">O botão Enviar agora clica uma única vez no WhatsApp e tenta conferir a mensagem enviada na própria conversa. Em caso de dúvida, pare e verifique manualmente. Registre "Não tenho interesse" somente quando o contato realmente solicitar a saída.</p>
    </div>
    <details id="manualPeopleDisclosure" class="minor-tools queue-contact-disclosure">
      <summary>Ver lista de contatos <span id="manualPeopleCount" class="muted"></span></summary>
      <div class="queue-search">
        <label for="manualSearch">Buscar nesta fila</label>
        <input id="manualSearch" type="search" placeholder="Nome ou últimos dígitos do telefone" autocomplete="off">
      </div>
      <div id="manualQueuePeople" class="ledger surface"></div>
    </details>
  </section>

  <section id="cloudQueueDetail" class="card surface" hidden aria-labelledby="cloudQueueTitle" style="margin-bottom:18px">
    <div class="view-title">
      <div><span class="eyebrow">Fila da API Meta, não é WhatsApp Web</span><h2 id="cloudQueueTitle">Campanha</h2>
        <p id="cloudQueueSummary">Envios ainda não iniciados.</p></div>
      <button id="closeCloudQueue" class="quiet" type="button">Fechar detalhes</button>
    </div>
    <div class="hint">Esta é uma fila da API oficial da Meta (serviço pago). Para usar a sua conta no WhatsApp Web gratuito, converta esta fila antes de enviar. A conversão mantém os contatos e não envia mensagens.</div>
    <div class="row-actions">
      <button id="convertCloudToWeb" class="secondary" type="button" hidden>Usar esta fila no WhatsApp Web gratuito</button>
      <button id="sendCloudBatch" class="primary" type="button" disabled>Enviar próximo lote (até 10)</button>
      <button id="refreshCloudDetail" class="secondary" type="button">Atualizar status</button>
      <button id="exportCloudReport" class="quiet" type="button">Baixar relatório CSV</button>
    </div>
    <div id="cloudQueuePeople" class="ledger surface"></div>
  </section>

  <footer>Caça Promos VIP • Dados locais • Cada envio exige sua confirmação • Respeite solicitações de SAIR</footer>
</main>
</div>

</body></html>`;
}
