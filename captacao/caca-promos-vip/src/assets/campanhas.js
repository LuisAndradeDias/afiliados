(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { autorizados:[], importados:[], aptos:[], bloqueados:[],
    cloudMetaReady:false,cloudModeloAprovado:false,cloudQueue:null,cloudModel:null,
    manualQueue:null,manualConversa:null,chromeTimer:null,chromeFase:'inativo',
    conexaoTimer:null,conexaoAtiva:false };
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
    atualizarAptosCloud();
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

  async function carregarMeta() {
    try {
      const resp=await api('/api/local/campanhas/meta');
      state.cloudMetaReady=Boolean(resp.integracao.envioAtivo);
      if (!state.cloudMetaReady)state.cloudModeloAprovado=false;
      $('metaStatus').textContent=resp.integracao.configuracaoPreenchida
        ? 'Identificadores preenchidos. Verifique o modelo aprovado na Meta antes de iniciar envios.'
        : 'Você pode configurar a mensagem, o CSV e as filas antes de ter um número.';
      $('metaConnectionBadge').textContent=state.cloudMetaReady
        ? 'Meta configurada · Validar modelo' : 'Aguardando número';
      $('metaConnectionBadge').className='tag'+(state.cloudMetaReady?'':' warn');
      $('cloudActivationStatus').textContent=state.cloudMetaReady
        ? 'Envio habilitado no servidor, mas cada lote exige modelo aprovado, opt-in e confirmação.'
        : 'Sem número e token: nada é enviado. O rascunho, modelo e filas já podem ficar salvos.';
      $('metaDenuncias').textContent=resp.denuncias.denuncias+' denúncias internas';
      $('metaBloqueios').textContent=resp.denuncias.bloqueados+' bloqueados';
      atualizarAptosCloud();
      atualizarDetalhesCloud();
    } catch(erro) {
      state.cloudMetaReady=false;
      $('metaStatus').textContent='Não foi possível verificar a configuração: '+erro.message;
    }
  }

  async function carregarDenuncias() {
    try {
      const resp=await api('/api/local/campanhas/denuncias');
      const lista=$('complaintsList');
      lista.replaceChildren();
      if (!resp.ocorrencias.length) {
        lista.append(elemento('div','empty','Nenhuma denúncia registrada até agora.'));
        return;
      }
      for(const ocorrencia of resp.ocorrencias.slice(0,100)){
        const linha=elemento('div','list-row');
        const info=elemento('div');
        info.append(elemento('strong','',ocorrencia.telefoneMascarado),
          elemento('small','',dataCurta(ocorrencia.recebidoEm)));
        linha.append(info,elemento('span','tag off',
          ocorrencia.motivo==='denuncia-convite'?'Denúncia · bloqueado':'SAIR · bloqueado'));
        lista.append(linha);
      }
    } catch(erro) {
      $('complaintsList').replaceChildren(elemento('div','empty',
        'Não foi possível carregar as denúncias: '+erro.message));
    }
  }

  function atualizarAptosCloud() {
    $('cloudEligible').textContent=state.aptos.length+' autorizados na planilha';
    $('cloudBlocked').textContent=state.bloqueados.length+' fora da fila';
    $('createCloudQueue').disabled=!state.aptos.length;
    $('createManualQueue').disabled=!state.aptos.length;
  }

  function atualizarPreviewUnico() {
    const mensagem=$('singleText').value;
    $('singlePreview').textContent=mensagem.trim() ||
      'Escreva sua mensagem única para visualizar aqui.';
    $('singleLength').textContent=String(mensagem.length);
    state.cloudModeloAprovado=false;
    atualizarDetalhesCloud();
  }

  async function carregarModeloUnico() {
    const result=await api('/api/local/campanhas/convite/modelo');
    state.cloudModel=result.configuracao;
    $('singleText').value=result.configuracao.mensagem;
    $('groupLink').value=result.configuracao.grupoUrl||'';
    $('templateName').value=result.configuracao.nomeModelo;
    atualizarPreviewUnico();
    $('singleSaveStatus').textContent=result.configuracao.modificadoEm
      ? 'Rascunho salvo no computador em '+dataCurta(result.configuracao.modificadoEm)+'.'
      : 'Modelo inicial disponível. Personalize e clique em Salvar mensagem e link.';
  }

  async function salvarUnico(silencioso=false) {
    const resultado=await api('/api/local/campanhas/convite/modelo','POST',{
      mensagem:$('singleText').value,
      grupoUrl:$('groupLink').value.trim(),
      nomeModelo:$('templateName').value.trim(),
    });
    state.cloudModel=resultado.configuracao;
    state.cloudModeloAprovado=false;
    atualizarDetalhesCloud();
    $('singleSaveStatus').textContent='Convite único salvo em '+dataCurta(resultado.configuracao.modificadoEm)+'.';
    if(!silencioso)flash('Mensagem e link salvos localmente. Nenhum WhatsApp foi acionado.');
    return resultado.configuracao;
  }

  function downloadJson(nome,valor) {
    const blob=new Blob([JSON.stringify(valor,null,2)+'\n'],
      {type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download=nome;
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }

  async function exportarModeloUnico() {
    try {
      await salvarUnico(true);
      const r=await api('/api/local/campanhas/convite/modelo');
      downloadJson('modelo-meta-'+r.configuracao.nomeModelo+'.json',r.modeloMeta);
      flash('Modelo Meta preparado para envio à aprovação quando sua conta existir.');
    }catch(erro){flash(erro.message,true);}
  }

  async function simularUnico() {
    try {
      await salvarUnico(true);
      const resp=await api('/api/local/campanhas/convite/simular','POST',{
        contatoIds:state.aptos.map(c=>c.id),
      });
      const s=resp.simulacao;
      $('cloudPreviewNotice').textContent='SIMULAÇÃO: '+s.preparadas+
        ' destinatário(s) autorizado(s), '+s.bloqueadas+
        ' bloqueado(s). Mesma mensagem e dois botões para todos. Nenhum envio realizado.';
      flash('Simulação concluída com '+s.preparadas+' destinatário(s) apto(s). Zero mensagens enviadas.');
    }catch(erro){flash(erro.message,true);}
  }

  function relatorioFilaCloud() {
    if (!state.cloudQueue) return;
    const campos=['nome;telefone_mascarado;status;solicitado_em'];
    for (const item of state.cloudQueue.itens){
      campos.push([item.nome,item.telefoneMascarado,item.status,
        item.solicitadoEm||''].map(csvCelula).join(';'));
    }
    const blob=new Blob(['\ufeff'+campos.join('\r\n')+'\r\n'],
      {type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download='convites-status-'+state.cloudQueue.id.slice(0,8)+'.csv';
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }

  async function carregarFilasCloud() {
    const resp=await api('/api/local/campanhas/convite/filas');
    $('metricQueues').textContent=String(resp.filas.length);
    const el=$('cloudQueueList');
    el.replaceChildren();
    const filas=resp.filas.filter(f=>f.modo!=='web');
    if (!filas.length) {
      el.append(elemento('div','empty',
        'Nenhuma fila criada. Você já pode salvar a mensagem e simular sem número.'));
      return;
    }
    for(const fila of filas){
      const item=elemento('div','cloud-queue-item');
      const info=elemento('div');
      info.append(
        elemento('strong','',fila.nome),
        elemento('small','',fila.total+' contatos · '+fila.pendentes+' pendentes · '+
          fila.aceitos+' aceitos · '+fila.entregues+' entregues · '+
          fila.bloqueados+' bloqueados · '+fila.incertos+' incertos'),
      );
      item.append(info,botao('Ver fila',()=>abrirFilaCloud(fila.id),'secondary'));
      el.append(item);
    }
  }

  function atualizarDetalhesCloud() {
    const fila=state.cloudQueue;
    if(!fila)return;
    $('cloudQueueTitle').textContent=fila.nome;
    $('cloudQueueSummary').textContent=fila.total+' destinatários · '+
      fila.pendentes+' pendentes · '+fila.aceitos+' aceitos · '+
      fila.entregues+' entregues · '+fila.lidos+' lidos · '+
      fila.bloqueados+' bloqueados · '+fila.incertos+' incertos';
    $('sendCloudBatch').disabled=!state.cloudMetaReady ||
      !state.cloudModeloAprovado || fila.pendentes===0;
  }

  async function abrirFilaCloud(id) {
    try{
      const data=await api('/api/local/campanhas/convite/fila?id='+encodeURIComponent(id));
      state.cloudQueue=data.fila;
      $('cloudQueueDetail').hidden=false;
      atualizarDetalhesCloud();
      const wrap=$('cloudQueuePeople');
      wrap.replaceChildren();
      for(const pessoa of data.fila.itens.slice(0,250)){
        const linha=elemento('div','list-row');
        const info=elemento('div');
        info.append(elemento('strong','',pessoa.nome),
          elemento('small','',pessoa.telefoneMascarado));
        linha.append(info,elemento('span','tag'+
          (pessoa.status==='bloqueado'?' off':pessoa.status==='pendente'?' warn':''),
          pessoa.status));
        wrap.append(linha);
      }
      $('cloudQueueDetail').scrollIntoView({behavior:'smooth',block:'start'});
    }catch(erro){flash(erro.message,true);}
  }

  async function criarFilaCloud() {
    const botaoCriar=$('createCloudQueue');
    botaoCriar.disabled=true;
    try {
      await salvarUnico(true);
      const resp=await api('/api/local/campanhas/convite/fila','POST',{
        nome:$('cloudCampaignName').value.trim(),
        contatoIds:state.aptos.map(c=>c.id),
      });
      await carregarFilasCloud();
      await abrirFilaCloud(resp.fila.id);
      flash('Fila com '+resp.fila.total+
        ' contato(s) autorizado(s) preparada. Nenhuma mensagem foi enviada.');
    } catch(erro){flash(erro.message,true);}
    finally{atualizarAptosCloud();}
  }

  async function verificarModeloCloud() {
    if (!state.cloudMetaReady){
      flash('Aguardando número Meta, token de acesso, webhook e habilitação do envio.',true);
      return;
    }
    const btn=$('checkMetaModel');
    btn.disabled=true;
    try {
      const r=await api('/api/local/campanhas/convite/validacao');
      state.cloudModeloAprovado=Boolean(r.validacao.aprovado);
      $('cloudActivationStatus').textContent=r.validacao.aprovado
        ? 'Modelo aprovado e texto idêntico ao salvo. Envio disponível somente mediante confirmação por lote.'
        : 'Modelo '+r.validacao.status+
          '. Confira se o texto e os dois botões são exatamente iguais aos da Meta.';
      atualizarDetalhesCloud();
      flash(r.validacao.aprovado
        ? 'Modelo aprovado e conferido com a Meta.'
        : 'Modelo ainda não liberado para envios.',!r.validacao.aprovado);
    }catch(erro){state.cloudModeloAprovado=false;flash(erro.message,true);}
    finally{btn.disabled=false;}
  }

  async function enviarLoteCloud() {
    const fila=state.cloudQueue;
    if(!fila || !state.cloudMetaReady || !state.cloudModeloAprovado)return;
    if(!confirm('Confirmar envio REAL de até 10 convites pagos pela Meta, apenas a contatos com opt-in?')){
      return;
    }
    const btn=$('sendCloudBatch');
    btn.disabled=true;
    try {
      const r=await api('/api/local/campanhas/convite/enviar','POST',{
        campanhaId:fila.id,limite:10,confirmar:true,
      });
      await Promise.all([abrirFilaCloud(fila.id),carregarFilasCloud(),carregarMeta()]);
      flash('Lote: '+r.resultado.aceitos+' aceitos pela Meta, '+
        r.resultado.incertos+' incertos. Confirme os status antes de tentar outro lote.');
    }catch(erro){flash(erro.message,true);}
    finally{atualizarDetalhesCloud();}
  }

  function apresentarConexaoWhatsapp(s) {
    state.conexaoAtiva=Boolean(s.ocupado);
    const textos={
      inativo:'Clique em Abrir WhatsApp Web para conectar ou conferir sua sessão.',
      iniciando:'Iniciando a janela do Chrome das promoções...',
      abrindo:'O Chrome está abrindo o WhatsApp Web...',
      aguardando:'WhatsApp Web aberto. Aguarde a tela carregar.',
      qr:'QR Code disponível no Chrome. Use Aparelhos conectados no celular.',
      conectado:'WhatsApp conectado! As conversas estão visíveis no Chrome. Clique em Salvar sessão e fechar.',
      fechando:'Salvando a sessão e encerrando a janela do Chrome...',
      encerrando:'Finalizando a janela do WhatsApp Web...',
      fechado:'Janela fechada. A sessão foi preservada para o envio supervisionado.',
      erro:'O Chrome não pôde abrir a sessão. Verifique se o WhatsApp das promoções já está em uso.',
    };
    $('whatsappConnectionStatus').textContent=s.mensagem || textos[s.fase] ||
      'Aguardando atualização do estado.';
    $('whatsappConnectionBadge').textContent={
      inativo:'Aguardando conexão',iniciando:'Iniciando',abrindo:'Abrindo',
      aguardando:'Carregando',qr:'Escaneie o QR',conectado:'Conectado',
      fechando:'Encerrando',encerrando:'Encerrando',
      fechado:'Sessão preservada',erro:'Verificar Chrome',
    }[s.fase]||'Não verificado';
    $('whatsappConnectionBadge').className='tag'+(
      ['conectado','fechado'].includes(s.fase)?'':' warn');
    $('whatsappConnectOpen').disabled=Boolean(s.ocupado);
    $('whatsappConnectClose').disabled=!s.ocupado ||
      ['fechando','encerrando'].includes(s.fase);
    if(s.ocupado && !state.conexaoTimer) {
      state.conexaoTimer=setInterval(carregarConexaoWhatsapp,1600);
    }else if(!s.ocupado && state.conexaoTimer) {
      clearInterval(state.conexaoTimer);
      state.conexaoTimer=null;
    }
  }

  async function carregarConexaoWhatsapp() {
    try {
      const r=await api('/api/local/campanhas/convite/whatsapp/conexao/estado');
      apresentarConexaoWhatsapp(r.estado);
    }catch(e) {
      $('whatsappConnectionStatus').textContent='Não foi possível verificar o WhatsApp: '+e.message;
    }
  }

  async function abrirConexaoWhatsapp() {
    $('whatsappConnectOpen').disabled=true;
    try{
      const r=await api('/api/local/campanhas/convite/whatsapp/conexao/abrir','POST',{});
      apresentarConexaoWhatsapp(r.estado);
      flash('Abrindo WhatsApp Web. Confira a janela do Chrome e escaneie o QR se necessário.');
    }catch(e) {
      $('whatsappConnectOpen').disabled=false;
      $('whatsappConnectionStatus').textContent=e.message;
      flash(e.message,true);
    }
  }

  async function fecharConexaoWhatsapp() {
    if(!confirm('Encerrar a janela de conexão? O login permanece salvo no perfil do Chrome.'))return;
    $('whatsappConnectClose').disabled=true;
    try {
      const r=await api('/api/local/campanhas/convite/whatsapp/conexao/fechar','POST',{});
      apresentarConexaoWhatsapp(r.estado);
    }catch(e) {
      $('whatsappConnectClose').disabled=false;
      flash(e.message,true);
    }
  }

  async function carregarControleManual() {
    const dados=await api('/api/local/campanhas/convite/manual/estatisticas');
    const c=dados.controle;
    $('manualDaily').textContent=c.iniciadosHoje+' / '+c.limiteDiario+
      ' conversas preparadas hoje';
    $('manualConfirmed').textContent=c.confirmadosHoje+
      ' envios confirmados hoje';
  }

  async function carregarFilasManual() {
    const dados=await api('/api/local/campanhas/convite/filas');
    const filas=dados.filas.filter(f=>f.modo==='web');
    const el=$('manualQueueList');
    el.replaceChildren();
    if (!filas.length) {
      el.append(elemento('div','empty',
        'Nenhuma fila do WhatsApp Web. Salve a mensagem, importe o CSV e crie a primeira.'));
      return;
    }
    for(const fila of filas){
      const linha=elemento('div','cloud-queue-item');
      const info=elemento('div');
      info.append(elemento('strong','',fila.nome),
        elemento('small','',fila.total+' contatos · '+fila.pendentes+
          ' pendentes · '+fila.abertos+' em revisão · '+
          fila.manuais+' envios confirmados · '+fila.bloqueados+' bloqueados'));
      linha.append(info,botao('Abrir fila',()=>abrirFilaManual(fila.id),'secondary'));
      el.append(linha);
    }
  }

  async function criarFilaManual() {
    const btn=$('createManualQueue');
    btn.disabled=true;
    try {
      await salvarUnico(true);
      const res=await api('/api/local/campanhas/convite/fila','POST',{
        nome:$('cloudCampaignName').value.trim(),
        contatoIds:state.aptos.map(c=>c.id),
        modo:'web',
      });
      await carregarFilasManual();
      await abrirFilaManual(res.fila.id);
      flash('Fila manual preparada com '+res.fila.total+
        ' contatos autorizados. Nenhum envio foi realizado.');
    } catch(e) { flash(e.message,true); }
    finally { atualizarAptosCloud(); }
  }

  async function abrirFilaManual(id) {
    try {
      const dados=await api('/api/local/campanhas/convite/fila?id='+encodeURIComponent(id));
      if(dados.fila.modo!=='web')throw new Error('Esta fila não é do WhatsApp Web.');
      state.manualQueue=dados.fila;
      $('manualQueueDetail').hidden=false;
      $('manualQueueTitle').textContent=dados.fila.nome;
      $('manualQueueSummary').textContent=dados.fila.total+' contatos · '+
        dados.fila.pendentes+' pendentes · '+dados.fila.abertos+
        ' em revisão · '+dados.fila.manuais+' confirmados · '+
        dados.fila.bloqueados+' bloqueados · '+
        dados.fila.incertos+' resultados incertos';
      const lista=$('manualQueuePeople');
      lista.replaceChildren();
      for (const item of dados.fila.itens) {
        const linha=elemento('div','list-row');
        const perfil=elemento('div');
        perfil.append(elemento('strong','',item.nome),
          elemento('small','',item.telefoneMascarado));
        const actions=elemento('div','actions');
        actions.append(elemento('span','tag'+
          (item.status==='bloqueado'||item.status==='denunciado'?' off':
          item.status==='pendente'||item.status==='aberto'?' warn':''),
          item.status==='enviado-manualmente'?'Enviado (confirmado por você)':item.status));
        if(['pendente','aberto'].includes(item.status)){
          actions.append(botao(item.status==='aberto'?'Retomar conversa':
            'Preparar conversa',()=>prepararConversaManual(item.contatoId),'secondary'));
        } else if (item.status==='enviado-manualmente') {
          actions.append(botao('Registrar denúncia recebida',
            ()=>denunciarAposEnvioManual(item.contatoId),'quiet'));
        } else if (item.status==='incerto') {
          actions.append(
            botao('Conferi: foi enviado',
              ()=>conciliarWhatsApp(item.contatoId,'enviado'),'secondary'),
            botao('Conferi: não foi enviado',
              ()=>conciliarWhatsApp(item.contatoId,'nao-enviado'),'quiet')
          );
        }
        linha.append(perfil,actions);
        lista.append(linha);
      }
      $('manualQueueDetail').scrollIntoView({behavior:'smooth',block:'start'});
    } catch(e) { flash(e.message,true); }
  }

  async function prepararConversaManual(contatoId) {
    if(!state.manualQueue)return;
    if(state.conexaoAtiva && $('useChrome').checked) {
      flash('Primeiro clique em Salvar sessão e fechar para liberar o Chrome dos convites.',true);
      return;
    }
    try {
      const res=await api('/api/local/campanhas/convite/manual/preparar','POST',{
        campanhaId:state.manualQueue.id,contatoId,
      });
      const conversa=res.conversa;
      if (!conversa.url.startsWith('https://wa.me/')) {
        throw new Error('O link retornado não é uma conversa do WhatsApp.');
      }
      state.manualConversa={contatoId,campanhaId:state.manualQueue.id};
      $('manualRecipient').textContent=(conversa.nome||'Contato')+
        ' · '+conversa.numeroMascarado;
      $('manualMessageReady').value=conversa.mensagem;
      $('manualOpenWa').href=conversa.url;
      $('manualSentConfirm').checked=false;
      $('manualMarkSent').disabled=true;
      $('manualComposer').hidden=false;
      await abrirFilaManual(state.manualQueue.id);
      $('manualComposer').scrollIntoView({behavior:'smooth',block:'center'});
      if(!$('useChrome').checked) {
        state.chromeFase='inativo';
        $('chromeStatus').textContent='Automação desmarcada. Use o link manual abaixo.';
        $('chromeSend').disabled=true;
        $('chromeCancel').disabled=true;
        $('chromePrepare').disabled=false;
        return;
      }
      try {
        const atual=await api('/api/local/campanhas/convite/whatsapp/estado');
        const s=atual.estado;
        if(s.ocupado && s.campanhaId===state.manualConversa.campanhaId &&
            s.contatoId===state.manualConversa.contatoId) {
          apresentarEstadoChrome(s);
          iniciarAcompanhamentoChrome();
        } else {
          await prepararWhatsappChrome();
        }
      }catch(e) {
        $('chromeStatus').textContent='Chrome indisponível: '+e.message+
          '. Use a alternativa manual abaixo.';
        flash('Não foi possível automatizar a preparação. A opção manual permanece disponível.',true);
      }
    } catch(e) { flash(e.message,true); }
  }

  function apresentarEstadoChrome(s) {
    state.chromeFase=s.fase;
    const status={
      inativo:'Ainda não existe uma janela controlada.',
      iniciando:'Iniciando o Chrome com sua sessão do WhatsApp...',
      abrindo:'Aguardando o WhatsApp Web e o destinatário aparecerem...',
      pronto:'Conversa preenchida. CONFIRA número, nome e texto no Chrome antes de enviar.',
      enviando:'Clique efetuado. Aguardando confirmação na conversa...',
      confirmado:'Mensagem enviada e confirmada pela conversa no WhatsApp.',
      cancelando:'Fechando o Chrome sem solicitar o envio...',
      cancelado:'Preparação cancelada, sem envio.',
      erro:'Falha ao preparar o WhatsApp. Use o modo manual se necessário.',
      incerto:'Envio não confirmado. Confira a conversa; não repita automaticamente.',
    };
    $('chromeStatus').textContent=status[s.fase]||s.mensagem||'Aguardando WhatsApp.';
    const atual=state.manualConversa;
    const mesmo=atual && atual.campanhaId===s.campanhaId &&
      atual.contatoId===s.contatoId;
    $('chromeSend').disabled=!(mesmo && s.fase==='pronto');
    $('chromeCancel').disabled=!(mesmo && ['iniciando','abrindo','pronto'].includes(s.fase));
    $('chromePrepare').disabled=Boolean(s.ocupado);
    $('manualMarkSent').disabled=Boolean(s.ocupado) || !$('manualSentConfirm').checked;
    for(const id of ['manualIgnore','manualComplaint','manualCancel']){
      $(id).disabled=Boolean(s.ocupado);
    }
  }

  function pararAcompanhamentoChrome() {
    if(state.chromeTimer)clearInterval(state.chromeTimer);
    state.chromeTimer=null;
  }

  async function acompanharWhatsappChrome() {
    try {
      const res=await api('/api/local/campanhas/convite/whatsapp/estado');
      apresentarEstadoChrome(res.estado);
      const fase=res.estado.fase;
      if(['confirmado','cancelado','erro','incerto'].includes(fase)) {
        pararAcompanhamentoChrome();
        if(fase==='confirmado'||fase==='cancelado') {
          const id=res.estado.campanhaId;
          state.manualConversa=null;
          $('manualComposer').hidden=true;
          if(id)await Promise.all([abrirFilaManual(id),
            carregarFilasManual(),carregarControleManual()]);
          if(fase==='confirmado')flash('WhatsApp confirmou o envio e o histórico foi atualizado.');
        } else {
          if(fase==='incerto') {
            const id=res.estado.campanhaId;
            state.manualConversa=null;
            $('manualComposer').hidden=true;
            if(id)await Promise.all([abrirFilaManual(id),
              carregarFilasManual(),carregarControleManual()]);
          }
          flash(fase==='incerto'
            ? 'Resultado incerto: confira a conversa e use os botões de conciliação da fila. Não houve segunda tentativa.'
            : 'A preparação do WhatsApp falhou. Nenhum novo envio foi iniciado automaticamente.',true);
        }
      }
    }catch(error) {
      pararAcompanhamentoChrome();
      $('chromeStatus').textContent='Falha de comunicação com o painel. Verifique o WhatsApp.';
    }
  }
  function iniciarAcompanhamentoChrome() {
    pararAcompanhamentoChrome();
    state.chromeTimer=setInterval(acompanharWhatsappChrome,1400);
  }
  async function prepararWhatsappChrome() {
    const atual=state.manualConversa;
    if(!atual)return;
    $('chromeStatus').textContent='Abrindo o Chrome com a sessão das promoções...';
    $('chromeSend').disabled=true;
    const r=await api('/api/local/campanhas/convite/whatsapp/preparar','POST',atual);
    apresentarEstadoChrome(r.estado);
    iniciarAcompanhamentoChrome();
  }
  async function enviarWhatsappChrome() {
    const atual=state.manualConversa;
    if(!atual || state.chromeFase!=='pronto')return;
    if(!confirm('Revise no Chrome o NÚMERO, o DESTINATÁRIO e a MENSAGEM. Enviar agora esta única mensagem?'))return;
    try{
      const r=await api('/api/local/campanhas/convite/whatsapp/enviar','POST',
        {...atual,confirmar:true});
      apresentarEstadoChrome(r.estado);
      iniciarAcompanhamentoChrome();
    }catch(e){flash(e.message,true);}
  }
  async function cancelarWhatsappChrome() {
    const atual=state.manualConversa;
    if(!atual || !confirm('Confirma que NÃO enviou a mensagem? Cancelar a janela e voltar à fila?'))return;
    try{
      const r=await api('/api/local/campanhas/convite/whatsapp/cancelar','POST',
        {...atual,confirmarNaoEnviado:true});
      apresentarEstadoChrome(r.estado);
      iniciarAcompanhamentoChrome();
    }catch(e){flash(e.message,true);}
  }

  async function registrarManual(acao) {
    const atual=state.manualConversa;
    if(!atual)return;
    if(acao==='enviado'&&!$('manualSentConfirm').checked)return;
    if(['abrindo','iniciando','pronto','enviando','cancelando'].includes(state.chromeFase) &&
        acao!=='denunciado') {
      flash('Finalize ou cancele a janela automática antes de registrar o contato manualmente.',true);
      return;
    }
    if(acao==='denunciado'&&!confirm(
      'Você recebeu de fato SAIR ou DENUNCIAR deste contato? Isso bloqueará novos convites.'))return;
    if(acao==='cancelado'&&!confirm(
      'Cancele somente se a mensagem NÃO foi enviada. Deseja voltar à fila?'))return;
    if(acao==='ignorado'&&!confirm('Ignorar este contato nesta fila?'))return;
    try {
      await api('/api/local/campanhas/convite/manual/registrar','POST',{
        ...atual,acao,confirmado:acao==='enviado'&&$('manualSentConfirm').checked,
      });
      $('manualComposer').hidden=true;
      $('manualOpenWa').href='#';
      $('manualMessageReady').value='';
      state.manualConversa=null;
      await Promise.all([abrirFilaManual(atual.campanhaId),
        carregarFilasManual(),carregarControleManual()]);
      if(acao==='denunciado') {
        await Promise.all([carregarDenuncias(),carregarMeta()]);
        const elegiveis=await api('/api/local/campanhas/destinatarios');
        state.autorizados=elegiveis.destinatarios;
        renderResumo();
      }
      flash(acao==='enviado'
        ? 'Envio manual registrado após sua confirmação. Nenhum disparo automático ocorreu.'
        : acao==='denunciado'
          ? 'Denúncia registrada: número bloqueado para novos convites.'
          : 'Contato atualizado na fila.');
    } catch(e) { flash(e.message,true); }
  }

  async function conciliarWhatsApp(contatoId,resultado) {
    const fila=state.manualQueue;
    if(!fila)return;
    try{
      const status=await api('/api/local/campanhas/convite/whatsapp/estado');
      if(status.estado.ocupado){
        flash('Aguarde a janela do Chrome terminar antes de conciliar.',true);
        return;
      }
      if(resultado==='nao-enviado'){
        const frase=prompt('Confira a conversa no WhatsApp. Digite NÃO ENVIEI apenas se tiver certeza de que NÃO houve envio:');
        if(frase?.trim().toLocaleUpperCase('pt-BR')!=='NÃO ENVIEI')return;
      } else if(!confirm(
        'Você viu a mensagem realmente ENVIADA na conversa do destinatário? Registrar como enviada sem clicar novamente?'))return;
      await api('/api/local/campanhas/convite/whatsapp/conciliar','POST',{
        campanhaId:fila.id,contatoId,resultado,confirmado:true,
      });
      await Promise.all([abrirFilaManual(fila.id),carregarFilasManual(),
        carregarControleManual()]);
      flash(resultado==='enviado'
        ? 'Envio confirmado manualmente no histórico, sem novo clique.'
        : 'Confirmação de NÃO envio registrada. O contato voltou à fila; confirme antes de abrir novamente.');
    }catch(e){flash(e.message,true);}
  }

  async function denunciarAposEnvioManual(contatoId) {
    const fila=state.manualQueue;
    if (!fila || !confirm('Você recebeu realmente SAIR ou DENUNCIAR? O contato ficará bloqueado para convites futuros.')) {
      return;
    }
    try {
      await api('/api/local/campanhas/convite/manual/registrar','POST',{
        campanhaId:fila.id,contatoId,acao:'denunciado',
      });
      await Promise.all([
        abrirFilaManual(fila.id),carregarFilasManual(),carregarControleManual(),
        carregarDenuncias(),carregarMeta(),
      ]);
      const elegiveis=await api('/api/local/campanhas/destinatarios');
      state.autorizados=elegiveis.destinatarios;
      renderResumo();
      flash('Denúncia após envio registrada. Contato bloqueado para novos convites.');
    }catch(e){flash(e.message,true);}
  }

  async function carregar() {
    const result=await api('/api/local/campanhas/destinatarios');
    state.autorizados=result.destinatarios;
    renderResumo();
    await Promise.all([carregarMeta(),carregarModeloUnico(),
      carregarFilasCloud(),carregarFilasManual(),carregarControleManual(),
      carregarConexaoWhatsapp(),carregarDenuncias()]);
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

  function csvCelula(valor) {
    let texto=String(valor||'').replace(/[\x00-\x1f]/g,' ').trim();
    if(/^[\s]*[=+@-]/.test(texto))texto="'"+texto;
    return '"'+texto.replace(/"/g,'""')+'"';
  }

  $('whatsappConnectOpen').addEventListener('click',abrirConexaoWhatsapp);
  $('whatsappConnectClose').addEventListener('click',fecharConexaoWhatsapp);
  $('whatsappConnectRefresh').addEventListener('click',carregarConexaoWhatsapp);
  $('createManualQueue').addEventListener('click',criarFilaManual);
  $('refreshManualQueues').addEventListener('click',()=>Promise.all([
    carregarFilasManual(),carregarControleManual(),
  ]).catch(e=>flash(e.message,true)));
  $('closeManualQueue').addEventListener('click',()=>{
    $('manualQueueDetail').hidden=true;
    $('manualComposer').hidden=true;
    pararAcompanhamentoChrome();
    state.manualQueue=null;
    state.manualConversa=null;
    $('manualOpenWa').href='#';
  });
  $('manualSentConfirm').addEventListener('change',()=>{
    $('manualMarkSent').disabled=!$('manualSentConfirm').checked ||
      ['abrindo','iniciando','pronto','enviando','cancelando'].includes(state.chromeFase);
  });
  $('chromePrepare').addEventListener('click',()=>prepararWhatsappChrome().catch(e=>flash(e.message,true)));
  $('chromeSend').addEventListener('click',enviarWhatsappChrome);
  $('chromeCancel').addEventListener('click',cancelarWhatsappChrome);
  $('manualMarkSent').addEventListener('click',()=>registrarManual('enviado'));
  $('manualIgnore').addEventListener('click',()=>registrarManual('ignorado'));
  $('manualComplaint').addEventListener('click',()=>registrarManual('denunciado'));
  $('manualCancel').addEventListener('click',()=>registrarManual('cancelado'));
  $('singleText').addEventListener('input',atualizarPreviewUnico);
  $('templateName').addEventListener('input',()=>{
    state.cloudModeloAprovado=false;atualizarDetalhesCloud();
  });
  $('saveSingle').addEventListener('click',()=>salvarUnico().catch(e=>flash(e.message,true)));
  $('simulateSingle').addEventListener('click',simularUnico);
  $('downloadModel').addEventListener('click',exportarModeloUnico);
  $('createCloudQueue').addEventListener('click',criarFilaCloud);
  $('refreshCloudQueues').addEventListener('click',()=>carregarFilasCloud().catch(e=>flash(e.message,true)));
  $('exportCloudReport').addEventListener('click',relatorioFilaCloud);
  $('checkMetaModel').addEventListener('click',verificarModeloCloud);
  $('sendCloudBatch').addEventListener('click',enviarLoteCloud);
  $('refreshCloudDetail').addEventListener('click',()=>{
    if(state.cloudQueue)abrirFilaCloud(state.cloudQueue.id);
  });
  $('closeCloudQueue').addEventListener('click',()=>{
    $('cloudQueueDetail').hidden=true;state.cloudQueue=null;
  });
  $('importFile').addEventListener('change',importarArquivo);
  $('clearImport').addEventListener('click',limparImportacao);
  $('reloadMeta').addEventListener('click',()=>Promise.all([
    carregarMeta(),carregarDenuncias(),
  ]));
  carregar().catch(erro=>{
    flash('Não foi possível carregar o painel local: '+erro.message,true);
  });
})();
