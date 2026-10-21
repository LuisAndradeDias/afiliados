(()=>{
  const $=id=>document.getElementById(id);
  const pagina=document.body.dataset.page;
  const filtros={todos:'Todos',autorizado:'Autorizado',bloqueado:'Bloqueado',
    descadastrado:'Descadastrado',pendente:'Pendente',
    'sem-autorizacao':'Sem autorização'};
  const motivos={'denuncia-convite':'Denúncia interna',
    'saida-solicitada':'Não tenho interesse / SAIR',
    'bloqueio-administrativo':'Bloqueio administrativo'};
  const state={filtro:new URLSearchParams(location.search).get('filtro')||'todos',
    busca:'',pagina:1,totalPaginas:1,ultimoContato:null,pedido:0,
    filtroOcorrencias:'todos',ocorrencias:[]};
  const element=(tag,classe,txt)=>{
    const el=document.createElement(tag);
    if(classe)el.className=classe;
    if(txt!==undefined)el.textContent=String(txt);
    return el;
  };
  function data(value,onlyDate=false){
    if(!value)return 'Não informado';
    const t=new Date(value);
    if(Number.isNaN(t.valueOf()))return 'Não informado';
    return onlyDate?t.toLocaleDateString('pt-BR')
      :t.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
  }
  function notificar(msg,erro=false){
    const c=$('notification');if(!c)return;
    c.className='notification'+(erro?' error':'');
    c.textContent=msg;
    c.hidden=false;
    clearTimeout(notificar.timer);
    notificar.timer=setTimeout(()=>c.hidden=true,8500);
  }
  async function api(url,body){
    const opt=body===undefined?{}:{
      method:'POST',headers:{'content-type':'application/json','x-cpv-local':'1'},
      body:JSON.stringify(body),
    };
    const resp=await fetch(url,opt);
    let result;
    try{result=await resp.json();}catch{throw new Error('Resposta inesperada do servidor local.');}
    if(!resp.ok||result.ok===false)throw new Error(result.mensagem||'Não foi possível consultar o painel.');
    return result;
  }
  function statusPill(status){
    return element('span','status-pill '+status,filtros[status]||'Não classificado');
  }
  function atribuir(id,texto){if($(id))$(id).textContent=String(texto);}
  function itemOcorrencia(oc,compact=false){
    const row=element('div',compact?'feed-item':'report-row');
    const mark=element('div',compact?'feed-mark':'report-icon',
      oc.motivo==='denuncia-convite'?'!':oc.motivo==='saida-solicitada'?'↘':'■');
    mark.setAttribute('aria-hidden','true');
    const col=element('div',compact?'':'report-copy');
    col.append(element('strong','',oc.telefoneMascarado||'Contato indisponível'));
    const origem=oc.origem==='clique-confirmado-netlify'?'Confirmada no Netlify'
      :oc.origem==='clique-confirmado-pagina-publica'?'Confirmada pelo link'
      :oc.origem==='clique-nao-tenho-interesse-netlify'?'Recusa confirmada pelo link'
      :oc.origem==='painel-local-gestao-contatos'?'Bloqueio administrativo'
      :oc.origem==='whatsapp-webhook'?'Registro via integração':'Registrada no painel';
    const desc=(motivos[oc.motivo]||'Ocorrência')+' · '+origem;
    col.append(element(compact?'small':'p','',desc));
    if(compact)col.append(element('small','',data(oc.recebidoEm)));
    row.append(mark,col);
    if(!compact)row.append(element('span','report-when',data(oc.recebidoEm)));
    return row;
  }
  async function carregarInicio(){
    const r=await api('/api/local/gestao/resumo');
    atribuir('homeTotal',r.contatos.total);
    atribuir('homeAllowed',r.contatos.autorizado);
    atribuir('homeBlocked',r.contatos.bloqueado);
    atribuir('homeComplaints',r.contatos.denuncias);
    atribuir('homeQueues',r.filas.total);
    atribuir('homePending',r.filas.pendentes);
    const stateWhatsapp={
      pronto:'Conversa preparada',incerto:'Verificar resultado',cancelado:'Disponível',
      inativo:'Não iniciado',erro:'Precisa de atenção',confirmado:'Último envio confirmado',
    };
    atribuir('homeWhatsapp',stateWhatsapp[r.whatsapp.fase]||'Em verificação');
    const lista=$('homeLatest');
    lista.replaceChildren();
    if(!r.denuncias.length){
      lista.append(element('div','state-empty','Ainda não há denúncias internas.'));
    }else{
      for(const oc of r.denuncias)lista.append(itemOcorrencia(oc,true));
    }
  }
  function setFilterButtons(group,valor){
    for(const btn of group.querySelectorAll('button[data-filter]')){
      const is=btn.dataset.filter===valor;
      btn.classList.toggle('is-selected',is);
      btn.setAttribute('aria-pressed',String(is));
    }
  }
  function contactCell(text,classe=''){
    const el=element('td',classe,text);
    return el;
  }
  function renderContacts(r){
    atribuir('ctTotal',r.resumo.total);
    atribuir('ctAllowed',r.resumo.autorizado);
    atribuir('ctBlocked',r.resumo.bloqueado);
    atribuir('ctRemoved',r.resumo.descadastrado);
    atribuir('ctPending',r.resumo.pendente);
    atribuir('contactResults',r.totalFiltrado+' contato(s) encontrado(s)');
    state.pagina=r.pagina;state.totalPaginas=r.paginas;
    atribuir('contactsPageInfo','Página '+r.pagina+' de '+r.paginas);
    $('previousPage').disabled=r.pagina<=1;
    $('nextPage').disabled=r.pagina>=r.paginas;
    const tbody=$('contactsBody');tbody.replaceChildren();
    if(!r.contatos.length){
      const tr=document.createElement('tr'),td=element('td','state-empty',
        'Nenhum contato neste filtro. Você pode procurar em outra situação.');
      td.colSpan=5;tr.append(td);tbody.append(tr);return;
    }
    for(const contact of r.contatos){
      const tr=document.createElement('tr');
      const name=document.createElement('td');name.className='person-cell';
      name.append(element('strong','',contact.nome));
      name.append(element('small','',contact.ultimosDigitos
        ? 'Final '+contact.ultimosDigitos : 'Contato cadastrado'));
      const phone=contactCell(contact.telefoneMascarado,'phone-cell');
      const status=document.createElement('td');
      status.append(statusPill(contact.status));
      const source=contactCell(contact.origem,'source-cell');
      const action=document.createElement('td');
      const btn=element('button','row-view','Ver ficha');
      btn.type='button';btn.addEventListener('click',()=>verDetalhe(contact.id));
      action.append(btn);tr.append(name,phone,status,source,action);tbody.append(tr);
    }
  }
  async function carregarContatos(){
    const id=++state.pedido;
    $('contactsResults')?.setAttribute('aria-busy','true');
    const qs=new URLSearchParams({filtro:state.filtro,busca:state.busca,
      pagina:String(state.pagina)});
    try{
      const r=await api('/api/local/gestao/contatos?'+qs.toString());
      if(id!==state.pedido)return;
      renderContacts(r);
    }catch(e){
      if(id!==state.pedido)return;
      notificar(e.message,true);
      const tbody=$('contactsBody');tbody.replaceChildren();
      const row=document.createElement('tr'),cell=element('td','state-empty',
        'Falha ao carregar contatos. Tente atualizar.');
      cell.colSpan=5;row.append(cell);tbody.append(row);
    }
  }
  const campo=(nome,valor)=>{
    const wrapper=document.createElement('div');
    wrapper.append(element('dt','',nome),element('dd','',valor||'Não informado'));
    return wrapper;
  };
  async function verDetalhe(id){
    try{
      const r=await api('/api/local/gestao/contato?id='+encodeURIComponent(id));
      const c=r.contato;state.ultimoContato=c;
      atribuir('contactDialogTitle',c.nome);
      atribuir('detailPhone',c.telefoneMascarado);
      const chip=$('detailStatus');chip.replaceChildren(statusPill(c.status));
      const fields=$('detailFields');
      fields.replaceChildren(
        campo('Situação',filtros[c.status]||c.status),
        campo('Origem',c.origem),
        campo('Autorização',c.evidencia),
        campo('Confirmada em',data(c.consentimentoEm)),
        campo('Último envio manual',data(c.ultimoEnvioManualEm)),
        campo('Descadastrado em',data(c.descadastroEm)),
      );
      if(c.motivoBloqueio)fields.append(campo('Motivo do bloqueio',c.motivoBloqueio),
        campo('Bloqueado em',data(c.bloqueioEm)));
      if(c.registroAutorizacao){
        fields.append(
          campo('Origem declarada',c.registroAutorizacao.origem),
          campo('Data informada',c.registroAutorizacao.dataAutorizacao),
          campo('Referência do aceite',c.registroAutorizacao.referencia),
        );
      }
      const historico=$('detailHistory');historico.replaceChildren();
      if(c.eventos?.length){
        historico.append(element('h3','','Histórico de ocorrências'));
        for(const oc of c.eventos){
          historico.append(element('p','',
            (motivos[oc.motivo]||'Ocorrência')+' · '+data(oc.recebidoEm)));
        }
      }
      $('blockContact').hidden=!['autorizado','pendente','sem-autorizacao'].includes(c.status);
      $('contactDialog').showModal();
    }catch(e){notificar(e.message,true);}
  }
  async function bloquearContato(){
    const c=state.ultimoContato;
    if(!c)return;
    const texto='Bloquear novos convites para '+c.nome+' ('+c.telefoneMascarado+')?\n\n'+
      'O registro será administrativo, NÃO uma denúncia do destinatário. '+
      'O número continuará bloqueado mesmo após uma nova importação.';
    if(!confirm(texto))return;
    const btn=$('blockContact');btn.disabled=true;
    try{
      await api('/api/local/gestao/contato/bloquear',{id:c.id,confirmado:true});
      $('contactDialog').close();notificar('Contato bloqueado para novos convites.');
      await carregarContatos();
    }catch(e){notificar(e.message,true);}
    finally{btn.disabled=false;}
  }
  function iniciarContatos(){
    if(!Object.hasOwn(filtros,state.filtro))state.filtro='todos';
    setFilterButtons($('contactFilters'),state.filtro);
    $('contactFilters').addEventListener('click',e=>{
      const btn=e.target.closest('button[data-filter]');
      if(!btn)return;
      state.filtro=btn.dataset.filter;state.pagina=1;
      setFilterButtons($('contactFilters'),state.filtro);
      const url=new URL(location.href);
      if(state.filtro==='todos')url.searchParams.delete('filtro');
      else url.searchParams.set('filtro',state.filtro);
      history.replaceState({},'',url.pathname+url.search);
      carregarContatos();
    });
    $('contactSearch').addEventListener('input',e=>{
      state.busca=e.target.value.trim().slice(0,90);state.pagina=1;
      clearTimeout(iniciarContatos.timer);
      iniciarContatos.timer=setTimeout(carregarContatos,180);
    });
    $('contactsRefresh').addEventListener('click',carregarContatos);
    $('previousPage').addEventListener('click',()=>{
      if(state.pagina>1){state.pagina--;carregarContatos();}
    });
    $('nextPage').addEventListener('click',()=>{
      if(state.pagina<state.totalPaginas){state.pagina++;carregarContatos();}
    });
    $('detailClose').addEventListener('click',()=>$('contactDialog').close());
    $('detailDone').addEventListener('click',()=>$('contactDialog').close());
    $('blockContact').addEventListener('click',bloquearContato);
    $('contactDialog').addEventListener('click',e=>{
      if(e.target===$('contactDialog'))$('contactDialog').close();
    });
    carregarContatos();
  }
  function pintarRelatorios(){
    const list=$('reportList');list.replaceChildren();
    const dados=state.ocorrencias.filter(oc=>state.filtroOcorrencias==='todos'||
      oc.motivo===state.filtroOcorrencias);
    if(!dados.length){
      list.append(element('div','state-empty',
        'Nenhuma ocorrência registrada para esta categoria.'));
      return;
    }
    for(const oc of dados.slice(0,100))list.append(itemOcorrencia(oc));
    if(dados.length>100)list.append(element('div','state-empty',
      'Mostrando as 100 ocorrências mais recentes.'));
  }
  async function carregarDenuncias(){
    const r=await api('/api/local/gestao/denuncias');
    state.ocorrencias=r.ocorrencias;
    atribuir('repComplaints',r.resumo.denuncias);
    atribuir('repBlocked',r.resumo.bloqueados);
    atribuir('repExits',r.resumo.saidas);
    atribuir('repSync',r.sincronizacao?.configurada?'Ativa':'Pendente');
    $('syncNow').disabled=!r.sincronizacao?.configurada;
    atribuir('lastSync',r.sincronizacao?.ultimaSincronizacao
      ?'Última consulta: '+data(r.sincronizacao.ultimaSincronizacao)
      : 'Aguardando sincronização');
    if(r.sincronizacao?.ultimoErro){
      notificar('A conexão com o Netlify precisa de atenção: '+r.sincronizacao.ultimoErro,true);
    }
    pintarRelatorios();
  }
  function iniciarDenuncias(){
    $('reportFilters').addEventListener('click',e=>{
      const b=e.target.closest('button[data-filter]');
      if(!b)return;
      state.filtroOcorrencias=b.dataset.filter;
      setFilterButtons($('reportFilters'),state.filtroOcorrencias);
      pintarRelatorios();
    });
    $('syncNow').addEventListener('click',async()=>{
      const btn=$('syncNow');btn.disabled=true;
      try{
        const r=await api('/api/local/campanhas/denuncias/sincronizar',{});
        notificar('Sincronização concluída. Registros processados: '+r.resultado.novas+'.');
      }catch(e){notificar(e.message,true);}
      finally{await carregarDenuncias();}
    });
    carregarDenuncias().catch(e=>notificar(e.message,true));
    setInterval(()=>{if(document.visibilityState==='visible')
      carregarDenuncias().catch(()=>{});},60000);
  }
  if(pagina==='inicio')carregarInicio().catch(e=>notificar(e.message,true));
  if(pagina==='contatos')iniciarContatos();
  if(pagina==='denuncias')iniciarDenuncias();
})();
