(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { autorizados:[], importados:[], aptos:[], bloqueados:[],
    campanhas:[], atual:null, previa:null };
  const linhasMaximas = 1500;
  const tamanhoMaximo = 110000;

  function flash(msg, erro = false) {
    const el = $('feedback');
    el.textContent = msg;
    el.className = 'toast' + (erro ? ' error' : '');
    el.hidden = false;
    el.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }

  async function api(url, method = 'GET', data = null) {
    const options = { credentials:'same-origin', method };
    if (method !== 'GET') {
      options.headers = {'content-type':'application/json','x-cpv-local':'1'};
      options.body = JSON.stringify(data || {});
    }
    let response;
    try { response = await fetch(url,options); }
    catch { throw new Error('A Central não respondeu. Verifique se está aberta.'); }
    let body;
    try {body = await response.json();} catch {body = {};}
    if (!response.ok || body.ok === false) {
      throw new Error(body.mensagem || 'Falha de comunicação: ' + response.status);
    }
    return body;
  }


  function telefone(valor) {
    const texto = String(valor || '').trim();
    if (!/^\+?[0-9\s().-]{10,25}$/.test(texto)) return null;
    const dig = texto.replace(/\D/g, '');
    if (!/^[1-9]\d{7,14}$/.test(dig)) return null;
    if (dig.length === 10 || dig.length === 11) {
      return /^[1-9]\d(?:[2-9]\d{7}|9\d{8})$/.test(dig) ? '55' + dig : null;
    }
    if (dig.startsWith('55') && !/^55[1-9]\d(?:[2-9]\d{7}|9\d{8})$/.test(dig)) return null;
    return dig;
  }
  function textoSimples(texto,max=80) {
    return String(texto||'').replace(/[\x00-\x1f<>]/g,' ').trim().slice(0,max);
  }
  function normalizarCabecalho(texto) {
    return textoSimples(texto,80).toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
  }
  function delimiter(texto) {
    const linha = texto.split(/\r?\n/,1)[0] || '';
    let inQuote=false;
    const counts={ ';':0,',':0,'\t':0 };
    for(let i=0;i<linha.length;i++){
      if(linha[i]==='"'){if(inQuote && linha[i+1]==='"')i++;else inQuote=!inQuote;}
      else if(!inQuote && Object.hasOwn(counts,linha[i]))counts[linha[i]]++;
    }
    return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
  }

  function linhasCsv(conteudo) {
    const texto=String(conteudo||'').replace(/^\ufeff/,'');
    if (new TextEncoder().encode(texto).length > tamanhoMaximo) {
      throw new Error('Arquivo muito grande. Máximo de 110 KB.');
    }
    const sep=delimiter(texto);
    const linhas=[];
    let row=[],part='',quoted=false;
    for(let i=0;i<texto.length;i++){
      const c=texto[i];
      if(c==='"'){
        if(quoted && texto[i+1]==='"'){part+='"';i++;}
        else quoted=!quoted;
      } else if(c===sep && !quoted){
        row.push(part);part='';
      } else if((c==='\n'||c==='\r')&&!quoted){
        if(c==='\r'&&texto[i+1]==='\n')i++;
        row.push(part);part='';
        if(row.some(v=>v.trim()))linhas.push(row);
        row=[];
        if(linhas.length>linhasMaximas+1)throw new Error('Máximo de 1.500 linhas por arquivo.');
      } else part+=c;
    }
    if(quoted)throw new Error('CSV incompleto: há aspas não fechadas.');
    row.push(part);
    if(row.some(v=>v.trim()))linhas.push(row);
    if(linhas.length>linhasMaximas+1)throw new Error('Máximo de 1.500 linhas por arquivo.');
    return linhas;
  }

  function lerLista(texto) {
    const linhas=linhasCsv(texto);
    if (!linhas.length) throw new Error('O arquivo CSV está vazio.');
    const titulos=linhas[0].map(normalizarCabecalho);
    const colTel=titulos.findIndex(k=>['telefone','numero','whatsapp','celular','phone'].includes(k));
    const colNome=titulos.findIndex(k=>['nome','name','contato'].includes(k));
    const temCabecalho=colTel!==-1;
    const inicio=temCabecalho?1:0;
    const index=new Map();
    let duplicados=0,invalidos=0;
    for(const colunas of linhas.slice(inicio)){
      let pos=colTel;
      if(pos===-1) pos=colunas.findIndex(v=>telefone(v)!==null);
      const tel=telefone(colunas[pos]);
      if(!tel){invalidos++;continue;}
      const nome=textoSimples(colunas[temCabecalho ? colNome : colunas.findIndex((_,i)=>i!==pos)]||'');
      if(index.has(tel)){
        duplicados++;
        if(!index.get(tel).nome && nome)index.get(tel).nome=nome;
      } else index.set(tel,{nome,telefone:tel});
    }
    if(!index.size)throw new Error('Nenhum telefone válido encontrado no CSV.');
    return {contatos:[...index.values()],duplicados,invalidos};
  }

  function mascarar(valor) {
    const dig=String(valor||'').replace(/\D/g,'');
    return dig ? '+' + dig.slice(0,4) + ' •••• ' + dig.slice(-4) : '';
  }
  function dataCurta(valor) {
    if(!valor)return 'Ainda não';
    const n=new Date(valor);
    return Number.isFinite(n.valueOf())?n.toLocaleString('pt-BR'): 'Data indisponível';
  }

  function renderResumo() {
    const validos=new Map(state.autorizados.map(c=>[c.telefone,c]));
    state.aptos=[];
    state.bloqueados=[];
    for(const item of state.importados){
      const aprovado=validos.get(item.telefone);
      if(aprovado)state.aptos.push({...aprovado, nomePlanilha:item.nome});
      else state.bloqueados.push(item);
    }
    $('metricImported').textContent=String(state.importados.length);
    $('metricEligible').textContent=String(state.aptos.length);
    $('metricBlocked').textContent=String(state.bloqueados.length);
    const el=$('importInfo');
    el.replaceChildren();
    const blocos=[
      state.importados.length+' registros distintos',
      state.aptos.length+' com opt-in confirmado',
      state.bloqueados.length+' fora da fila',
    ];
    for(const item of blocos){
      const chip=document.createElement('span');chip.className='counter';chip.textContent=item;
      el.append(chip);
    }
    atualizarPreview();
  }

  function mensagem(modelo,nome,grupo) {
    const primeiro=String(nome||'').trim().split(/\s+/)[0] || 'pessoal';
    let texto=String(modelo||'').replace(/\{nome\}/g,primeiro)
      .replace(/\{grupo\}/g,grupo||'nossa comunidade');
    if(texto.trim() && !/\bSAIR\b/i.test(texto)){
      texto+='\n\nPara não receber mais mensagens, responda SAIR.';
    }
    return texto;
  }
  function atualizarPreview() {
    const modelo=$('campaignText').value.trim();
    const nome=state.aptos[0]?.nome || 'Ana';
    const grupo=$('campaignGroup').value.trim();
    $('messagePreview').textContent=modelo ?
      mensagem(modelo,nome,grupo) : 'Sua mensagem personalizada aparecerá aqui.';
    $('createCampaign').disabled=!state.aptos.length ||
      $('campaignName').value.trim().length<3 ||
      modelo.length<8 ||modelo.length>1200;
  }

  function elemento(tag,classe,texto) {
    const el=document.createElement(tag);
    if(classe)el.className=classe;
    if(texto!==undefined)el.textContent=String(texto);
    return el;
  }
  function botao(label,action,classe='secondary') {
    const b=elemento('button',classe,label);b.type='button';
    b.addEventListener('click',action);return b;
  }

  function listarCampanhas() {
    const div=$('campaignsList');
    div.replaceChildren();
    if(!state.campanhas.length){
      div.append(elemento('div','empty','Nenhuma campanha criada. Importe uma planilha para começar.'));
      return;
    }
    for(const item of state.campanhas){
      const linha=elemento('div','list-row');
      const meta=elemento('div');
      meta.append(elemento('strong','',item.nome),
        elemento('small','',item.total+' contatos · '+item.pendentes+' pendentes · '+
          item.enviados+' enviados · '+item.bloqueados+' bloqueados'));
      const actions=elemento('div','actions');
      actions.append(elemento('span','tag',dataCurta(item.criadaEm)),
        botao('Abrir fila',()=>abrirCampanha(item.id)));
      linha.append(meta,actions);div.append(linha);
    }
  }

  async function carregarCampanhas() {
    const dados=await api('/api/local/campanhas');
    state.campanhas=dados.campanhas;
    listarCampanhas();
  }

  async function carregar() {
    const [destinatarios,campanhas,config]=await Promise.all([
      api('/api/local/campanhas/destinatarios'),
      api('/api/local/campanhas'),
      api('/api/local/campanhas/configuracao'),
    ]);
    state.autorizados=destinatarios.destinatarios;
    state.campanhas=campanhas.campanhas;
    $('senderPhone').value=config.remetente ? '+'+config.remetente : '';
    $('senderSetup').open=!config.remetenteConfigurado;
    $('senderStatus').textContent=config.remetenteConfigurado
      ? 'Número de envio configurado. Confira a conta no WhatsApp antes de cada mensagem.'
      : 'Informe seu número de WhatsApp Business acima, sem chave administrativa.';
    renderResumo();
    listarCampanhas();
  }

  async function salvarRemetente() {
    const botao=$('saveSender');
    botao.disabled=true;
    try {
      const dados=await api('/api/local/campanhas/remetente','POST',{
        telefone:$('senderPhone').value.trim(),
      });
      $('senderPhone').value=dados.remetente ? '+'+dados.remetente : '';
      $('senderStatus').textContent=dados.remetente
        ? 'Número de envio salvo. Confira a conta no WhatsApp antes de cada mensagem.'
        : 'Número de envio removido.';
      if(state.atual) {
        state.atual.remetenteConfigurado=Boolean(dados.remetente);
        renderFila();
      }
      $('senderSetup').open=false;
      flash('Configuração salva neste computador. Nenhuma mensagem foi enviada.');
    } catch(erro) { flash(erro.message,true); }
    finally { botao.disabled=false; }
  }

  function limparImportacao() {
    state.importados=[];
    $('importFile').value='';
    renderResumo();
    $('importInfo').replaceChildren(elemento('span','counter','Nenhum arquivo selecionado'));
  }

  async function importarArquivo() {
    const file=$('importFile').files?.[0];
    if(!file)return;
    if(file.size>tamanhoMaximo){
      flash('Arquivo maior que 110 KB. Divida a planilha em lotes.',true);return;
    }
    try {
      const dados=lerLista(await file.text());
      state.importados=dados.contatos;
      renderResumo();
      flash('Planilha carregada: '+dados.contatos.length+' telefones distintos. '+
        dados.duplicados+' duplicados e '+dados.invalidos+' linhas inválidas.');
    } catch(erro){limparImportacao();flash(erro.message,true);}
  }

  async function criarCampanha() {
    if(!$('campaignText').value.trim())return;
    $('createCampaign').disabled=true;
    try {
      const dados=await api('/api/local/campanhas','POST',{
        nome:$('campaignName').value.trim(),grupo:$('campaignGroup').value.trim(),
        modelo:$('campaignText').value.trim(),
        contatoIds:state.aptos.map(c=>c.id),
      });
      await carregarCampanhas();
      await abrirCampanha(dados.campanha.id);
      flash('Campanha criada com '+dados.campanha.total+' contatos autorizados. Nenhuma mensagem foi enviada.');
    } catch(erro){flash(erro.message,true);}
    finally{atualizarPreview();}
  }

  function tagStatus(st) {
    const map={ pendente:['Pendente','tag warn'],
      enviado:['Enviado','tag'],ignorado:['Ignorado','tag off'],bloqueado:['Opt-in revogado','tag off']};
    const [label,classe]=map[st]||['Indisponível','tag off'];
    return elemento('span',classe,label);
  }

  function atualizarMetricasCampanha() {
    $('metricSent').textContent=String(state.atual?.enviados||0);
  }

  function renderFila() {
    const c=state.atual;if(!c)return;
    $('queueTitle').textContent=c.nome;
    $('queueSection').hidden=false;
    $('queueNotice').textContent=c.remetenteConfigurado ?
      'Abra uma conversa por vez no WhatsApp Business configurado. Depois de enviar, registre manualmente o resultado.' :
      'Configure o número de envio na seção Criar mensagem, acima. Abrir conversa não significa enviar.';
    const query=$('queueSearch').value.trim().toLowerCase();
    const filtrados=c.itens.filter(item=>
      [item.nome,item.telefoneMascarado,item.status].some(v=>
        String(v||'').toLowerCase().includes(query)));
    const wrap=$('queueList');
    wrap.replaceChildren();
    if(!filtrados.length){
      wrap.append(elemento('div','empty','Nenhum destinatário para esta busca.'));return;
    }
    for(const item of filtrados){
      const line=elemento('div','list-row');
      const body=elemento('div');
      body.append(elemento('strong','',item.nome||'Sem nome'),
        elemento('small','',item.telefoneMascarado+
          (item.enviadoEm ?' · Enviado: '+dataCurta(item.enviadoEm):'')));
      const actions=elemento('div','actions');
      actions.append(tagStatus(item.status));
      if(item.status==='pendente') {
        actions.append(botao('Preparar mensagem',()=>preparar(item.id),'primary'),
          botao('Ignorar',()=>ignorar(item.id),'quiet'));
      }
      if(item.status==='pendente' || item.status==='bloqueado') {
        actions.append(botao('Descadastrar',()=>descadastrar(item),'quiet'));
      }
      line.append(body,actions);wrap.append(line);
    }
    atualizarMetricasCampanha();
  }

  async function abrirCampanha(id) {
    try {
      const detalhe=await api('/api/local/campanhas/detalhe?id='+encodeURIComponent(id));
      state.atual=detalhe.campanha;
      renderFila();
      $('queueSection').scrollIntoView({behavior:'smooth',block:'start'});
    }catch(erro){flash(erro.message,true);}
  }

  async function preparar(id) {
    if(!state.atual)return;
    try{
      const resp=await api('/api/local/campanhas/preparar','POST',{
        campanhaId:state.atual.id,contatoId:id,
      });
      state.previa={...resp.mensagem,contatoId:id};
      $('sendRecipient').textContent=(resp.mensagem.nome||'Contato')+
        ' · '+mascarar(resp.mensagem.numero);
      $('messageReady').value=resp.mensagem.mensagem;
      $('openWhatsApp').href=resp.mensagem.url;
      $('sentConfirm').checked=false;
      $('recordSent').disabled=true;
      $('sendDialog').showModal();
    }catch(erro){flash(erro.message,true);await abrirCampanha(state.atual.id);}
  }

  async function marcarEnviado() {
    if(!state.previa || !$('sentConfirm').checked)return;
    const id=state.atual?.id;
    $('recordSent').disabled=true;
    try {
      await api('/api/local/campanhas/registrar','POST',{
        campanhaId:id,contatoId:state.previa.contatoId,enviado:true,
      });
      $('sendDialog').close();
      state.previa=null;
      await Promise.all([abrirCampanha(id),carregarCampanhas()]);
      flash('Envio manual registrado. Não há comprovação automática pelo WhatsApp.');
    }catch(erro){flash(erro.message,true);$('recordSent').disabled=false;}
  }

  async function ignorar(id) {
    if(!state.atual || !confirm('Ignorar este contato nesta campanha?'))return;
    const campanhaId=state.atual.id;
    try{
      await api('/api/local/campanhas/ignorar','POST',{campanhaId,contatoId:id});
      await Promise.all([abrirCampanha(campanhaId),carregarCampanhas()]);
    }catch(erro){flash(erro.message,true);}
  }

  async function descadastrar(item) {
    if(!confirm('Registrar descadastro definitivo deste contato? Ele ficará impedido de receber novas mensagens.'))return;
    try {
      await api('/api/local/campanhas/descadastrar','POST',{id:item.id});
      await carregar();
      if(state.atual)await abrirCampanha(state.atual.id);
      flash('Descadastro registrado. Contato bloqueado para novas mensagens.');
    }catch(erro){flash(erro.message,true);}
  }

  function csvCelula(valor) {
    let texto=String(valor||'').replace(/[\x00-\x1f]/g,' ').trim();
    if(/^[\s]*[=+@-]/.test(texto))texto="'"+texto;
    return '"'+texto.replace(/"/g,'""')+'"';
  }

  function exportarRelatorio() {
    if(!state.atual)return;
    const head='nome;telefone_mascarado;status;enviado_em';
    const linhas=state.atual.itens.map(c=>[c.nome,c.telefoneMascarado,
      c.status,c.enviadoEm||''].map(csvCelula).join(';'));
    const csv='\ufeff'+[head,...linhas].join('\r\n')+'\r\n';
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download='campanha-relatorio-'+state.atual.id.slice(0,8)+'.csv';
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  $('saveSender').addEventListener('click',salvarRemetente);
  $('importFile').addEventListener('change',importarArquivo);
  $('clearImport').addEventListener('click',limparImportacao);
  $('campaignName').addEventListener('input',atualizarPreview);
  $('campaignText').addEventListener('input',atualizarPreview);
  $('campaignGroup').addEventListener('input',atualizarPreview);
  document.querySelectorAll('[data-add]').forEach(button=>button.addEventListener('click',()=>{
    const box=$('campaignText');
    const token=button.getAttribute('data-add');
    box.setRangeText(token,box.selectionStart,box.selectionEnd,'end');
    box.focus();atualizarPreview();
  }));
  $('createCampaign').addEventListener('click',criarCampanha);
  $('reloadCampaigns').addEventListener('click',()=>carregarCampanhas().catch(e=>flash(e.message,true)));
  $('queueSearch').addEventListener('input',renderFila);
  $('reportCsv').addEventListener('click',exportarRelatorio);
  $('sentConfirm').addEventListener('change',()=>{
    $('recordSent').disabled=!$('sentConfirm').checked;
  });
  $('recordSent').addEventListener('click',marcarEnviado);
  $('closeDialog').addEventListener('click',()=>{
    $('sendDialog').close();state.previa=null;
  });

  carregar().catch(erro=>{
    $('campaignsList').replaceChildren(elemento('div','empty',
      'Não foi possível carregar as campanhas locais. Verifique se o servidor está aberto.'));
    flash(erro.message,true);
  });
})();
