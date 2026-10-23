import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { adquirirSessaoWhatsapp } from './whatsapp-sessao-lock.mjs';

// Abre SOMENTE a pagina principal do WhatsApp Web; nao recebe numero,
// mensagem, contatos ou comandos de envio. Compartilha a trava de perfil
// das campanhas supervisionadas para impedir uso simultaneo pelas portas.
export function iniciarConexaoWhatsapp({
  sourceDir,simulacaoWorker=false,criarProcesso=spawn,
  agora=()=>new Date(),
}={}) {
  const projeto=resolve(sourceDir,'../../..');
  const script=join(sourceDir,'whatsapp-conexao-worker.mts');
  const tsx=join(projeto,'node_modules','tsx','dist','cli.mjs');
  let ativo=null;
  let ultimo={fase:'inativo',mensagem:'Abra o WhatsApp Web para verificar a sessão.',
    atualizadoEm:null};

  function atualizar(fase,mensagem) {
    ultimo={fase,mensagem,atualizadoEm:agora().toISOString()};
  }
  function estado() {
    return {...ultimo,ocupado:Boolean(ativo),envioHabilitado:false};
  }
  function tratarEvento(ref,linha) {
    if(ativo!==ref)return;
    let ev;
    try{ev=JSON.parse(linha);}catch{return;}
    switch(ev.tipo){
      case 'ABRINDO':
        atualizar('abrindo','Iniciando o Chrome com o perfil das promoções.');
        break;
      case 'ABERTO':
      case 'AGUARDANDO':
        atualizar('aguardando','WhatsApp Web aberto. Aguarde a tela carregar.');
        break;
      case 'QR':
        atualizar('qr','QR Code disponível na janela do Chrome. Escaneie com o celular.');
        break;
      case 'CONECTADO':
        atualizar('conectado','Conversas carregadas! Clique em Encerrar conexão para liberar o perfil às campanhas.');
        break;
      case 'FECHADO':
        atualizar('encerrando','Fechando o Chrome e preservando a sessão local.');
        break;
      case 'INICIO_ERRO':
      case 'ERRO':
        atualizar('erro','Não foi possível abrir o WhatsApp Web. Confirme se o Chrome das promoções está fechado.');
        break;
    }
  }
  function abrir() {
    if(ativo)throw new Error('O WhatsApp Web já está aberto por este painel.');
    if(!existsSync(tsx) || !existsSync(script)) {
      throw new Error('Ferramentas do navegador não encontradas na instalação.');
    }
    const liberar=simulacaoWorker?()=>{}:adquirirSessaoWhatsapp(projeto);
    let processo;
    try{
      processo=criarProcesso(process.execPath,[tsx,script],{
        cwd:projeto,windowsHide:false,
        env:{...process.env,
          CPV_WHATSAPP_MOCK_TEST:simulacaoWorker?'true':'false',
          WHATSAPP_AUTO_SEND_ENABLED:'false'},
        stdio:['pipe','pipe','pipe'],
      });
    }catch{
      liberar();
      throw new Error('Falha ao abrir a janela do Chrome.');
    }
    const ref={processo,liberar};
    ativo=ref;
    atualizar('iniciando','Abrindo o WhatsApp Web sem realizar envios.');
    const leitor=createInterface({input:processo.stdout});
    leitor.on('line',linha=>tratarEvento(ref,linha));
    // Nunca expor o stderr bruto, que pode conter caminhos e dados do perfil.
    processo.stderr?.on('data',()=>{});
    processo.on('error',()=>{
      if(ativo===ref)atualizar('erro','O processo do Chrome não pôde iniciar.');
    });
    processo.on('close',()=>{
      if(ativo!==ref)return;
      ativo=null;
      ref.liberar();
      if(ultimo.fase==='encerrando' || ultimo.fase==='fechando'){
        atualizar('fechado','Janela encerrada. A sessão permanece salva no perfil do Chrome.');
      }else if(ultimo.fase!=='erro'){
        atualizar('fechado','Janela do WhatsApp fechada. A sessão permanece salva.');
      }
    });
    try{
      processo.stdin.write(JSON.stringify({tipo:'ABRIR'})+'\n');
    }catch{
      processo.kill();
      atualizar('erro','Não foi possível iniciar a página do WhatsApp Web.');
      throw new Error('Falha ao iniciar o navegador.');
    }
    return estado();
  }
  function fechar() {
    if(!ativo)throw new Error('Nenhuma janela de conexão aberta por este painel.');
    if(!ativo.processo.stdin?.writable){
      throw new Error('O Chrome já está encerrando. Aguarde alguns instantes.');
    }
    atualizar('fechando','Finalizando o Chrome para salvar e liberar a sessão.');
    ativo.processo.stdin.write(JSON.stringify({tipo:'FECHAR'})+'\n');
    return estado();
  }
  return {estado,abrir,fechar};
}
