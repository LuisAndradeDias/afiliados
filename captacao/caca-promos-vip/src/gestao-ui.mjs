const ITENS=[
  {href:'/inicio',label:'Visão geral',chave:'inicio'},
  {href:'/contatos',label:'Contatos',chave:'contatos'},
  {href:'/enviar',label:'Enviar convite',chave:'enviar'},
  {href:'/respostas-botoes',label:'Respostas dos botões',chave:'respostas'},
  {href:'/campanhas',label:'Listas e filas',chave:'campanhas'},
  {href:'/denuncias',label:'Denúncias',chave:'denuncias'},
];

function nav(ativo){
  return ITENS.map(n=>`<a href="${n.href}" class="nav-link${ativo===n.chave?' is-active':''}"${ativo===n.chave?' aria-current="page"':''}>${n.label}</a>`).join('');
}
function estatistica(label,id,legenda,tipo=''){
  return `<article class="stat-card ${tipo}" aria-label="${label}">
    <span class="stat-label">${label}</span>
    <strong id="${id}" class="stat-number" aria-live="polite">—</strong>
    <small>${legenda}</small>
  </article>`;
}
function shell(pagina,conteudo){
  return `<!doctype html><html lang="pt-BR"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#101923"><meta name="referrer" content="no-referrer">
  <title>${pagina==='inicio'?'Visão geral':pagina==='contatos'?'Contatos':pagina==='respostas'?'Respostas dos botões':'Denúncias'} | Caça Promos VIP</title>
  <link rel="icon" href="/favicon.svg">
  <link rel="stylesheet" href="/assets/painel-theme.css">
  <script defer src="/assets/gestao.js"></script>
  ${pagina==='respostas'?'<script defer src="/assets/respostas-botoes.js"></script>':''}
  </head><body data-page="${pagina}">
  <header class="site-header"><div class="container header-inner">
    <a class="app-brand" href="/inicio" aria-label="Voltar para visão geral">
      <span class="app-mark" aria-hidden="true">CP</span>
      <span><strong>CAÇA PROMOS <em>VIP</em></strong><small>Central de gestão</small></span>
    </a>
    <nav class="site-nav" aria-label="Navegação principal">${nav(pagina)}</nav>
    <span class="local-status" title="Acesso permitido somente neste computador"><i></i> Local</span>
  </div></header>
  <main id="main" class="container main-area">${conteudo}</main>
  <footer class="container site-footer">Caça Promos VIP · Telefones e nomes ficam no ACER · O Netlify recebe somente identificadores assinados</footer>
  <div id="notification" class="notification" role="status" aria-live="polite" hidden></div>
  </body></html>`;
}
const home=`
<section class="page-heading">
  <div><span class="overline">CENTRAL DE CAMPANHAS</span><h1>Visão geral</h1>
  <p>O que precisa de atenção, sem misturar contatos, convites e denúncias.</p></div>
  <a class="btn btn-primary" href="/enviar">Enviar para mim / testar <span aria-hidden="true">↗</span></a>
</section>
<section class="stats-grid" aria-label="Resumo da operação">
  ${estatistica('Contatos cadastrados','homeTotal','No seu cadastro local')}
  ${estatistica('Autorizados','homeAllowed','Liberados para novos convites','stat-ok')}
  ${estatistica('Bloqueados','homeBlocked','Não podem receber mensagens','stat-danger')}
  ${estatistica('Denúncias','homeComplaints','Registradas internamente','stat-attention')}
</section>
<section class="section-heading"><div><span class="overline">ACESSOS RÁPIDOS</span><h2>O que deseja fazer?</h2></div></section>
<section class="action-grid" aria-label="Áreas de trabalho">
  <a class="action-card" href="/contatos"><span class="action-glyph" aria-hidden="true">01</span><strong>Gerenciar contatos</strong>
    <span>Consulte autorizados, bloqueados, pendentes e descadastros. Pesquise por nome ou número.</span><b>Ver contatos →</b></a>
  <a class="action-card" href="/campanhas"><span class="action-glyph" aria-hidden="true">02</span><strong>Preparar convites</strong>
    <span>Importe a planilha, salve sua mensagem e prepare cada conversa no WhatsApp Web.</span><b>Abrir convites →</b></a>
  <a class="action-card" href="/respostas-botoes"><span class="action-glyph" aria-hidden="true">03</span><strong>Respostas dos botões</strong>
    <span>Consulte quem aceitou, recusou ou precisa de verificação antes do convite.</span><b>Ver respostas →</b></a>
  <a class="action-card" href="/denuncias"><span class="action-glyph" aria-hidden="true">04</span><strong>Conferir denúncias</strong>
    <span>Veja solicitações recebidas pelo Netlify e o estado da sincronização.</span><b>Ver denúncias →</b></a>
</section>
<div class="two-columns">
  <section class="panel"><div class="panel-head"><div><h2>Situação dos envios</h2><p>Dados atuais das filas existentes.</p></div>
    <a class="text-link" href="/campanhas#manualStage">Gerenciar filas avançadas →</a></div>
    <div class="health-grid"><span>Filas cadastradas</span><strong id="homeQueues">—</strong>
      <span>Contatos aguardando nas filas</span><strong id="homePending">—</strong>
      <span>WhatsApp Web</span><strong id="homeWhatsapp">Verificando</strong></div>
  </section>
  <section class="panel"><div class="panel-head"><div><h2>Últimas denúncias</h2>
    <p>Reclamações confirmadas pelos destinatários.</p></div>
    <a class="text-link" href="/denuncias">Ver todas →</a></div>
    <div id="homeLatest" class="compact-feed"><div class="state-empty">Consultando registros…</div></div>
  </section>
</div>`;
const contacts=`
<section class="page-heading"><div><span class="overline">CADASTRO E AUTORIZAÇÕES</span>
  <h1>Contatos</h1><p>Encontre rapidamente quem pode receber convites e quem está protegido contra novos envios.</p></div>
  <a class="btn btn-primary" href="/enviar">Enviar convite individual <span aria-hidden="true">↗</span></a>
</section>
<section class="stats-grid stats-grid-5" aria-label="Situação dos contatos">
  ${estatistica('Total cadastrado','ctTotal','Registros locais')}
  ${estatistica('Autorizados','ctAllowed','Consentimento registrado','stat-ok')}
  ${estatistica('Bloqueados','ctBlocked','Denúncias ou bloqueio manual','stat-danger')}
  ${estatistica('Descadastrados','ctRemoved','Sem bloqueio por denúncia','stat-attention')}
  ${estatistica('Pendentes','ctPending','Aguardam confirmação')}
</section>
<section class="panel contact-panel" aria-labelledby="listTitle">
  <div class="panel-head"><div><h2 id="listTitle">Sua lista de contatos</h2>
    <p>O número é exibido parcialmente por privacidade. Bloqueados não voltam a receber convites após importações.</p></div>
    <button type="button" class="btn btn-quiet" id="contactsRefresh">Atualizar lista</button>
  </div>
  <div class="tabbar" id="contactFilters" role="group" aria-label="Filtrar situação">
    <button class="filter-tab is-selected" type="button" data-filter="todos" aria-pressed="true">Todos</button>
    <button class="filter-tab" type="button" data-filter="autorizado" aria-pressed="false">Autorizados</button>
    <button class="filter-tab" type="button" data-filter="bloqueado" aria-pressed="false">Bloqueados</button>
    <button class="filter-tab" type="button" data-filter="descadastrado" aria-pressed="false">Descadastrados</button>
    <button class="filter-tab" type="button" data-filter="pendente" aria-pressed="false">Pendentes</button>
    <button class="filter-tab" type="button" data-filter="sem-autorizacao" aria-pressed="false">Sem autorização</button>
  </div>
  <div class="toolbar-light"><label class="search-box" for="contactSearch"><span class="search-icon" aria-hidden="true">⌕</span>
    <input id="contactSearch" type="search" placeholder="Buscar nome ou últimos 4 dígitos" autocomplete="off"></label>
    <span id="contactResults" class="result-count" aria-live="polite">Carregando...</span>
  </div>
  <div class="table-scroll">
    <table class="contact-table"><thead><tr>
      <th scope="col">Contato</th><th scope="col">Número</th><th scope="col">Situação</th>
      <th scope="col">Origem</th><th scope="col"><span class="sr-only">Detalhes</span></th>
    </tr></thead><tbody id="contactsBody">
      <tr><td colspan="5" class="state-empty">Carregando contatos...</td></tr>
    </tbody></table>
  </div>
  <div class="pagination">
    <p id="contactsPageInfo" aria-live="polite">Página —</p>
    <div><button type="button" class="btn btn-quiet" id="previousPage" disabled>← Anterior</button>
      <button type="button" class="btn btn-quiet" id="nextPage" disabled>Próxima →</button></div>
  </div>
</section>
<p class="context-note"><strong>Importante:</strong> contatos bloqueados não recebem novos convites.
  Para reativar um número (inclusive um teste seu), abra sua ficha, confirme a nova autorização do titular
  e use <strong>Desbloquear contato</strong>. Filas antigas permanecem encerradas.</p>
<dialog class="contact-dialog" id="contactDialog" aria-labelledby="contactDialogTitle">
  <div class="dialog-header"><div><span class="overline">FICHA DO CONTATO</span><h2 id="contactDialogTitle">Contato</h2>
    <p id="detailPhone">Número mascarado</p></div>
    <button class="icon-close" id="detailClose" type="button" aria-label="Fechar detalhes">×</button></div>
  <div id="detailStatus" class="dialog-status"></div>
  <dl id="detailFields" class="detail-fields"></dl>
  <div id="detailHistory" class="history-block"></div>
  <form id="unlockForm" class="unlock-form" hidden>
    <h3>Confirmar nova autorização</h3>
    <p>Desbloqueie somente se o titular voltou a autorizar convites. O registro antigo permanece no histórico.</p>
    <label for="unlockOrigin">Onde ocorreu a nova autorização?</label>
    <input id="unlockOrigin" name="origemAutorizacao" required minlength="6" maxlength="140"
      placeholder="Ex.: conversa no WhatsApp com o titular" autocomplete="off">
    <label for="unlockDate">Data da nova autorização</label>
    <input id="unlockDate" name="dataAutorizacao" type="date" required>
    <label for="unlockReference">Referência para comprovar a autorização</label>
    <textarea id="unlockReference" name="referenciaAutorizacao" rows="2"
      required minlength="8" maxlength="240"
      placeholder="Ex.: autorização recebida do titular; anote onde conferir"></textarea>
    <label class="unlock-checkbox">
      <input id="unlockConsent" type="checkbox" required>
      <span>Confirmo que este número autorizou novamente os convites após o bloqueio.</span>
    </label>
    <p class="unlock-warning">Isso não envia mensagens nem reativa filas antigas. Para convidar novamente, crie uma nova fila.</p>
    <div class="dialog-actions">
      <button type="button" class="btn btn-quiet" id="cancelUnlock">Cancelar</button>
      <button type="submit" class="btn btn-primary" id="confirmUnlock">Confirmar desbloqueio</button>
    </div>
  </form>
  <div class="dialog-actions" id="contactActions">
    <button class="btn btn-danger" id="blockContact" type="button" hidden>Bloquear novos convites</button>
    <button class="btn btn-quiet" id="unlockContact" type="button" hidden>Desbloquear contato</button>
    <button class="btn btn-quiet" id="detailDone" type="button">Fechar</button>
  </div>
  <p class="dialog-foot">Bloquear não inventa uma denúncia. Desbloquear exige nova autorização documentada e mantém o histórico.</p>
</dialog>`;
const reports=`
<section class="page-heading"><div><span class="overline">SEGURANÇA E PREFERÊNCIAS</span>
  <h1>Denúncias e bloqueios</h1><p>Solicitações reais recebidas por link ou registradas no painel, com histórico local.</p></div>
  <button class="btn btn-primary" type="button" id="syncNow">Buscar denúncias no Netlify</button>
</section>
<section class="stats-grid stats-grid-5" aria-label="Resumo de denúncias">
  ${estatistica('Denúncias registradas','repComplaints','Reclamações internas','stat-attention')}
  ${estatistica('Bloqueios persistentes','repBlocked','Mesmo após reimportação','stat-danger')}
  ${estatistica('Pedidos de saída','repExits','Descadastros registrados')}
  ${estatistica('Reativações','repReactivated','Novas autorizações','stat-ok')}
  ${estatistica('Sincronização','repSync','Estado da conexão com Netlify')}
</section>
<section class="panel">
  <div class="panel-head"><div><h2>Histórico de ocorrências</h2>
    <p>Números mascarados. Somente fatos realmente registrados; bloqueios administrativos não são denúncias do WhatsApp.</p></div>
    <span class="soft-label" id="lastSync">Aguardando status</span>
  </div>
  <div class="tabbar" role="group" id="reportFilters" aria-label="Filtrar ocorrências">
    <button type="button" data-filter="todos" class="filter-tab is-selected" aria-pressed="true">Todas</button>
    <button type="button" data-filter="denuncia-convite" class="filter-tab" aria-pressed="false">Denúncias</button>
    <button type="button" data-filter="saida-solicitada" class="filter-tab" aria-pressed="false">Pedidos de saída</button>
    <button type="button" data-filter="bloqueio-administrativo" class="filter-tab" aria-pressed="false">Administrativos</button>
    <button type="button" data-filter="reativacao-autorizada" class="filter-tab" aria-pressed="false">Reativações</button>
  </div>
  <div id="reportList" class="report-list"><div class="state-empty">Consultando ocorrências…</div></div>
  <div class="panel-bottom"><a class="text-link" href="/contatos?filtro=bloqueado">Ver contatos bloqueados →</a></div>
</section>
<p class="context-note">Ao confirmar a denúncia no Netlify, a solicitação é armazenada até o ACER sincronizar. O bloqueio local é aplicado após a sincronização. Isso <strong>não</strong> é uma denúncia oficial ao WhatsApp.</p>`;

const responses=`
<section class="page-heading">
  <div><span class="overline">WHATSAPP • BOTÕES INTERATIVOS</span>
    <h1>Respostas dos botões</h1>
    <p>Acompanhe cliques reais, pedidos de entrada e recusas. Nada é enviado automaticamente.</p>
  </div>
  <a class="btn btn-quiet" href="http://127.0.0.1:4000/manager" target="_blank" rel="noopener noreferrer">Abrir WhatyGo ↗</a>
</section>
<section class="stats-grid stats-grid-5" aria-label="Resumo dos cliques">
  ${estatistica('Respostas recebidas','rbAll','Identificadas pelo webhook')}
  ${estatistica('Aceites','rbAccept','Intenção de participar','stat-ok')}
  ${estatistica('Recusas','rbDecline','Pediu para não receber','stat-danger')}
  ${estatistica('Bloqueios','rbBlocked','Novos convites impedidos','stat-attention')}
  ${estatistica('Pendentes','rbPending','Precisam de confirmação')}
</section>
<section class="panel">
  <div class="panel-head"><div><h2>Histórico das respostas</h2>
    <p>Identificadores e telefones parcialmente ocultos. Só cliques com remetente verificável podem bloquear.</p>
    </div><button type="button" class="btn btn-quiet" id="rbRefresh">Atualizar</button>
  </div>
  <div id="rbFeedback" class="context-note" role="status" aria-live="polite">Carregando respostas verificadas...</div>
  <div class="tabbar" id="rbFilters" role="group" aria-label="Filtrar cliques">
    <button class="filter-tab is-selected" aria-pressed="true" data-choice="todos" type="button">Todas</button>
    <button class="filter-tab" aria-pressed="false" data-choice="aceitar" type="button">Entrar no grupo</button>
    <button class="filter-tab" aria-pressed="false" data-choice="recusar" type="button">Não tenho interesse</button>
    <button class="filter-tab" aria-pressed="false" data-choice="pendentes" type="button">Pendentes</button>
  </div>
  <div class="table-scroll">
    <table class="contact-table"><thead><tr><th scope="col">Quando</th>
      <th scope="col">Contato</th><th scope="col">Resposta</th>
      <th scope="col">Situação</th><th scope="col">Próxima ação</th>
    </tr></thead>
    <tbody id="rbRows"><tr><td colspan="5" class="state-empty">Aguardando eventos...</td></tr></tbody></table>
  </div>
  <div class="panel-bottom"><small>O clique em “Entrar” não desbloqueia contatos e não inclui pessoas no grupo. A recusa verificada impede novos convites no cadastro local.</small></div>
</section>
<p class="context-note"><strong>Privacidade:</strong> eventos anteriores à ativação desta integração não possuíam identidade verificável e não foram importados. Para enviar um convite, confira o consentimento e utilize o link manualmente.</p>`;

export function renderGestao(pagina='inicio'){
  if(!['inicio','contatos','denuncias','respostas'].includes(pagina))throw new Error('Página desconhecida.');
  return shell(pagina,{inicio:home,contatos:contacts,denuncias:reports,respostas:responses}[pagina]);
}
