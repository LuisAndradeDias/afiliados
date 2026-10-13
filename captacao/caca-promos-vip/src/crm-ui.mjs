import { styles as baseStyles } from './templates.mjs';

const appStyles = `
${baseStyles}
:root { --surface:#071f2b; --surface2:#082b36; --line:#2d5760; --soft:#b2c7ce; --caution:#f0bd72; }
main,nav,section,article,form {position:relative;}
button,input,select,textarea {font:inherit;} button {cursor:pointer;}
button:disabled {cursor:not-allowed;opacity:.48;}
button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,a:focus-visible {outline:3px solid var(--gold);outline-offset:3px;}
input,select,textarea {color:var(--white);background:#031925;border:1px solid #3a5960;border-radius:11px;padding:13px 14px;max-width:100%;min-width:0;width:100%;}
input::placeholder,textarea::placeholder{color:#90a7b0;}
input[type=checkbox] {width:20px;height:20px;accent-color:var(--mint);margin:2px 0 0;flex:none;}
label {display:block;color:#e2ece9;font-weight:650;font-size:13px;margin-bottom:8px;}
button.primary,.button.primary {display:inline-flex;align-items:center;justify-content:center;gap:10px;background:var(--mint);color:#042820;border:0;padding:12px 20px;border-radius:11px;text-decoration:none;font-weight:800;min-height:44px;}
button.secondary,.button.secondary {display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#123443;border:1px solid #3c7671;color:#e6fff1;padding:11px 17px;border-radius:11px;text-decoration:none;font-weight:700;min-height:44px;}
button.danger {background:#53302a;color:#ffdad4;border:1px solid #a55d57;padding:10px 15px;border-radius:10px;}
button.ghost {border:1px solid #406069;background:transparent;color:#d5e6e9;border-radius:10px;padding:9px 14px;}
button.sm {min-height:0;padding:9px 10px;font-size:12px;}
.actions {display:flex;flex-wrap:wrap;gap:9px;align-items:center;}
.card {padding:23px;border:1px solid #36605e;background:linear-gradient(130deg,#082734,#041c28);border-radius:18px;box-shadow:0 16px 45px #0002;min-width:0;}
.card h2 {margin:0 0 10px;font-size:21px;letter-spacing:-.02em;}
.card h3 {margin:0 0 8px;font-size:16px;}
.card p {color:#bcd1d5;font-size:14px;line-height:1.62;}
.grid2 {display:grid;grid-template-columns:1fr 1fr;gap:17px;}
.grid3 {display:grid;grid-template-columns:repeat(3,1fr);gap:15px;}
.meta {font-size:12px;color:#8eb1b2;line-height:1.5;}
.muted{color:var(--soft)}
.mini-label{font-size:11px;font-weight:800;letter-spacing:.13em;color:var(--gold);text-transform:uppercase;}
.badge {display:inline-flex;align-items:center;padding:5px 10px;border-radius:100px;background:#123b36;border:1px solid #497363;color:var(--mint);font-size:11px;font-weight:800;letter-spacing:.02em;}
.badge.wait {color:var(--gold);border-color:#6e6249;background:#352c1b;}
.badge.off {color:#f8b5ab;border-color:#674846;background:#31212a;}
.stats-v2{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0 22px;}
.metric{background:#082633;border:1px solid #2c555e;border-radius:15px;padding:19px 19px 17px;}
.metric b{display:block;font-size:clamp(25px,3vw,35px);color:var(--mint);letter-spacing:-.05em;margin:5px 0;}
.metric small {color:#aec1c9;font-size:12px;}
.crm-container {position:relative;max-width:1240px;margin:0 auto;padding:0 25px 65px;}
.crm-container header{display:flex;align-items:center;justify-content:space-between;padding:28px 0 18px;border-bottom:1px solid #26474b;margin-bottom:25px;}
.crm-heading {display:flex;justify-content:space-between;align-items:flex-end;gap:18px;flex-wrap:wrap;margin:15px 0 20px;}
.crm-heading h1 {font-size:clamp(32px,5vw,54px);margin:7px 0 8px;}
.crm-heading p{color:#a9c3ca;max-width:700px;line-height:1.55;margin:0;font-size:15px;}
.login-view{max-width:510px;margin:60px auto;}
.login-view input{margin:10px 0 15px;}
.login-view button{width:100%;}
.form-stack{display:grid;gap:10px;}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.fineprint{font-size:12px;color:#93b4b6;line-height:1.5;}
.alert{margin:14px 0;padding:12px 15px;border:1px solid #4d766e;border-radius:11px;background:#0b3436;color:#cbf0dc;font-size:13px;line-height:1.5;}
.alert.error{background:#392726;border-color:#915551;color:#ffd7d0;}
.notice{border:1px solid #9b8053;background:#44321d70;border-radius:13px;padding:13px 16px;color:#f6ddad;font-size:13px;line-height:1.5;}
.sep{border:0;border-top:1px solid #24474b;margin:20px 0;}
.consent-box{display:flex;gap:12px;padding:15px;border:1px solid #4b7970;background:#092f30;border-radius:13px;align-items:flex-start;}
.consent-box label{font-weight:450;line-height:1.5;margin:0;font-size:13px;}
.code-pill{display:inline-block;font-family:ui-monospace,monospace;letter-spacing:.1em;color:var(--gold);padding:8px 12px;border:1px dashed #c9b070;border-radius:9px;background:#2c281d;}
.board {display:grid;grid-template-columns:1.2fr .8fr;gap:17px;margin:18px 0;}
.board .card {height:100%;}
.crm-table{width:100%;border-collapse:collapse;min-width:850px;}
.crm-table th{background:#10313b;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--gold);padding:13px 14px;}
.crm-table td{font-size:13px;color:#e5f1f0;padding:13px 14px;border-bottom:1px solid #2c4951;vertical-align:middle;}
.crm-table td small{display:block;color:#9dbbbd;margin-top:3px;}
.table-scroll{overflow-x:auto;border:1px solid #33535b;border-radius:15px;}
.monospace {font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;}
.tools{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:14px 0;}
.tools input{width:min(360px,100%);}
.section-heading{display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap;margin:20px 0 12px;}
.section-heading h2{margin:0;font-size:22px;}
.section-heading p{margin:0;color:#b4c8cc;font-size:12px;}
.link-preview {padding:13px;border:1px solid #405c5f;border-radius:10px;color:var(--mint);word-break:break-all;font-size:13px;background:#021722;}
.link-preview.local {color:var(--gold);}
.dialog {width:min(560px,calc(100vw - 30px));border-radius:18px;background:#06212b;color:#f5faf8;border:1px solid #51978c;padding:25px;box-shadow:0 30px 120px #0008;}
.dialog::backdrop{background:#000a;}
.dialog h2{margin:0 0 10px;}
.dialog p{color:#becdd1;line-height:1.55;font-size:14px;}
.dialog textarea{min-height:138px;resize:vertical;}
[hidden] {display:none!important;}
@media(max-width:980px){.board,.grid2{grid-template-columns:1fr;}.stats-v2{grid-template-columns:repeat(2,1fr);}}
@media(max-width:640px){.crm-container{padding:0 16px 50px;}.card{padding:18px;}.stats-v2{gap:8px;}.metric{padding:14px;}.metric b{font-size:27px;}.form-row{grid-template-columns:1fr;} .crm-container header{flex-direction:column;align-items:flex-start;gap:14px;} .tools input{width:100%;}}
`;

function htmlPage(title, content, script) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#031722"><meta name="referrer" content="no-referrer"><title>${title}</title><link rel="icon" href="/favicon.svg"><style>${appStyles}</style><script defer src="${script}"></script></head><body>${content}</body></html>`;
}

const brand = `<div class="brand"><span class="mark" aria-hidden="true">◎</span><span>CAÇA PROMOS<br><strong>VIP 👑</strong></span></div>`;

export function renderPainelCrm() {
  return htmlPage('Central de Captação | Caça Promos VIP', `
  <div class="crm-container">
    <header>${brand}<span class="tag">Central de Captação · Versão 0.2</span></header>
    <section id="loginView" class="login-view">
      <div class="card">
        <p class="mini-label">Acesso administrativo</p>
        <h2>Seus contatos, suas permissões.</h2>
        <p>Use a chave privada salva no computador em <code>dados/chave-admin.txt</code>. Esta área não é pública.</p>
        <form id="loginForm" autocomplete="off">
          <label for="adminKey">Chave de acesso</label>
          <input id="adminKey" type="password" placeholder="Cole a chave de administrador" required autocomplete="off">
          <button class="primary" type="submit">Entrar no painel →</button>
        </form>
        <div id="loginFeedback" class="alert" hidden></div>
      </div>
    </section>

    <main id="appView" hidden>
      <div class="crm-heading">
        <div><div class="mini-label">Gestão de contatos voluntários</div><h1>Captação <span>inteligente.</span></h1><p>Convites para grupos autorizados, contatos que pediram mensagens e campanhas pelo segundo WhatsApp — com o controle nas suas mãos.</p></div>
        <button type="button" class="ghost" id="logoutBtn">Sair do painel</button>
      </div>
      <div class="notice">⚠ Os participantes de grupos de terceiros não são importados automaticamente. Cada interessado precisa se cadastrar e confirmar o próprio número. Este sistema <b>não faz disparos automáticos</b>.</div>
      <section class="stats-v2" aria-label="Indicadores">
        <div class="metric"><small>Visitas ao convite</small><b id="statVisits">—</b><small>Todos os canais</small></div>
        <div class="metric"><small>Cliques no grupo</small><b id="statClicks">—</b><small>Convites abertos</small></div>
        <div class="metric"><small>Autorizados</small><b id="statActive">—</b><small>Confirmação recebida</small></div>
        <div class="metric"><small>Aguardando</small><b id="statPending">—</b><small>Pré-cadastro realizado</small></div>
      </section>
      <section class="board">
        <article class="card" id="campaignCard">
          <div class="mini-label">01 · Parcerias e comunidades</div>
          <h2>Criar link de convite</h2>
          <p>Compartilhe a mensagem somente quando o administrador do grupo permitir. A página também oferece cadastro individual opcional.</p>
          <div class="form-stack">
            <div><label for="campaignSlug">Identificador da campanha</label><input id="campaignSlug" value="parceria-01" maxlength="32" placeholder="ex.: grupo-eletronicos"></div>
            <div><label>Link rastreável</label><div id="campaignLink" class="link-preview local">Aguardando...</div></div>
            <div class="actions"><button type="button" class="secondary" id="copyInvite">Copiar mensagem de convite</button><button type="button" class="ghost" id="copyUrl">Copiar link</button></div>
          </div>
          <p id="publicWarning" class="fineprint">Antes da divulgação externa, publique a página num endereço HTTPS.</p>
        </article>
        <article class="card" id="senderCard">
          <div class="mini-label">02 · Número dedicado</div>
          <h2>WhatsApp secundário</h2>
          <p>Registre o número separado que receberá as mensagens de confirmação voluntárias. Um eSIM não conecta o WhatsApp automaticamente.</p>
          <form id="senderForm" class="form-stack">
            <div><label for="senderNumber">WhatsApp Business com DDD</label><input id="senderNumber" inputmode="tel" placeholder="(11) 99999-9999" autocomplete="off"></div>
            <div class="actions"><button class="primary" type="submit">Salvar número</button><span class="badge wait" id="senderStatus">Não configurado</span></div>
          </form>
          <p class="fineprint">Após cadastrar o número, o visitante poderá iniciar uma conversa e enviar <strong>QUERO VIP + código</strong>. A confirmação precisa ser verificada por você.</p>
        </article>
      </section>
      <section class="card" id="contactsCard">
        <div class="section-heading">
          <div><div class="mini-label">03 · Contatos com permissão</div><h2>Planilha de interessados</h2></div>
          <div class="actions"><a class="button secondary" id="exportCsv" href="/api/admin/contatos.csv" download="contatos-autorizados.csv">↓ Exportar CSV</a><a class="button secondary" id="exportModel" href="/api/admin/modelo.xlsx" download="Modelo_Contatos_Autorizados.xlsx">Modelo Excel</a></div>
        </div>
        <p>O cadastro começa <strong>pendente</strong>. Somente após você conferir a mensagem iniciada pelo interessado no segundo WhatsApp o contato passa para <strong>autorizado</strong>.</p>
        <div class="tools">
          <input id="searchContacts" type="search" placeholder="Buscar por nome, telefone ou origem" aria-label="Buscar contatos">
          <select id="filterContacts" style="max-width:220px" aria-label="Filtrar contatos"><option value="todos">Todos os contatos</option><option value="pendente">Aguardando confirmação</option><option value="ativo">Autorizados</option><option value="descadastrado">Descadastrados</option></select>
        </div>
        <div class="table-scroll"><table class="crm-table"><thead><tr><th>Contato</th><th>Origem</th><th>Situação</th><th>Consentimento</th><th>Ação</th></tr></thead><tbody id="contactsBody"><tr><td colspan="5">Carregando…</td></tr></tbody></table></div>
        <p class="fineprint">O arquivo CSV inclui a data de autorização e o registro de confirmação. Não importe listas obtidas de participantes de grupos.</p>
      </section>
      <section class="grid2" style="margin-top:18px">
        <article class="card"><div class="mini-label">04 · Campanhas individuais</div><h2>Envio supervisionado</h2><p>Selecione um contato autorizado para preparar uma mensagem. Você abre a conversa, confere que está usando o <strong>segundo WhatsApp</strong> e decide enviar manualmente.</p><div class="alert">Sem disparos em massa, sem troca automática de contas e sem envios a contatos pendentes ou descadastrados.</div></article>
        <article class="card"><div class="mini-label">05 · Mensuração</div><h2>Origem dos interessados</h2><div class="table-scroll"><table class="crm-table" style="min-width:0"><thead><tr><th>Origem</th><th>Visitas</th><th>Cliques</th></tr></thead><tbody id="originsBody"><tr><td colspan="3">Sem dados.</td></tr></tbody></table></div><p class="fineprint">Um clique no link do grupo não confirma adesão ao WhatsApp.</p></article>
      </section>
      <div class="alert" id="appFeedback" role="status" aria-live="polite" hidden></div>
    </main>
  </div>

  <dialog id="confirmDialog" class="dialog"><form method="dialog" id="confirmForm">
    <div class="mini-label">Confirmar solicitação real</div><h2>Autorização recebida?</h2>
    <p>Abra o <strong>segundo WhatsApp</strong> e confirme que o próprio interessado iniciou a conversa com <strong>QUERO VIP</strong> e o código abaixo.</p>
    <p>Código esperado: <span class="code-pill" id="expectedCode"></span></p>
    <label for="receivedCode">Código que aparece na mensagem recebida</label><input id="receivedCode" autocomplete="off" maxlength="6" required placeholder="XXXXXX">
    <label class="consent-box" style="margin:13px 0"><input id="verifiedCheckbox" type="checkbox"><span>Eu conferi a mensagem recebida no número secundário.</span></label>
    <div class="actions"><button type="button" class="primary" id="confirmSave">Confirmar autorização</button><button type="button" class="ghost" id="confirmCancel">Cancelar</button></div>
  </form></dialog>
  <dialog id="messageDialog" class="dialog"><div class="mini-label">Prévia de convite individual</div><h2>Mensagem pronta para revisão</h2><p>Somente contatos confirmados. O botão abaixo <b>não envia</b>; ele abre o WhatsApp para você revisar e enviar pela conta secundária.</p><textarea readonly id="messageText"></textarea><div class="actions" style="margin-top:14px"><a id="openWhatsapp" class="button primary" href="#" target="_blank" rel="noopener noreferrer">Abrir conversa ↗</a><button class="secondary" id="copyMessage" type="button">Copiar texto</button><button class="ghost" type="button" id="markSent">Registrar envio manual</button><button class="ghost" type="button" id="messageClose">Fechar</button></div><p class="fineprint">Não há comprovação automática de envio. Registre-o somente se você realmente enviou.</p></dialog>
`, '/assets/painel.js');
}

export function renderDescadastro() {
  return htmlPage('Descadastro | Caça Promos VIP', `
    <div class="container"><header>${brand}<span class="tag">Preferências de mensagens</span></header><main class="login-view card">
      <div class="mini-label">Você controla suas mensagens</div><h1 style="font-size:36px">Parar de receber <span>convites.</span></h1>
      <p>Para cancelar o envio de mensagens individuais do Caça Promos VIP para seu número, confirme abaixo. Sua participação no grupo WhatsApp é independente.</p>
      <button id="unsubscribeButton" class="primary" type="button">Confirmar descadastro</button><div id="unsubscribeMessage" class="alert" hidden></div>
    </main></div>`, '/assets/descadastro.js');
}
