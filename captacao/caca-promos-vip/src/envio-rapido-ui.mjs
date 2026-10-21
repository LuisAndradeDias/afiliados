// Tela principal do convite individual. As filas antigas seguem disponíveis em /campanhas.
// Preenche o modelo salvo no HTML para funcionar antes mesmo do JS carregar.
// Dados configurados sao escapados para impedir qualquer injecao de HTML.
function escaparHtml(valor=''){
  return String(valor??'').replace(/[&<>"']/g,caractere=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  })[caractere]);
}
export function renderEnvioRapido({mensagem='',grupoUrl=''}={}){
  const texto=escaparHtml(mensagem);
  const grupo=escaparHtml(grupoUrl);
  const tamanho=String(mensagem??'').length;
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0d1520"><meta name="referrer" content="no-referrer">
<title>Enviar convite | Caça Promos VIP</title>
<link rel="icon" href="/favicon.svg">
<link rel="stylesheet" href="/assets/painel-theme.css">
<link rel="stylesheet" href="/assets/envio-rapido.css">
<script defer src="/assets/envio-rapido.js"></script>
</head><body data-page="enviar">
<header class="site-header"><div class="container header-inner">
  <a class="app-brand" href="/inicio" aria-label="Visão geral">
    <span class="app-mark" aria-hidden="true">CP</span>
    <span><strong>CAÇA PROMOS <em>VIP</em></strong><small>Central de gestão</small></span>
  </a>
  <nav class="site-nav" aria-label="Navegação principal">
    <a class="nav-link" href="/inicio">Visão geral</a>
    <a class="nav-link is-active" href="/enviar" aria-current="page">Enviar convite</a>
    <a class="nav-link" href="/contatos">Contatos</a>
    <a class="nav-link" href="/campanhas">Listas e filas</a>
    <a class="nav-link" href="/denuncias">Denúncias</a>
  </nav>
  <span class="local-status" title="Acesso somente neste computador"><i></i> Local</span>
</div></header>
<main class="container main-area quick-layout">
  <section class="quick-intro">
    <div class="quick-intro-copy">
      <span class="overline">WHATSAPP WEB · ENVIO SUPERVISIONADO</span>
      <h1>Seu próximo convite,<br><em>sem complicação.</em></h1>
      <p>Comece com <strong>seu próprio número</strong> ou escolha um contato autorizado.
        A gente prepara a conversa; você confere e decide quando enviar.</p>
      <div class="quick-labels"><span>✓ Sem importar planilha</span><span>✓ Um número por vez</span><span>✓ Sem API paga</span></div>
    </div>
    <div class="quick-overview" aria-label="Resumo operacional">
      <div class="quick-overview-head"><span class="quick-live-dot"></span> Painel preparado para testes</div>
      <div class="quick-overview-stats"><div><strong id="quickAllowed">—</strong><small>Contatos autorizados</small></div>
        <div><strong id="quickDay">—</strong><small>Conversas iniciadas hoje</small></div></div>
      <p id="quickOverallStatus">Verificando conexão e permissões...</p>
    </div>
  </section>
  <div class="quick-workspace">
    <div class="quick-main">
      <nav class="quick-progress" aria-label="Etapas do envio">
        <div class="quick-progress-item is-active" id="quickStep1"><span>1</span><b>Escolher contato</b></div>
        <div class="quick-progress-line"></div>
        <div class="quick-progress-item" id="quickStep2"><span>2</span><b>Conferir convite</b></div>
        <div class="quick-progress-line"></div>
        <div class="quick-progress-item" id="quickStep3"><span>3</span><b>Abrir WhatsApp</b></div>
      </nav>
      <section class="quick-panel" id="quickStage1" aria-labelledby="quickTitle1">
        <div class="quick-panel-head"><span class="quick-number">01</span><div>
          <span class="overline">DESTINATÁRIO</span><h2 id="quickTitle1">Para quem vamos enviar?</h2>
          <p>Para testar, você só precisa informar seu próprio número.</p>
        </div></div>
        <div class="quick-choice-row" role="group" aria-label="Tipo de destinatário">
          <button type="button" class="quick-choice is-chosen" id="quickChooseSelf" aria-pressed="true">
            <span class="quick-choice-symbol">↗</span><strong>Enviar para mim</strong>
            <small>Primeiro teste, no seu celular</small></button>
          <button type="button" class="quick-choice" id="quickChooseOther" aria-pressed="false">
            <span class="quick-choice-symbol">◎</span><strong>Outro contato</strong>
            <small>Já autorizado a receber convites</small></button>
        </div>
        <div id="quickSelf">
          <label class="quick-field-label" for="quickPhone">Seu WhatsApp com DDD</label>
          <div class="quick-inline"><input id="quickPhone" type="tel" inputmode="tel" autocomplete="tel"
            placeholder="Ex.: (31) 99999-9999" maxlength="25">
            <button id="quickLookup" class="btn btn-primary" type="button">Verificar número</button></div>
          <p class="quick-help">Não usamos este número para nenhum envio sem sua confirmação.</p>
          <div id="quickSelfResult" class="quick-message" role="status" aria-live="polite" hidden></div>
          <div id="quickNewContact" class="quick-new" hidden>
            <h3>Cadastrar meu número para teste</h3>
            <p>Este número ainda não tem autorização registrada. Cadastre-o apenas se for seu.</p>
            <label class="quick-field-label" for="quickNewName">Como deseja identificar o contato?</label>
            <input id="quickNewName" type="text" maxlength="80" placeholder="Ex.: Meu WhatsApp de testes">
            <label class="quick-checkbox"><input id="quickOwnerConsent" type="checkbox">
              <span>Confirmo que <strong>sou titular deste número</strong> e autorizo receber este convite de teste.</span></label>
            <button id="quickRegister" type="button" class="btn btn-primary">Cadastrar meu número</button>
          </div>
          <div id="quickBlocked" class="quick-guidance" hidden>
            <strong>Este número não pode receber novos convites.</strong>
            <p>Ele já foi bloqueado ou solicitou saída. Se for seu teste, abra a ficha
              e registre a nova autorização antes de continuar.</p>
            <a class="btn btn-quiet" href="/contatos?filtro=bloqueado">Ir para contatos bloqueados →</a>
          </div>
        </div>
        <div id="quickOther" hidden>
          <label class="quick-field-label" for="quickSearch">Buscar contato autorizado</label>
          <div class="quick-inline"><input id="quickSearch" type="search" autocomplete="off"
            placeholder="Digite nome ou os últimos 4 números">
            <button class="btn btn-quiet" type="button" id="quickSearchButton">Buscar</button></div>
          <p class="quick-help">Só serão exibidos contatos com autorização válida.</p>
          <div id="quickSearchResults" class="quick-results" aria-live="polite"></div>
        </div>
        <div id="quickSelected" class="quick-selected" hidden>
          <div><span class="overline">DESTINATÁRIO ESCOLHIDO</span>
            <strong id="quickSelectedName">—</strong><small id="quickSelectedPhone">—</small></div>
          <span class="quick-check">✓ Autorizado</span>
        </div>
        <div class="quick-bottom">
          <span id="quickStep1Hint">Informe seu número e clique em Verificar número.</span>
          <button class="btn btn-primary" id="quickGoMessage" type="button" disabled>Continuar <span aria-hidden="true">→</span></button>
        </div>
      </section>
      <section class="quick-panel" id="quickStage2" aria-labelledby="quickTitle2" hidden>
        <div class="quick-panel-head"><span class="quick-number">02</span><div>
          <span class="overline">MENSAGEM</span><h2 id="quickTitle2">Confira antes de preparar</h2>
          <p>Você pode editar a mensagem e o link do grupo aqui mesmo.</p>
        </div></div>
        <div class="quick-destination-strip"><span>Vai para</span><strong id="quickMessageTarget">—</strong>
          <button id="quickChangeTarget" class="quick-text-link" type="button">Trocar</button></div>
        <div class="quick-template-head">
          <label class="quick-field-label" for="quickText">Mensagem do convite</label>
          <button id="quickRestoreModel" class="quick-text-link" type="button"
            title="Restaurar a mensagem e o grupo salvos">Restaurar padrão</button>
        </div>
        <textarea id="quickText" rows="8" maxlength="1024" spellcheck="true" required
          placeholder="Digite sua mensagem...">${texto}</textarea>
        <div class="quick-field-meta">
          <span>Seu modelo salvo aparece automaticamente e continua disponível para próximos convites.</span>
          <strong id="quickTextCount">${tamanho} / 1.024</strong></div>
        <label class="quick-field-label" for="quickGroup">Link do grupo de ofertas</label>
        <input id="quickGroup" type="url" maxlength="160" placeholder="https://chat.whatsapp.com/..."
          value="${grupo}" required>
        <p class="quick-help">O painel adicionará automaticamente o link do grupo, a opção
          <strong>Não tenho interesse</strong> e a instrução SAIR, quando disponíveis.</p>
        <div class="quick-bottom">
          <button type="button" class="btn btn-quiet" id="quickBack1">← Voltar</button>
          <button type="button" class="btn btn-primary" id="quickCreate">Salvar e preparar 1 convite →</button>
        </div>
        <p class="quick-safe-note">Este botão não envia mensagens. Ele só prepara o registro do seu convite.</p>
      </section>
      <section class="quick-panel" id="quickStage3" aria-labelledby="quickTitle3" hidden>
        <div class="quick-panel-head"><span class="quick-number">03</span><div>
          <span class="overline">WHATSAPP WEB</span><h2 id="quickTitle3">Agora é só conferir e enviar</h2>
          <p>O Chrome abre a conversa. O envio acontece somente depois da sua confirmação.</p>
        </div></div>
        <div class="quick-destination-strip"><span>Destinatário</span>
          <strong id="quickSendTarget">—</strong><span class="quick-check">✓ 1 pessoa</span></div>
        <div class="quick-preview">
          <div class="quick-preview-top"><span class="quick-avatar">CP</span>
            <div><strong>Mensagem preparada</strong><small>Prévia exata deste destinatário</small></div></div>
          <div id="quickFinalText" class="quick-preview-text"></div>
          <div class="quick-preview-tools">
            <span>Seu texto continua salvo aqui, mesmo se desaparecer do WhatsApp.</span>
            <button class="btn btn-quiet" type="button" id="quickCopyText">Copiar mensagem</button>
          </div>
        </div>
        <p class="quick-draft-help">Se o campo do WhatsApp ficar vazio, confira se surgiu uma nova
          mensagem na conversa. <strong>Campo vazio não significa que foi enviada.</strong></p>
        <details class="quick-connection" id="quickConnectionDisclosure">
          <summary><span>Precisa conectar seu WhatsApp?</span>
            <small id="quickConnectionBrief">Verificando...</small></summary>
          <div class="quick-connection-body">
            <p id="quickConnectionStatus">Verificando a sessão do Chrome...</p>
            <div class="quick-inline quick-wrap">
              <button id="quickConnect" class="btn btn-quiet" type="button">Abrir WhatsApp Web para conectar</button>
              <button id="quickCloseConnect" class="btn btn-quiet" type="button" disabled>Salvar sessão e fechar</button>
              <button id="quickRefreshConnect" class="btn btn-quiet" type="button">Verificar</button>
            </div>
            <p class="quick-help">Se aparecer QR Code, no celular use WhatsApp → Aparelhos conectados →
              Conectar aparelho. Depois feche a janela de conexão acima antes de preparar o convite.</p>
          </div>
        </details>
        <div class="quick-send-box">
          <div class="quick-send-status"><span class="quick-live-dot"></span>
            <span id="quickChromeStatus" role="status" aria-live="polite">Pronto para preparar a conversa.</span></div>
          <button class="btn btn-primary quick-action" type="button" id="quickPrepareChrome">1. Abrir conversa no Chrome →</button>
          <button class="btn btn-primary quick-action" type="button" id="quickConfirmChrome" disabled>2. Confirmar e enviar esta mensagem</button>
          <button class="btn btn-quiet" type="button" id="quickCancelChrome" disabled>Cancelar conversa sem enviar</button>
        </div>
        <details class="quick-manual" id="quickManualDisclosure"><summary>Usar WhatsApp manualmente, se o Chrome não funcionar</summary>
          <p>Abra o link abaixo, confira o número e envie você mesmo pelo WhatsApp. Não marque como enviado antes disso.</p>
          <a id="quickManualLink" class="btn btn-quiet" href="#" target="_blank" rel="noopener noreferrer">Abrir conversa manualmente ↗</a>
          <label class="quick-checkbox"><input id="quickManualCheck" type="checkbox">
            <span>Confirmo que a mensagem foi realmente enviada nessa conversa.</span></label>
          <button class="btn btn-quiet" id="quickManualDone" type="button" disabled>Registrar que enviei manualmente</button>
        </details>
        <div id="quickResult" class="quick-result" role="status" aria-live="polite" hidden></div>
        <div class="quick-bottom">
          <a class="btn btn-quiet" href="/campanhas#manualStage">Ver histórico e filas →</a>
          <button class="btn btn-quiet" type="button" id="quickStartOver">Preparar outro convite</button>
        </div>
      </section>
    </div>
    <aside class="quick-aside">
      <section class="quick-info"><span class="overline">ENTENDA O SISTEMA</span>
        <h2>Não precisa entender filas para testar.</h2>
        <div class="quick-definition"><span class="quick-definition-number">01</span>
          <div><strong>Contato</strong><p>É a pessoa autorizada que vai receber a mensagem. Pode ser você mesmo.</p></div></div>
        <div class="quick-definition"><span class="quick-definition-number">02</span>
          <div><strong>Convite preparado</strong><p>É uma mensagem pronta para um único número. Ainda não foi enviada.</p></div></div>
        <div class="quick-definition"><span class="quick-definition-number">03</span>
          <div><strong>Fila</strong><p>É só o histórico e a ordem de vários convites. Para o seu teste, cuidamos disso automaticamente.</p></div></div>
      </section>
      <section class="quick-info quick-support">
        <span class="overline">PRECISA DE OUTRA COISA?</span>
        <h3>Ferramentas de gestão</h3>
        <a href="/campanhas#importStage">Importar planilha de contatos <span>↗</span></a>
        <a href="/campanhas#manualStage">Ver todas as listas e filas <span>↗</span></a>
        <a href="/contatos?filtro=bloqueado">Desbloquear meu contato de teste <span>↗</span></a>
      </section>
    </aside>
  </div>
  <footer class="quick-footer">Caça Promos VIP · Funciona no ACER · WhatsApp supervisionado · Nenhum envio sem clique explícito</footer>
  <div class="quick-toast" id="quickToast" role="alert" hidden></div>
</main></body></html>`;
}
