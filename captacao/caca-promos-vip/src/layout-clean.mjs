/**
 * Clean 2026 navigation for the LOCAL Central only.
 * This decorates existing HTML; it never changes send, consent or block logic.
 */
const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  message: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.5 9.5 0 0 1-4-.9L3 21l1.9-5A8.9 8.9 0 0 1 3 11.5 9 9 0 0 1 12 3a9 9 0 0 1 9 8.5z"/><path d="M8 11h8"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  lock: '<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
};
const ico = (name, extra='') => '<svg class="clean-icon '+extra+'" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[name]+'</svg>';
const pages = [
  {key:'inicio',name:'Início',href:'/inicio',icon:'home',section:'principal'},
  {key:'enviar',name:'Enviar convite',href:'/enviar',icon:'send',section:'principal'},
  {key:'respostas',name:'Respostas',href:'/respostas-botoes',icon:'message',section:'principal'},
  {key:'contatos',name:'Contatos',href:'/contatos',icon:'users',section:'gestao'},
  {key:'campanhas',name:'Filas e envios',href:'/campanhas',icon:'layers',section:'gestao'},
  {key:'denuncias',name:'Segurança',href:'/denuncias',icon:'shield',section:'gestao'},
];
function linkNav(page, current){
  const isCurrent=page.key===current;
  return '<a class="clean-nav-link'+(isCurrent?' is-current':'')+'" href="'+page.href+'"'
     +(isCurrent?' aria-current="page"':'')+'>'+ico(page.icon)+'<span>'+page.name+'</span></a>';
}
function shell(current){
  const title=pages.find(p=>p.key===current)?.name || 'Central';
  const links=pages.map(p=>p.section==='gestao'&&p.key==='contatos'
    ? '<div class="clean-nav-section" role="presentation">GERENCIAMENTO</div>'+linkNav(p,current)
    : linkNav(p,current)).join('');
  return `
  <div class="clean-overlay" id="cleanOverlay" hidden></div>
  <aside class="clean-sidebar" id="cleanSidebar" aria-label="Menu principal">
    <a class="clean-brand" href="/inicio" aria-label="Caça Promos VIP - Início">
      <span class="clean-brand-mark">CP</span>
      <span class="clean-brand-copy"><strong>CAÇA PROMOS VIP</strong><small>Central de gestão</small></span>
    </a>
    <nav class="clean-nav" aria-label="Seções da Central">
      <div class="clean-nav-section" role="presentation">PLATAFORMA</div>
      <a class="clean-global-link" href="http://127.0.0.1:3030/central" title="Abrir a Central Unificada na porta 3030">${ico('home')}<span>Central Unificada</span></a>
      <a class="clean-global-link" href="http://127.0.0.1:3030/ofertas" title="Abrir o painel de Ofertas na porta 3030">${ico('layers')}<span>Ofertas · Amazon e Meli</span></a>
      <div class="clean-nav-section" role="presentation">RELACIONAMENTO</div>
      ${links}
      <a class="clean-subnav" href="/contatos#reativar-teste">${ico('lock')}<span>Reativar número</span></a>
    </nav>
    <div class="clean-sidebar-bottom">
      <span class="clean-status-dot"></span>
      <span><strong>Central local</strong><small>Dados protegidos neste computador</small></span>
    </div>
  </aside>
  <header class="clean-topbar">
    <div class="clean-topbar-left">
      <button class="clean-menu-button" id="cleanMenuButton" type="button"
        aria-label="Abrir menu" aria-controls="cleanSidebar" aria-expanded="false">${ico('menu')}</button>
      <span class="clean-topbar-breadcrumb">Caça Promos VIP <span aria-hidden="true">/</span> <strong>${title}</strong></span>
    </div>
    <a class="clean-topbar-shortcut" href="http://127.0.0.1:3030/central" title="Abrir painel de Ofertas e visão unificada">Central Unificada ↗</a>
    <span class="clean-local-badge"><span class="clean-status-dot"></span> Local · protegido</span>
  </header>`;
}
export function aplicarLayoutClean(html,current) {
  if(typeof html!=='string'||!/<body[\s>]/i.test(html))throw new Error('Página inválida.');
  const decorated=html.replace(/<\/head>/i,
    '<link rel="stylesheet" href="/assets/layout-clean.css"><link rel="stylesheet" href="/assets/afiliados-v2.tokens.css"><link rel="stylesheet" href="/assets/afiliados-v2.css"><script defer src="/assets/layout-clean.js"></script></head>')
    .replace(/<body([^>]*)>/i,(whole,attrs)=>'<body'+attrs+' data-layout="clean">'+shell(current));
  return decorated;
}

export const inicioClean = `
<section class="clean-home-hero">
  <div><span class="clean-eyebrow">CENTRAL DE GESTÃO</span>
    <h1>Seu painel, sem complicação.</h1>
    <p>Envie convites autorizados e acompanhe o que realmente aconteceu.</p>
  </div>
</section>
<section class="clean-primary-actions" aria-label="Ações principais">
  <a class="clean-action clean-action-mint" href="/enviar">
    <span class="clean-action-icon">${ico('send')}</span>
    <strong>Enviar convite</strong>
    <small>Escolha um contato e prepare seu próximo envio.</small>
    <span class="clean-action-more">${ico('arrow')}</span>
  </a>
  <a class="clean-action clean-action-blue" href="/respostas-botoes">
    <span class="clean-action-icon">${ico('message')}</span>
    <strong>Ver respostas</strong>
    <small>Veja aceites, recusas e ações pendentes.</small>
    <span class="clean-action-more">${ico('arrow')}</span>
  </a>
  <a class="clean-action clean-action-purple" href="/contatos">
    <span class="clean-action-icon">${ico('users')}</span>
    <strong>Gerenciar contatos</strong>
    <small>Consulte autorizações, cadastros e bloqueios.</small>
    <span class="clean-action-more">${ico('arrow')}</span>
  </a>
</section>
<section class="clean-metrics" aria-label="Indicadores reais">
  <article class="clean-metric"><span>Contatos autorizados</span><strong id="cleanAuthorized">—</strong><small>Com consentimento registrado</small></article>
  <article class="clean-metric"><span>Envios iniciados hoje</span><strong id="cleanToday">—</strong><small id="cleanDayLimit">Limite interno: 50 por dia</small></article>
  <article class="clean-metric"><span>Respostas recebidas</span><strong id="cleanReplies">—</strong><small>Cliques registrados pelo monitor</small></article>
  <article class="clean-metric"><span>Bloqueios ativos</span><strong id="cleanBlocked">—</strong><small>Respeitados em novos convites</small></article>
</section>
<div class="clean-home-lower">
  <section class="clean-home-panel" aria-label="Últimas respostas dos botões">
    <div class="clean-panel-header"><div><h2>Últimas respostas</h2><p>Informações registradas pelo monitor.</p></div>
      <a href="/respostas-botoes">Ver todas ${ico('arrow')}</a>
    </div>
    <div class="clean-home-table-scroll"><table class="clean-home-table">
      <thead><tr><th>Quando</th><th>Contato</th><th>Resposta</th><th>Situação</th></tr></thead>
      <tbody id="cleanLatestReplies"><tr><td colspan="4" class="clean-empty">Carregando respostas...</td></tr></tbody>
    </table></div>
  </section>
  <section class="clean-home-panel clean-home-status" aria-label="Estado da operação">
    <div class="clean-panel-header"><div><h2>Central de envios</h2><p>WhatsApp Web supervisionado</p></div></div>
    <div class="clean-connection-line"><span class="clean-connection-icon">${ico('send')}</span>
      <span><strong id="cleanWhatsappStatus">Verificando...</strong><small id="cleanWhatsappHint">O envio continua sob sua confirmação.</small></span>
    </div>
    <div class="clean-home-status-details">
      <span>Filas cadastradas</span><strong id="cleanQueues">—</strong>
      <span>Convites aguardando</span><strong id="cleanPending">—</strong>
    </div>
    <a class="clean-text-link" href="/campanhas">Gerenciar filas ${ico('arrow')}</a>
  </section>
</div>
<aside class="clean-safety-note">
  ${ico('shield')}
  <span><strong>Envios responsáveis</strong><small>Convide apenas contatos autorizados. Recusas permanecem bloqueadas até nova autorização documentada.</small></span>
  <a href="/denuncias">Ver segurança ${ico('arrow')}</a>
</aside>
<div id="homeLatest" hidden></div>
`;
