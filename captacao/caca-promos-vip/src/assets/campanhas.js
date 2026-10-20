(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { autorizados:[], importados:[], aptos:[], bloqueados:[],
    cloudMetaReady:false,cloudModeloAprovado:false,cloudQueue:null,cloudModel:null };
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
    if (!resp.filas.length) {
      el.append(elemento('div','empty',
        'Nenhuma fila criada. Você já pode salvar a mensagem e simular sem número.'));
      return;
    }
    for(const fila of resp.filas){
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

  async function carregar() {
    const result=await api('/api/local/campanhas/destinatarios');
    state.autorizados=result.destinatarios;
    renderResumo();
    await Promise.all([carregarMeta(),carregarModeloUnico(),
      carregarFilasCloud(),carregarDenuncias()]);
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
