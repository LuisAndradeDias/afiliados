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
@media(max-width:900px){.stage-grid{grid-template-columns:1fr}.metrics{grid-template-columns:repeat(2,1fr)}}
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
    <a href="/painel" title="A Central de Contatos mantém seu próprio acesso protegido">Cadastro de contatos ↗</a>
    <a href="/campanhas" aria-current="page">Campanhas</a>
    <span class="sticker">Uso local · sem login</span>
  </nav>
</header>
<div id="feedback" class="toast" role="status" aria-live="polite" hidden></div>

<main id="appView">
  <section class="hero">
    <div><div class="eyebrow">Campanhas supervisionadas · Nova fase</div>
      <h1>Mensagens com <em>controle.</em></h1>
      <p>Importe a planilha gerada pela extensão, prepare um texto personalizado e abra conversas somente para contatos com consentimento de mensagens confirmado.</p></div>
    <span class="sticker">Sem disparos automáticos</span>
  </section>

  <section class="metrics" aria-label="Resumo">
    <div class="metric"><small>Números na planilha</small><b id="metricImported">0</b></div>
    <div class="metric"><small>Aptos a receber</small><b id="metricEligible">0</b></div>
    <div class="metric"><small>Sem opt-in confirmado</small><b id="metricBlocked">0</b></div>
    <div class="metric"><small>Enviados na campanha</small><b id="metricSent">0</b></div>
  </section>

  <section class="card surface" id="metaStage" aria-labelledby="metaTitle" style="margin-bottom:18px">
    <div class="view-title">
      <div><span class="eyebrow">Integração oficial · Em preparação</span>
      <h3 id="metaTitle">WhatsApp Business Platform (Meta)</h3>
      <p id="metaStatus">Conferindo a conexão da Cloud API...</p></div>
      <button id="reloadMeta" type="button" class="quiet">Atualizar status</button>
    </div>
    <div class="counts" aria-live="polite">
      <span class="counter" id="metaDenuncias">0 denúncias internas</span>
      <span class="counter" id="metaBloqueios">0 bloqueados</span>
      <span class="counter">Envio por API: desativado</span>
    </div>
    <div class="row-actions">
      <a class="secondary" href="https://business.facebook.com/settings" target="_blank" rel="noopener noreferrer">Abrir Meta Business ↗</a>
      <a class="secondary" href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer">Meta for Developers ↗</a>
    </div>
    <p style="margin:13px 0 0">O modelo previsto terá dois botões: <strong>Entrar no grupo</strong> e <strong>Denunciar convite</strong>. O webhook verificará a assinatura da Meta; a denúncia bloqueia novos envios. A Cloud API permanece sem envio até concluir o cadastro e aprovar o modelo.</p>
  </section>

  <section class="stage-grid">
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
        <a class="secondary" href="/painel#contactsCard">Ver autorizações</a>
        <button id="clearImport" type="button" class="quiet">Limpar planilha</button>
      </div>
    </article>

    <article class="card surface" id="composeStage">
      <h2><span class="step">2</span>Criar mensagem</h2>
      <div class="field"><label for="campaignName">Nome da campanha</label><input id="campaignName" maxlength="90" placeholder="Ex.: Ofertas da semana"></div>
      <div class="field"><label for="campaignGroup">Grupo ou origem</label><input id="campaignGroup" maxlength="90" placeholder="Ex.: Comunidade de promoções"></div>
      <div class="field">
        <label for="campaignText">Texto da mensagem</label>
        <textarea id="campaignText" maxlength="1200" placeholder="Olá, {nome}! Temos novas ofertas no {grupo}. Quer receber novidades?"></textarea>
        <small class="muted">Variáveis permitidas: <strong>{nome}</strong> e <strong>{grupo}</strong>. A opção SAIR será incluída automaticamente.</small>
        <div class="pills"><button type="button" class="pill-button" data-add="{nome}">Inserir {nome}</button><button type="button" class="pill-button" data-add="{grupo}">Inserir {grupo}</button></div>
      </div>
      <label>Prévia da mensagem</label>
      <div class="preview" id="messagePreview">Sua mensagem personalizada aparecerá aqui.</div>
      <details class="sender-setup" id="senderSetup">
        <summary>Configurar número do WhatsApp de envio (uma vez)</summary>
        <div class="field">
          <label for="senderPhone">Seu número do WhatsApp Business</label>
          <input id="senderPhone" type="tel" maxlength="25" inputmode="tel" autocomplete="tel" placeholder="(11) 99999-9999">
          <small>Usado apenas para o registro de envios manuais. Confira a conta antes de mandar cada mensagem.</small>
        </div>
        <button id="saveSender" type="button" class="secondary">Salvar número de envio</button>
      </details>
      <p id="senderStatus" class="muted" aria-live="polite">Verificando número de envio...</p>
      <div class="row-actions"><button id="createCampaign" type="button" class="primary" disabled>Criar fila de envios autorizados</button></div>
      <p style="margin:13px 0 0">Nenhuma mensagem é enviada ao criar a campanha.</p>
    </article>
  </section>

  <section class="section-header">
    <h2>Campanhas salvas</h2>
    <button id="reloadCampaigns" type="button" class="quiet">Atualizar lista</button>
  </section>
  <div class="ledger surface" id="campaignsList"><div class="empty">Carregando campanhas locais...</div></div>

  <section id="queueSection" hidden>
    <div class="section-header">
      <div><span class="eyebrow">Fila supervisionada</span><h2 id="queueTitle">Mensagens preparadas</h2></div>
      <div class="toolbar"><input id="queueSearch" type="search" placeholder="Buscar destinatário" aria-label="Buscar na fila"><button id="reportCsv" class="secondary" type="button">Exportar relatório</button></div>
    </div>
    <div class="hint" id="queueNotice">Ao clicar em Abrir conversa, o WhatsApp apresentará o texto pronto, mas você ainda precisará enviar manualmente.</div>
    <div class="ledger surface" id="queueList"></div>
  </section>
  <footer>Caça Promos VIP • Dados locais • Cada envio exige sua confirmação • Respeite solicitações de SAIR</footer>
</main>
</div>

<dialog class="dialog" id="sendDialog" aria-labelledby="sendTitle">
  <h2 id="sendTitle">Conferir mensagem</h2>
  <p id="sendRecipient"></p>
  <label for="messageReady">Texto preparado para o destinatário</label>
  <textarea id="messageReady" readonly></textarea>
  <div class="hint">Abrir a conversa não é enviar a mensagem. Confira a conta do WhatsApp e pressione Enviar manualmente na conversa.</div>
  <a id="openWhatsApp" class="primary" href="#" target="_blank" rel="noopener noreferrer">Abrir conversa no WhatsApp ↗</a>
  <label class="consent-line"><input id="sentConfirm" type="checkbox"><span>Confirmo que <strong>enviei manualmente</strong> a mensagem na conversa.</span></label>
  <div class="row-actions"><button id="recordSent" type="button" class="secondary" disabled>Registrar envio confirmado</button><button id="closeDialog" class="quiet" type="button">Fechar</button></div>
</dialog>
</body></html>`;
}
