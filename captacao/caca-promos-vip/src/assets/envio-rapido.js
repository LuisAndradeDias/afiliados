(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const state={stage:1,proprio:true,contato:null,fila:null,conversa:null,
    modelo:null,preparing:false,workerTimer:null,connectionTimer:null,
    fase:'inativo',finalizado:false,incerto:false,lookingUp:false};
  const lastKey='cpv-envio-individual-v1';
  const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;

  const show=(id,visible=true)=>{$(id).hidden=!visible;};
  function toast(msg,erro=false){
    const el=$('quickToast');el.textContent=msg;
    el.className='quick-toast'+(erro?' is-error':'');el.hidden=false;
    clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,9500);
  }
  async function api(path,body){
    const opt=body===undefined?{}:{
      method:'POST',headers:{'content-type':'application/json','x-cpv-local':'1'},
      body:JSON.stringify(body),
    };
    const resp=await fetch(path,opt);
    let data;
    try{data=await resp.json();}catch{throw new Error('Não foi possível ler o servidor local.');}
    if(!resp.ok||data.ok===false)throw new Error(data.mensagem||'Não foi possível concluir a operação.');
    return data;
  }
  function errorMessage(msg,kind='is-error'){
    const el=$('quickSelfResult');
    el.hidden=false;el.className='quick-message '+kind;el.textContent=msg;
  }
  function setStage(n){
    state.stage=n;
    for(let i=1;i<=3;i++){
      show('quickStage'+i,i===n);
      const p=$('quickStep'+i);
      p.classList.toggle('is-active',i===n);
      p.classList.toggle('is-done',i<n);
      p.querySelector('span').textContent=i<n?'✓':String(i);
    }
    $('quickStage'+n).scrollIntoView({behavior:'smooth',block:'start'});
  }
  function resetSelection(){
    state.contato=null;
    $('quickGoMessage').disabled=true;
    show('quickSelected',false);
    $('quickStep1Hint').textContent='Escolha um contato autorizado para continuar.';
    show('quickSelfResult',false);show('quickNewContact',false);show('quickBlocked',false);
  }
  function chooseMode(proprio){
    state.proprio=proprio;resetSelection();
    show('quickSelf',proprio);show('quickOther',!proprio);
    $('quickChooseSelf').classList.toggle('is-chosen',proprio);
    $('quickChooseOther').classList.toggle('is-chosen',!proprio);
    $('quickChooseSelf').setAttribute('aria-pressed',String(proprio));
    $('quickChooseOther').setAttribute('aria-pressed',String(!proprio));
    if(proprio){$('quickPhone').focus();}else{$('quickSearch').focus();}
  }
  function selectContact(c){
    if(!c||!uuid.test(c.contatoId||c.id||''))throw new Error('Contato inválido.');
    state.contato={id:c.contatoId||c.id,nome:c.nome||'Contato',
      telefoneMascarado:c.telefoneMascarado};
    $('quickSelectedName').textContent=state.contato.nome;
    $('quickSelectedPhone').textContent=state.contato.telefoneMascarado;
    show('quickSelected');$('quickGoMessage').disabled=false;
    $('quickStep1Hint').textContent='Contato autorizado. Nenhuma mensagem foi enviada.';
    show('quickNewContact',false);show('quickBlocked',false);
    if(state.proprio)errorMessage('✓ Autorização confirmada. Pode seguir para a mensagem.','');
  }
  async function lookup(){
    resetSelection();
    const numero=$('quickPhone').value.trim();
    const button=$('quickLookup');button.disabled=true;
    try{
      const {contato}=await api('/api/local/campanhas/rapido/consultar',{telefone:numero});
      if(contato.situacao==='autorizado'){
        selectContact(contato);
      }else if(['bloqueado','descadastrado'].includes(contato.situacao)){
        errorMessage(contato.mensagem||'Este contato não pode receber novos convites.');
        show('quickBlocked');
        $('quickStep1Hint').textContent='Primeiro confirme nova autorização em Contatos.';
      }else if(contato.situacao==='novo'){
        show('quickNewContact');
        errorMessage('Número ainda não cadastrado. Caso seja seu, registre a autorização para testar.','');
        $('quickNewName').focus();
      }else{
        errorMessage('Este número não tem autorização confirmada. Veja a ficha em Contatos.');
        $('quickStep1Hint').textContent='Contato não autorizado.';
      }
    }catch(e){errorMessage(e.message);toast(e.message,true);}
    finally{button.disabled=false;}
  }
  async function registerOwn(){
    if(!$('quickOwnerConsent').checked)return toast('Confirme que você é titular deste número.',true);
    const nome=$('quickNewName').value.trim();
    const button=$('quickRegister');button.disabled=true;
    try{
      if(!confirm('Confirmar que este WhatsApp é seu e que você aceita receber um convite de teste?')){
        return;
      }
      const data=await api('/api/local/campanhas/rapido/cadastrar',{
        telefone:$('quickPhone').value,nome,
        souTitular:true,autorizado:true,confirmado:true,
      });
      selectContact(data.contato);
      toast('Seu contato foi autorizado para um convite individual. Nada foi enviado.');
      await loadCounters();
    }catch(e){errorMessage(e.message);toast(e.message,true);}
    finally{button.disabled=false;}
  }
  async function searchContact(){
    const query=$('quickSearch').value.trim();
    const box=$('quickSearchResults');box.replaceChildren();
    if(query.length<2){
      box.textContent='Digite pelo menos dois caracteres para encontrar alguém.';
      return;
    }
    $('quickSearchButton').disabled=true;
    try{
      const r=await api('/api/local/campanhas/rapido/contatos?busca='+encodeURIComponent(query));
      if(!r.contatos.length){
        const message=document.createElement('p');message.className='quick-no-results';
        message.textContent='Nenhum autorizado encontrado. Verifique o nome ou número na área de Contatos.';
        box.append(message);return;
      }
      for(const contato of r.contatos){
        const btn=document.createElement('button');btn.type='button';btn.className='quick-result-row';
        const person=document.createElement('span');const name=document.createElement('strong');
        name.textContent=contato.nome;const phone=document.createElement('small');
        phone.textContent=contato.telefoneMascarado;person.append(name,phone);
        const tag=document.createElement('span');tag.textContent='Escolher →';
        btn.append(person,tag);
        btn.addEventListener('click',()=>{selectContact(contato);toast('Contato selecionado.');});
        box.append(btn);
      }
      if(r.total>r.contatos.length){
        const more=document.createElement('p');more.className='quick-no-results';
        more.textContent='Exibindo os primeiros '+r.contatos.length+' resultados. Digite um termo mais específico.';
        box.append(more);
      }
    }catch(e){toast(e.message,true);box.textContent=e.message;}
    finally{$('quickSearchButton').disabled=false;}
  }
  async function loadModel(){
    // O servidor ja entregou o modelo salvo no HTML. A atualizacao
    // assincrona nao pode limpar o campo nem descartar o que foi digitado.
    const mensagemAntes=$('quickText').value;
    const grupoAntes=$('quickGroup').value;
    const r=await api('/api/local/campanhas/convite/modelo');
    const cfg=r.configuracao;
    if(typeof cfg?.mensagem!=='string'||!cfg.mensagem.trim()||
      typeof cfg.grupoUrl!=='string'){
      throw new Error('A resposta do modelo salvo esta incompleta.');
    }
    state.modelo=cfg;
    if($('quickText').value===mensagemAntes)$('quickText').value=cfg.mensagem;
    if($('quickGroup').value===grupoAntes)$('quickGroup').value=cfg.grupoUrl;
    updateLength();
  }
  function restaurarModelo(){
    const modelo=state.modelo;
    if(typeof modelo?.mensagem!=='string'||!modelo.mensagem.trim()){
      return toast('O modelo padrão não está disponível. Confira as configurações.',true);
    }
    if(($('quickText').value!==modelo.mensagem||
        $('quickGroup').value!==modelo.grupoUrl)&&
      !confirm('Restaurar a mensagem e o link do grupo salvos? As alterações ainda não salvas serão substituídas.')){
      return;
    }
    $('quickText').value=modelo.mensagem;
    $('quickGroup').value=modelo.grupoUrl||'';
    updateLength();
    toast('Mensagem e link do grupo restaurados a partir do modelo salvo.');
  }
  function updateLength(){
    $('quickTextCount').textContent=$('quickText').value.length+' / 1.024';
  }
  function nextMessage(){
    if(!state.contato)return toast('Escolha um contato antes de continuar.',true);
    $('quickMessageTarget').textContent=state.contato.nome+
      ' · '+state.contato.telefoneMascarado;
    setStage(2);
  }
  function setResult(text,kind=''){
    const el=$('quickResult');el.hidden=false;
    el.className='quick-result'+(kind?' '+kind:'');el.textContent=text;
  }
  function persist(){
    if(state.fila&&state.contato){
      try{sessionStorage.setItem(lastKey,JSON.stringify({
        campanhaId:state.fila.id,contatoId:state.contato.id,
      }));}catch{}
    }
  }
  function clearPersist(){try{sessionStorage.removeItem(lastKey);}catch{}}
  function showFinal(conversa){
    $('quickSendTarget').textContent=state.contato.nome+
      ' · '+state.contato.telefoneMascarado;
    $('quickFinalText').textContent=conversa.mensagem;
    $('quickManualLink').href=conversa.url;
    state.conversa=conversa;
    show('quickResult',false);
    state.finalizado=false;state.incerto=false;state.fase='inativo';
    $('quickPrepareChrome').disabled=false;
    $('quickConfirmChrome').disabled=true;
    $('quickCancelChrome').disabled=true;
    $('quickManualCheck').checked=false;
    $('quickManualDone').disabled=true;
    $('quickChromeStatus').textContent='Conversa preparada, mas ainda não enviada. Abra no Chrome.';
    setStage(3);
  }
  async function createInvite(){
    if(!state.contato)return;
    const msg=$('quickText').value.trim();
    const group=$('quickGroup').value.trim();
    if(msg.length<8)return toast('Escreva uma mensagem com pelo menos 8 caracteres.',true);
    if(!/^https:\/\/chat\.whatsapp\.com\/[a-z0-9]+$/i.test(group))
      return toast('Informe o link válido do grupo (chat.whatsapp.com).',true);
    const btn=$('quickCreate');btn.disabled=true;
    try{
      const cfg=await api('/api/local/campanhas/convite/modelo',{
        mensagem:msg,grupoUrl:group,
        nomeModelo:state.modelo?.nomeModelo||'convite_ofertas_v1',
      });
      state.modelo=cfg.configuracao;
      const start=await api('/api/local/campanhas/rapido/criar',{
        contatoId:state.contato.id,confirmado:true,proprio:state.proprio,
      });
      state.fila=start.fila;
      persist();
      const manual=await api('/api/local/campanhas/convite/manual/preparar',{
        campanhaId:state.fila.id,contatoId:state.contato.id,
      });
      if(!manual.conversa.url.startsWith('https://wa.me/')){
        throw new Error('O destino da conversa retornado é inválido.');
      }
      showFinal(manual.conversa);
      toast(start.reutilizada?'Seu convite anterior foi retomado.':'Um convite preparado. Nenhuma mensagem enviada.');
      await loadCounters();
    }catch(e){toast(e.message,true);}
    finally{btn.disabled=false;}
  }
  function workerState(s){
    const phase=s.fase||'inativo';
    state.fase=phase;
    const matching=!!state.contato&&!!state.fila&&
      s.campanhaId===state.fila.id&&s.contatoId===state.contato.id;
    const statuses={
      inativo:'Chrome ainda não aberto para este convite.',
      iniciando:'Abrindo o Chrome com sua sessão do WhatsApp...',
      abrindo:'Aguarde a conversa aparecer no Chrome...',
      pronto:'Conversa preenchida. Confira o número e o texto no Chrome antes de enviar.',
      enviando:'Envio solicitado. Aguardando confirmação do WhatsApp...',
      confirmado:'Mensagem enviada e confirmada na conversa.',
      cancelando:'Cancelando a conversa sem enviar...',
      cancelado:'Conversa cancelada. Nenhum envio confirmado.',
      erro:'Não foi possível preparar o Chrome. Você pode usar a alternativa manual.',
      incerto:'Texto saiu do campo sem confirmação de envio. Confira a conversa; não repita agora.',
    };
    $('quickChromeStatus').textContent=(matching
      ?(phase==='incerto'&&s.mensagem?s.mensagem:statuses[phase]):null)||
      (!s.ocupado?'Abra sua conversa no Chrome.':'Há outra conversa aberta no WhatsApp.');
    $('quickPrepareChrome').disabled=!!s.processoAtivo||state.finalizado||state.incerto;
    $('quickConfirmChrome').disabled=!(matching&&phase==='pronto')||state.finalizado;
    $('quickCancelChrome').disabled=!(matching&&['iniciando','abrindo','pronto'].includes(phase));
    $('quickManualDone').disabled=!!s.processoAtivo||state.finalizado||state.incerto||
      !$('quickManualCheck').checked;
    $('quickManualLink').setAttribute('aria-disabled',
      s.processoAtivo?'true':'false');
    $('quickManualLink').classList.toggle('is-disabled',Boolean(s.processoAtivo));
  }
  async function workerPoll(){
    try{
      const {estado:s}=await api('/api/local/campanhas/convite/whatsapp/estado');
      workerState(s);
      const matching=state.fila&&state.contato&&
        s.campanhaId===state.fila.id&&s.contatoId===state.contato.id;
      if(matching&&['confirmado','cancelado','erro','incerto'].includes(s.fase)){
        stopWorker();
        if(s.fase==='confirmado'){
          state.finalizado=true;clearPersist();
          $('quickPrepareChrome').disabled=true;$('quickManualDone').disabled=true;
          setResult('Mensagem enviada e confirmada no WhatsApp. O histórico já foi atualizado.','');
          await loadCounters();
        }else if(s.fase==='incerto'){
          state.incerto=true;
          $('quickPrepareChrome').disabled=true;
          show('quickManualDisclosure',false);
          setResult((s.mensagem||'O envio não foi confirmado.')+
            ' Se o texto desapareceu, ele continua na prévia acima. Antes de usar de novo, confira se há uma nova bolha enviada no WhatsApp e concilie em Listas e filas.','is-warning');
        }else if(s.fase==='cancelado'){
          setResult('Conversa cancelada sem envio. Você pode preparar novamente.','');
        }else{
          setResult('O Chrome não conseguiu preparar a conversa. Use a alternativa manual ou tente novamente.','is-warning');
        }
      }
    }catch{
      stopWorker();state.incerto=true;
      $('quickConfirmChrome').disabled=true;
      $('quickPrepareChrome').disabled=true;
      $('quickManualDone').disabled=true;
      show('quickManualDisclosure',false);
      $('quickChromeStatus').textContent='Não foi possível consultar a sessão. Confira o WhatsApp antes de repetir.';
      setResult('O estado da janela não pôde ser confirmado. Confira em Listas e filas antes de tentar outra vez.','is-warning');
    }
  }
  async function copiarMensagem(){
    const mensagem=state.conversa?.mensagem||$('quickFinalText').textContent||'';
    if(!mensagem.trim())return toast('Não há mensagem preparada para copiar.',true);
    try{
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(mensagem);
      }else{
        const campo=document.createElement('textarea');
        campo.value=mensagem;
        campo.style.position='fixed';
        campo.style.opacity='0';
        document.body.append(campo);
        campo.focus();
        campo.select();
        const copiado=document.execCommand('copy');
        campo.remove();
        if(!copiado)throw new Error('Cópia indisponível.');
      }
      toast('Mensagem copiada. Confira o histórico do WhatsApp antes de qualquer nova tentativa.');
    }catch{
      toast('Não foi possível copiar. Selecione o texto da prévia e use Ctrl+C.',true);
    }
  }
  function stopWorker(){if(state.workerTimer)clearInterval(state.workerTimer);state.workerTimer=null;}
  function startWorker(){
    stopWorker();state.workerTimer=setInterval(workerPoll,1400);
  }
  async function prepareChrome(){
    if(!state.fila||!state.contato||state.finalizado||state.incerto)return;
    $('quickPrepareChrome').disabled=true;
    try{
      const conn=await api('/api/local/campanhas/convite/whatsapp/conexao/estado');
      if(conn.estado.ocupado)throw new Error('Feche a janela de conexão do WhatsApp antes de preparar o convite.');
      const r=await api('/api/local/campanhas/convite/whatsapp/preparar',{
        campanhaId:state.fila.id,contatoId:state.contato.id,
      });
      workerState(r.estado);startWorker();toast('Abrindo o Chrome para conferir sua conversa.');
    }catch(e){toast(e.message,true);$('quickPrepareChrome').disabled=false;
      setResult(e.message,'is-warning');}
  }
  async function confirmChrome(){
    if(state.fase!=='pronto'||state.finalizado||!state.fila)return;
    if(!confirm('Você conferiu no Chrome o número e o texto?\n\nConfirma o ENVIO desta única mensagem agora?'))return;
    $('quickConfirmChrome').disabled=true;
    try{
      const r=await api('/api/local/campanhas/convite/whatsapp/enviar',{
        campanhaId:state.fila.id,contatoId:state.contato.id,confirmar:true,
      });
      workerState(r.estado);startWorker();
    }catch(e){toast(e.message,true);await workerPoll();}
  }
  async function cancelChrome(){
    if(!state.fila||!confirm('Confirma que a mensagem NÃO foi enviada e deseja cancelar esta conversa?'))return;
    try{
      const r=await api('/api/local/campanhas/convite/whatsapp/cancelar',{
        campanhaId:state.fila.id,contatoId:state.contato.id,confirmarNaoEnviado:true,
      });
      workerState(r.estado);startWorker();
    }catch(e){toast(e.message,true);}
  }
  async function manualDone(){
    if(!state.fila||!state.contato||!$('quickManualCheck').checked||state.finalizado||state.incerto)return;
    $('quickManualDone').disabled=true;
    try{
      const s=(await api('/api/local/campanhas/convite/whatsapp/estado')).estado;
      if(s.processoAtivo)throw new Error('Finalize a janela do Chrome antes de registrar envio manual.');
      if(!confirm('Você realmente enviou essa mensagem manualmente para o número mostrado no WhatsApp?'))return;
      await api('/api/local/campanhas/convite/manual/registrar',{
        campanhaId:state.fila.id,contatoId:state.contato.id,
        acao:'enviado',confirmado:true,
      });
      state.finalizado=true;clearPersist();
      $('quickPrepareChrome').disabled=true;
      setResult('Envio manual registrado após sua confirmação. O painel não disparou mensagens automaticamente.','');
      await loadCounters();
    }catch(e){toast(e.message,true);$('quickManualDone').disabled=false;}
  }
  async function loadConnection(){
    const {estado:s}=await api('/api/local/campanhas/convite/whatsapp/conexao/estado');
    const statuses={
      inativo:'Não verificada',iniciando:'Abrindo',abrindo:'Abrindo',
      aguardando:'Carregando',qr:'QR Code disponível',conectado:'Conectado',
      fechando:'Finalizando',encerrando:'Finalizando',
      fechado:'Sessão preservada',erro:'Verificar Chrome',
    };
    $('quickConnectionBrief').textContent=statuses[s.fase]||'Verificar';
    $('quickConnectionStatus').textContent=s.mensagem||'Verifique a sessão do WhatsApp Web.';
    $('quickConnect').disabled=!!s.ocupado;
    $('quickCloseConnect').disabled=!s.ocupado||['fechando','encerrando'].includes(s.fase);
    if(s.ocupado&&!state.connectionTimer){
      state.connectionTimer=setInterval(()=>loadConnection().catch(()=>{}),1700);
    }else if(!s.ocupado&&state.connectionTimer){
      clearInterval(state.connectionTimer);state.connectionTimer=null;
    }
    return s;
  }
  async function connect(open){
    try{
      if(!open&&!confirm('Fechar o Chrome de conexão? A sessão continuará salva para os convites.'))return;
      const path='/api/local/campanhas/convite/whatsapp/conexao/'+(open?'abrir':'fechar');
      await api(path,{});
      $('quickConnectionDisclosure').open=true;
      await loadConnection();
    }catch(e){toast(e.message,true);}
  }
  async function loadCounters(){
    try{
      const [c,s]=await Promise.all([
        api('/api/local/gestao/resumo'),
        api('/api/local/campanhas/convite/manual/estatisticas'),
      ]);
      $('quickAllowed').textContent=c.contatos.autorizado||0;
      $('quickDay').textContent=s.controle.iniciadosHoje+' / '+s.controle.limiteDiario;
      $('quickOverallStatus').textContent='Envios confirmados hoje: '+
        s.controle.confirmadosHoje+' · Cada envio exige seu clique.';
    }catch{$('quickOverallStatus').textContent='Os contadores não estão disponíveis. O envio continua supervisionado.';}
  }
  function startOver(){
    if(['iniciando','abrindo','pronto','enviando','cancelando'].includes(state.fase))
      return toast('Finalize ou cancele a conversa atual antes de iniciar outra.',true);
    if(state.fila&&!state.finalizado&&!confirm('Seu convite preparado ficará salvo em Listas e filas. Deseja voltar para escolher outro?'))return;
    stopWorker();
    if(state.finalizado)clearPersist();
    state.contato=null;state.fila=null;state.conversa=null;
    state.finalizado=false;state.incerto=false;state.fase='inativo';
    show('quickManualDisclosure',true);
    resetSelection();setStage(1);
    toast('Escolha o próximo contato. Nenhuma mensagem enviada automaticamente.');
  }
  async function resume(filaId,contatoId){
    if(!uuid.test(filaId||'')||!uuid.test(contatoId||''))return;
    const resp=await api('/api/local/campanhas/convite/fila?id='+encodeURIComponent(filaId));
    const fila=resp.fila;
    const item=fila.itens?.find(x=>x.contatoId===contatoId);
    if(!item||fila.modo!=='web'||!['pendente','aberto','incerto'].includes(item.status))return;
    state.fila=fila;state.contato={id:contatoId,nome:item.nome,telefoneMascarado:item.telefoneMascarado};
    if(item.status==='incerto'){
      state.incerto=true;
      $('quickMessageTarget').textContent=item.nome;
      $('quickSendTarget').textContent=item.nome+' · '+item.telefoneMascarado;
      $('quickFinalText').textContent='Tentativa anterior com resultado incerto.';
      show('quickManualDisclosure',false);setStage(3);
      setResult('Resultado incerto. Confira a conversa na área de Listas e filas antes de fazer outro convite.','is-warning');
      $('quickPrepareChrome').disabled=true;return;
    }
    const res=await api('/api/local/campanhas/convite/manual/preparar',{
      campanhaId:filaId,contatoId,
    });
    showFinal(res.conversa);
    const status=await api('/api/local/campanhas/convite/whatsapp/estado');
    if(status.estado.processoAtivo&&status.estado.campanhaId===filaId&&
      status.estado.contatoId===contatoId){
      workerState(status.estado);startWorker();
    }
    toast('Sua conversa pendente foi retomada. Nenhuma mensagem enviada por esta tela.');
  }
  function wire(){
    $('quickChooseSelf').addEventListener('click',()=>chooseMode(true));
    $('quickChooseOther').addEventListener('click',()=>chooseMode(false));
    $('quickLookup').addEventListener('click',lookup);
    $('quickPhone').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookup();}});
    $('quickPhone').addEventListener('input',resetSelection);
    $('quickRegister').addEventListener('click',registerOwn);
    $('quickSearchButton').addEventListener('click',searchContact);
    $('quickSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchContact();}});
    $('quickSearch').addEventListener('input',resetSelection);
    $('quickGoMessage').addEventListener('click',nextMessage);
    $('quickBack1').addEventListener('click',()=>setStage(1));
    $('quickChangeTarget').addEventListener('click',()=>setStage(1));
    $('quickText').addEventListener('input',updateLength);
    $('quickRestoreModel').addEventListener('click',restaurarModelo);
    $('quickCreate').addEventListener('click',createInvite);
    $('quickPrepareChrome').addEventListener('click',prepareChrome);
    $('quickConfirmChrome').addEventListener('click',confirmChrome);
    $('quickCancelChrome').addEventListener('click',cancelChrome);
    $('quickManualCheck').addEventListener('change',()=>{
      $('quickManualDone').disabled=!$('quickManualCheck').checked||
        state.finalizado||state.incerto||
        ['iniciando','abrindo','pronto','enviando','cancelando'].includes(state.fase);
    });
    $('quickManualDone').addEventListener('click',manualDone);
    $('quickCopyText').addEventListener('click',copiarMensagem);
    $('quickManualLink').addEventListener('click',e=>{
      if(['iniciando','abrindo','pronto','enviando','cancelando'].includes(state.fase)){
        e.preventDefault();
        toast('Finalize ou cancele a janela controlada antes de abrir o WhatsApp manualmente.',true);
      }else if(state.incerto||state.finalizado){
        e.preventDefault();
        toast('Este convite já foi concluído ou exige conferência. Não envie duas vezes.',true);
      }
    });
    $('quickConnect').addEventListener('click',()=>connect(true));
    $('quickCloseConnect').addEventListener('click',()=>connect(false));
    $('quickRefreshConnect').addEventListener('click',()=>loadConnection().catch(e=>toast(e.message,true)));
    $('quickStartOver').addEventListener('click',startOver);
  }
  async function init(){
    // Modelo inicial vem seguro do HTML; persiste visivel mesmo com erro
    // temporario no fetch, para nunca abrir a etapa 2 em branco.
    state.modelo={mensagem:$('quickText').value,
      grupoUrl:$('quickGroup').value,nomeModelo:'convite_ofertas_v1'};
    updateLength();
    wire();
    const requests=await Promise.allSettled([loadModel(),loadCounters(),loadConnection()]);
    if(requests[0].status==='rejected'){
      toast('Não foi possível atualizar o modelo, mas o texto salvo permanece disponível.',true);
    }
    const saved=(()=>{try{return JSON.parse(sessionStorage.getItem(lastKey)||'null');}catch{return null;}})();
    if(saved?.campanhaId&&saved?.contatoId){
      try{await resume(saved.campanhaId,saved.contatoId);}
      catch(e){clearPersist();toast('Convite anterior não pôde ser retomado: '+e.message,true);}
    }
  }
  init().catch(e=>toast('Não foi possível carregar o envio guiado: '+e.message,true));
})();
