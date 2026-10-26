import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { adquirirSessaoWhatsapp } from './whatsapp-sessao-lock.mjs';
import { classificarFalhaWorker, faseOcupadaWhatsapp, podeCancelarWhatsapp } from './estados/whatsapp-worker.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function iniciarControleWhatsapp({
  convites,sourceDir,simulacaoWorker=false,
  criarProcesso=spawn,agora=()=>new Date(),
}) {
  // Compartilha SOMENTE a pasta de perfil do robo de promocoes.
  // Nenhuma sessao/cookie/credencial e copiada ao painel ou frontend.
  const projeto=resolve(sourceDir,'../../..');
  const script=join(sourceDir,'whatsapp-convite-worker.mts');
  const tsx=join(projeto,'node_modules','tsx','dist','cli.mjs');
  let ativo=null;
  let ultimo={
    fase:'inativo',campanhaId:null,contatoId:null,mensagem:null,
    atualizadoEm:null,
  };

  function atualizar(fase,mensagem=null) {
    ultimo={
      fase,campanhaId:ativo?.campanhaId||ultimo.campanhaId,
      contatoId:ativo?.contatoId||ultimo.contatoId,
      mensagem,atualizadoEm:agora().toISOString(),
    };
  }

  function estado() {
    return {...ultimo,ocupado:faseOcupadaWhatsapp(ultimo.fase,Boolean(ativo)),
      processoAtivo:Boolean(ativo)};
  }

  function corresponde(campanhaId,contatoId){
    return ativo && ativo.campanhaId===campanhaId &&
      ativo.contatoId===contatoId;
  }

  function enviarComando(child,tipo){
    if (!child || child.killed || !child.stdin?.writable) {
      throw new Error('A janela do WhatsApp não está disponível.');
    }
    child.stdin.write(JSON.stringify({tipo})+'\n');
  }

  function finalizarSessao(ref,fase,mensagem){
    if(ref.finalizado)return;
    ref.finalizado=true;
    if(fase==='incerto'){
      try {
        convites.marcarTentativaIncerta({
          campanhaId:ref.campanhaId,contatoId:ref.contatoId,
        });
      } catch {
        // Falha no armazenamento também é incerta; nunca tentar um segundo clique.
        mensagem='Resultado incerto e falha ao gravar a fila. Interrompa e confira manualmente.';
      }
    }
    atualizar(fase,mensagem);
    // Preserva o lock até o processo do Chrome realmente terminar.
    // O evento "close" fará a liberação para o próximo destinatário.
  }

  function eventoWorker(ref,linha){
    if(ativo!==ref || ref.finalizado)return;
    let msg;
    try{msg=JSON.parse(linha);}catch{return;}
    switch(msg.tipo){
      case 'ABRINDO':atualizar('abrindo','Abrindo a sessão do WhatsApp Web...');break;
      case 'PRONTO':
        ref.jaPreparou=true;
        atualizar('pronto','Conversa preenchida. Confira o destinatário antes de enviar.');
        break;
      case 'ENVIANDO':ref.tentouEnviar=true;
        atualizar('enviando','Clique solicitado. Aguardando confirmação na conversa.');
        break;
      case 'CONFIRMADO':
        try {
          // Um envio físico realizado diretamente no Chrome também deve ser
          // registrado somente após a detecção da mensagem na conversa.
          if(!ref.tentouEnviar) {
            convites.marcarTentativaIncerta({
              campanhaId:ref.campanhaId,contatoId:ref.contatoId,
            });
          }
          convites.confirmarTentativaWorker({
            campanhaId:ref.campanhaId,contatoId:ref.contatoId,
          });
          finalizarSessao(ref,'confirmado',
            'Mensagem detectada na conversa e registrada no histórico.');
        } catch {
          finalizarSessao(ref,'incerto',
            'Mensagem detectada no WhatsApp, mas houve erro no histórico. Verifique antes de repetir.');
        }
        break;
      case 'INCERTO':{
        const sumiu=msg.detalhe==='texto-sumiu-sem-envio-confirmado';
        finalizarSessao(ref,'incerto',
          (sumiu
            ?'O campo ficou vazio, mas nao foi identificada nova mensagem enviada. '
            :'Nao foi identificada nova mensagem enviada apos a tentativa. ')+
          'Verifique a conversa e concilie em Listas e filas. Nao tente novamente sem confirmar.');
        break;
      }
      case 'CANCELADO':
        try{
          convites.marcarManual({campanhaId:ref.campanhaId,
            contatoId:ref.contatoId,acao:'cancelado'});
          finalizarSessao(ref,'cancelado','Conversa cancelada sem envio pelo painel.');
        }catch{
          finalizarSessao(ref,'incerto','Verifique o histórico antes de preparar novamente.');
        }
        break;
      case 'ERRO':
        finalizarSessao(ref,classificarFalhaWorker(ref),
          (ref.tentouEnviar||ref.jaPreparou)
            ? 'O WhatsApp não confirmou o envio. Revise a conversa antes de tentar novamente.'
            : 'Não foi possível preparar ou conferir a conversa (código: '+
              String(msg.detalhe||'desconhecido').slice(0,40)+'). Veja o WhatsApp.');
        break;
    }
  }

  function iniciar({campanhaId,contatoId}) {
    if(!UUID.test(String(campanhaId||'')) ||
      !UUID.test(String(contatoId||'')))throw new Error('Identificadores inválidos.');
    if(ativo)throw new Error('Já existe uma conversa do WhatsApp sendo preparada.');
    if(!existsSync(tsx) || !existsSync(script)){
      throw new Error('Ferramenta Playwright/tsx do projeto de promoções indisponível.');
    }
    // Trava compartilhada entre as duas portas locais. Testes fictícios
    // usam perfis isolados e dispensam a trava da sessão verdadeira.
    const liberarSessao=simulacaoWorker?()=>{}:adquirirSessaoWhatsapp(projeto);
    let dados;
    try {
      // Revalida o opt-in e a fila com a sessão reservada.
      dados=convites.prepararManual({campanhaId,contatoId});
      const telefoneVerificado=new URL(dados.url).pathname.slice(1);
      if(!/^55\d{10,11}$/.test(telefoneVerificado)) {
        throw new Error('Telefone brasileiro inválido para este fluxo.');
      }
    }catch(erro){
      liberarSessao();
      throw erro;
    }
    const telefone=new URL(dados.url).pathname.slice(1);

    let child;
    try {
      child=criarProcesso(process.execPath,[tsx,script],{
        cwd:projeto,windowsHide:false,
        env:{...process.env,CPV_WHATSAPP_MOCK_TEST:simulacaoWorker?'true':'false',
          WHATSAPP_AUTO_SEND_ENABLED:'false'},
        stdio:['pipe','pipe','pipe'],
      });
    }catch{
      liberarSessao();
      throw new Error('Não foi possível abrir o Chrome do WhatsApp.');
    }

    const ref={
      child,campanhaId,contatoId,tentouEnviar:false,jaPreparou:false,
      finalizado:false,liberarSessao,
    };
    ativo=ref;
    atualizar('iniciando','Preparando o WhatsApp com a mesma sessão das promoções.');
    const rl=createInterface({input:child.stdout});
    rl.on('line',(line)=>eventoWorker(ref,line));
    let bufferErro='';
    child.stderr.on('data',(chunk)=>{
      // Nunca expor stderr bruto: pode conter URL de contato, cookies ou texto.
      bufferErro=(bufferErro+String(chunk)).slice(-300);
    });
    child.on('error',()=>{
      if(ativo===ref && !ref.finalizado) {
        finalizarSessao(ref,classificarFalhaWorker(ref),
          'Chrome interrompido antes de confirmar o estado da conversa.');
      }
    });
    child.on('exit',()=>{
      if(ativo===ref && !ref.finalizado){
        finalizarSessao(ref,classificarFalhaWorker(ref),
          (ref.tentouEnviar||ref.jaPreparou)
            ? 'O Chrome fechou antes de confirmar o resultado. Não repita automaticamente.'
            : 'O Chrome foi fechado ou não conseguiu abrir a conversa.');
      }
    });
    child.on('close',()=>{
      if(ativo===ref)ativo=null;
      ref.liberarSessao();
    });
    try {
      child.stdin.write(JSON.stringify({
        tipo:'INICIAR',telefone,mensagem:dados.mensagem,
      })+'\n');
    }catch {
      child.kill();
      finalizarSessao(ref,'erro','Não foi possível transmitir o rascunho ao Chrome.');
      throw new Error('Erro ao iniciar a janela do WhatsApp.');
    }
    return estado();
  }

  function enviar({campanhaId,contatoId,confirmar=false}){
    if(confirmar!==true)throw new Error('Confirme o destinatário e a mensagem antes de enviar.');
    if(!corresponde(campanhaId,contatoId) || ultimo.fase!=='pronto'){
      throw new Error('A conversa precisa estar pronta e ser a mesma do painel.');
    }
    // Recheca opt-in, bloqueios e duplicacao antes do clique fisico.
    convites.validarEnvioManual({campanhaId,contatoId});
    // Persistir *antes* de solicitar o clique. Se o servidor ou Chrome cair,
    // a fila fica bloqueada como incerta e NÃO fará um segundo envio.
    convites.marcarTentativaIncerta({campanhaId,contatoId});
    const ref=ativo;
    ref.tentouEnviar=true;
    atualizar('enviando','Envio solicitado; aguardando confirmação real do WhatsApp.');
    enviarComando(ref.child,'ENVIAR');
    return estado();
  }

  function cancelar({campanhaId,contatoId,confirmarNaoEnviado=false}){
    if(confirmarNaoEnviado!==true) {
      throw new Error('Confirme que a mensagem NÃO foi enviada antes de cancelar.');
    }
    if(!corresponde(campanhaId,contatoId) ||
      !podeCancelarWhatsapp(ultimo.fase)){
      throw new Error('Não há preparação segura para cancelar.');
    }
    enviarComando(ativo.child,'CANCELAR');
    atualizar('cancelando','Fechando a janela sem solicitar o envio.');
    return estado();
  }

  return {estado,iniciar,enviar,cancelar};
}
