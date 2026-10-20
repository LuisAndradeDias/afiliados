import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { contatoComConsentimento } from './contatos.mjs';
import {
  montarModeloMeta, montarConviteMeta, consultarModeloMeta,
  enviarConviteMeta, responderLinkMeta, validarTextoModelo,
} from './meta-cloud.mjs';

const MAX_CAMPANHAS = 100;
const MAX_CONTATOS = 1500;
const MAX_POR_LOTE = 20;
const LIMITE_MANUAL_DIARIO = 50;
const ESTADOS_FINAIS = new Set(['aceito','enviado','entregue','lido','falhou','incerto']);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const MENSAGEM_PADRAO = [
  '🎁 Convite Caça Promos VIP 👑',
  '',
  'Olá! Você autorizou receber novidades e convites do Caça Promos VIP.',
  'Temos um grupo gratuito com promoções, descontos e oportunidades selecionadas.',
  'Deseja conhecer nosso grupo de ofertas?',
  '',
  'A entrada é opcional. Para não receber novos convites, toque em Denunciar convite ou responda SAIR.',
].join('\n');

function validarUrlGrupo(valor) {
  if (valor === '' || valor === null || valor === undefined) return '';
  let url;
  try { url = new URL(String(valor)); }
  catch { throw new Error('Link do grupo invalido.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'chat.whatsapp.com' ||
      !/^\/[A-Za-z0-9]+$/.test(url.pathname) ||
      url.search || url.hash || url.username || url.password) {
    throw new Error('Informe um convite HTTPS de chat.whatsapp.com.');
  }
  return url.toString();
}

function modeloSeguro(valor) {
  const nome=String(valor || '').trim();
  if (!/^[a-z][a-z0-9_]{2,127}$/.test(nome)) throw new Error('Nome do modelo Meta invalido.');
  return nome;
}

function nomeSeguro(valor) {
  const nome=String(valor||'').trim();
  if (nome.length < 3 || nome.length > 80 || /[\x00-\x1f]/.test(nome)) {
    throw new Error('Nome da campanha deve ter entre 3 e 80 caracteres.');
  }
  return nome;
}

export function iniciarConvitesUnicos({
  dataDir, contatos, bloqueios, configMeta,
  grupoInicial='', agora=()=>new Date(), fetchImpl=globalThis.fetch,
  publicBaseUrl='',
}) {
  let origemPublica='';
  if (publicBaseUrl) {
    let destino;
    try{destino=new URL(String(publicBaseUrl));}
    catch{throw new Error('Configure um endereço público HTTPS válido para denúncias.');}
    if(destino.protocol!=='https:' || destino.username || destino.password ||
        destino.search || destino.hash || destino.pathname!=='/' ||
        destino.hostname==='localhost' || destino.hostname==='127.0.0.1') {
      throw new Error('O endereço de denúncias precisa ser uma origem HTTPS pública.');
    }
    origemPublica=destino.origin;
  }
  mkdirSync(dataDir,{recursive:true});
  const arquivoConfig=join(dataDir,'modelo-convite-unico.json');
  const arquivoFilas=join(dataDir,'filas-convites-meta.json');
  const arquivoRespostas=join(dataDir,'respostas-convites-meta.json');
  let loteEmExecucao=false;

  function lerArquivo(caminho, padrao) {
    try {
      const value=JSON.parse(readFileSync(caminho,'utf8'));
      if (value?.versao !== 1) throw new Error('Arquivo de configuracao incompativel.');
      return value;
    } catch (erro) {
      if (erro.code === 'ENOENT') return padrao;
      throw erro;
    }
  }
  function salvarArquivo(caminho,valor) {
    const tmp=caminho+'.'+process.pid+'.'+randomBytes(5).toString('hex')+'.tmp';
    writeFileSync(tmp,JSON.stringify(valor,null,2)+'\n',{mode:0o600,encoding:'utf8'});
    renameSync(tmp,caminho);
  }
  function configPadrao() {
    return {
      versao:1, mensagem:MENSAGEM_PADRAO,
      grupoUrl:validarUrlGrupo(grupoInicial),nomeModelo:'convite_ofertas_v1',
      modificadoEm:null,
    };
  }
  function configuracao() {
    const atual=lerArquivo(arquivoConfig,configPadrao());
    // Falhar com configuracoes corrompidas em vez de enviar modelo errado.
    montarModeloMeta({texto:atual.mensagem,nomeModelo:atual.nomeModelo});
    validarUrlGrupo(atual.grupoUrl);
    return atual;
  }
  function salvarConfiguracao({mensagem,grupoUrl,nomeModelo}) {
    const texto=validarTextoModelo(mensagem);
    const url=validarUrlGrupo(grupoUrl);
    const modelo=modeloSeguro(nomeModelo);
    montarModeloMeta({texto,nomeModelo:modelo});
    const cfg={versao:1,mensagem:texto,grupoUrl:url,
      nomeModelo:modelo,modificadoEm:agora().toISOString()};
    salvarArquivo(arquivoConfig,cfg);
    return cfg;
  }
  function templateParaMeta() {
    const cfg=configuracao();
    return montarModeloMeta({texto:cfg.mensagem,nomeModelo:cfg.nomeModelo});
  }

  function contatoMap() {return new Map(contatos.listar().map(c=>[c.id,c]));}
  function elegivel(c) {
    return contatoComConsentimento(c) && !bloqueios.estaBloqueado(c.telefone);
  }
  function pessoasElegiveis() {
    return contatos.listar().filter(elegivel).map(c=>({
      id:c.id,nome:c.nome || '',telefone:c.telefone,origem:c.origem,
    }));
  }

  function lerFilas() {
    const filas=lerArquivo(arquivoFilas,{versao:1,filas:[]});
    if (!Array.isArray(filas.filas)) throw new Error('Fila de convites invalida.');
    return filas;
  }
  function statusItem(item,c) {
    if (item.status !== 'pendente' && item.status !== 'aberto') return item.status;
    return elegivel(c) ? item.status : 'bloqueado';
  }
  function resumir(fila,mapa=contatoMap()) {
    const totais={pendentes:0,aceitos:0,enviados:0,entregues:0,lidos:0,
      bloqueados:0,falhas:0,incertos:0,abertos:0,manuais:0,ignorados:0};
    for (const item of fila.itens) {
      const st=statusItem(item,mapa.get(item.contatoId));
      if (st==='pendente') totais.pendentes++;
      else if (st==='aberto') totais.abertos++;
      else if (st==='enviado-manualmente') totais.manuais++;
      else if (st==='ignorado') totais.ignorados++;
      else if (st==='denunciado') {
        totais.bloqueados++;
        if (item.confirmadoEm) totais.manuais++;
      }
      else if (st==='bloqueado') totais.bloqueados++;
      else if (st==='aceito') totais.aceitos++;
      else if (st==='enviado') totais.enviados++;
      else if (st==='entregue') totais.entregues++;
      else if (st==='lido') totais.lidos++;
      else if (st==='falhou') totais.falhas++;
      else if (st==='incerto' || st==='processando') totais.incertos++;
    }
    return {id:fila.id,nome:fila.nome,modo:fila.modo||'meta',total:fila.itens.length,
      criadaEm:fila.criadaEm,modelo:fila.nomeModelo,...totais};
  }
  function listarFilas() {
    const mapa=contatoMap();
    return lerFilas().filas.map(f=>resumir(f,mapa));
  }
  function detalhesFila(id) {
    const fila=lerFilas().filas.find(f=>f.id===id);
    if (!fila) throw new Error('Campanha de convites nao encontrada.');
    const mapa=contatoMap();
    const itens=fila.itens.map(item=>{
      const c=mapa.get(item.contatoId);
      const numero=String(c?.telefone||'');
      return {
        contatoId:item.contatoId,nome:c ? (c.nome||'Contato sem nome') : 'Contato removido',
        telefoneMascarado:numero ? '+'+numero.slice(0,4)+' •••• '+numero.slice(-4) : '',
        status:statusItem(item,c),
        solicitadoEm:item.solicitadoEm||null,
        abertoEm:item.abertoEm||null,confirmadoEm:item.confirmadoEm||null,
      };
    });
    return {...resumir(fila,mapa),mensagem:fila.mensagem,itens};
  }

  function criarFila({nome,contatoIds,modo='meta'}) {
    if (!['meta','web'].includes(modo))throw new Error('Modo de convite inválido.');
    const titulo=nomeSeguro(nome);
    if (!Array.isArray(contatoIds) || contatoIds.length<1 ||
        contatoIds.length>MAX_CONTATOS || new Set(contatoIds).size!==contatoIds.length) {
      throw new Error('Escolha de 1 a 1.500 contatos autorizados, sem duplicacao.');
    }
    if (contatoIds.some(id=>typeof id!=='string'||!UUID.test(id))) {
      throw new Error('Identificador de contato invalido.');
    }
    const mapa=contatoMap();
    if (contatoIds.some(id=>!elegivel(mapa.get(id)))) {
      throw new Error('Fila contem contatos sem autorizacao atual para convites.');
    }
    const cfg=configuracao();
    if (!cfg.grupoUrl) throw new Error('Salve o link do grupo antes de criar a fila.');
    const dados=lerFilas();
    if (modo==='web') {
      const jaConvidados=convidadosManual(dados);
      if (contatoIds.some(id=>jaConvidados.has(id))) {
        throw new Error('O contato já possui convite manual confirmado em outra campanha.');
      }
    }
    if (dados.filas.length>=MAX_CAMPANHAS) {
      throw new Error('Limite de campanhas atingido.');
    }
    const fila={
      id:randomUUID(),nome:titulo,modo,criadaEm:agora().toISOString(),
      nomeModelo:cfg.nomeModelo,mensagem:cfg.mensagem,grupoUrl:cfg.grupoUrl,
      itens:contatoIds.map(id=>({contatoId:id,status:'pendente',
        solicitadoEm:null,mensagemId:null})),
    };
    dados.filas.unshift(fila);
    salvarArquivo(arquivoFilas,dados);
    return resumir(fila,mapa);
  }

  // Remover filas nunca apaga um envio ou tentativa; o backup integral
  // permite reconstruir o estado anterior sem publicar dados privados.
  function conferirFilaLimpavel(fila) {
    const permitidos=new Set(['pendente','aberto','cancelado','ignorado','bloqueado']);
    if (fila.itens.some(i=>
      !permitidos.has(i.status) || i.solicitadoEm || i.mensagemId ||
      i.confirmadoEm || i.tentativaEm)) {
      throw new Error('A fila tem tentativas ou envios registrados. Confira o histórico antes de limpar.');
    }
  }
  function arquivarFilasAntesDeLimpar(dados) {
    const historico=join(dataDir,'backups-privados');
    mkdirSync(historico,{recursive:true});
    const carimbo=agora().toISOString().replace(/[^0-9A-Za-z]/g,'-');
    const backup=join(historico,'filas-arquivadas-'+carimbo+'-'+
      randomBytes(4).toString('hex')+'.json');
    salvarArquivo(backup,dados);
  }
  function limparFilasPendentes({confirmado=false}={}) {
    if (confirmado!==true) throw new Error('Confirme a limpeza de filas.');
    if (loteEmExecucao) throw new Error('Aguarde o envio em andamento terminar.');
    const dados=lerFilas();
    if (!dados.filas.length) return {limpas:0,backupCriado:false};
    dados.filas.forEach(conferirFilaLimpavel);
    arquivarFilasAntesDeLimpar(dados);
    salvarArquivo(arquivoFilas,{versao:1,filas:[]});
    return {limpas:dados.filas.length,backupCriado:true};
  }
  function limparFilaSelecionada({campanhaId,confirmado=false}={}) {
    if (confirmado!==true) throw new Error('Confirme a limpeza desta fila.');
    if (!UUID.test(String(campanhaId||''))) throw new Error('Fila inválida.');
    if (loteEmExecucao) throw new Error('Aguarde o envio em andamento terminar.');
    const dados=lerFilas();
    const fila=dados.filas.find(item=>item.id===campanhaId);
    if (!fila) throw new Error('Esta fila não existe mais. Atualize a lista.');
    conferirFilaLimpavel(fila);
    arquivarFilasAntesDeLimpar(dados);
    dados.filas=dados.filas.filter(item=>item.id!==campanhaId);
    salvarArquivo(arquivoFilas,dados);
    return {limpas:1,backupCriado:true};
  }

  // Converte uma fila Meta ainda intocada para o WhatsApp Web, sem criar
  // novos contatos, perder seu ID/historico nem disparar mensagens.
  function converterFilaParaWeb({campanhaId,confirmado=false}={}) {
    if (confirmado!==true) {
      throw new Error('Confirme a conversao para WhatsApp Web no painel.');
    }
    if (!UUID.test(String(campanhaId||''))) throw new Error('Fila invalida.');
    if (loteEmExecucao) throw new Error('Aguarde a operacao atual finalizar.');
    const dados=lerFilas();
    const fila=dados.filas.find(f=>f.id===campanhaId);
    if (!fila || (fila.modo||'meta')!=='meta') {
      throw new Error('A fila oficial indicada nao esta disponivel para conversao.');
    }
    if (!fila.itens.length || fila.itens.some(i=>i.status!=='pendente' ||
        i.solicitadoEm || i.mensagemId || i.abertoEm)) {
      throw new Error('Somente filas oficiais sem qualquer tentativa de envio podem ser convertidas.');
    }
    const mapa=contatoMap();
    if (fila.itens.some(i=>!elegivel(mapa.get(i.contatoId)))) {
      throw new Error('A fila contem contatos bloqueados ou sem autorizacao atual.');
    }
    const outrasWeb=dados.filas.filter(f=>f.id!==fila.id && f.modo==='web');
    const jaNaFila=new Set(outrasWeb.flatMap(f=>f.itens
      .filter(i=>!['ignorado','bloqueado','cancelado'].includes(i.status))
      .map(i=>i.contatoId)));
    if (fila.itens.some(i=>jaNaFila.has(i.contatoId)) ||
        fila.itens.some(i=>convidadosManual(dados).has(i.contatoId))) {
      throw new Error('Um dos contatos ja possui outro convite ou fila Web ativa.');
    }
    fila.modo='web';
    fila.conversao={origem:'meta',convertidaEm:agora().toISOString(),
      autorizadaPeloOperador:true};
    salvarArquivo(arquivoFilas,dados);
    return resumir(fila,mapa);
  }

  // Modo GRATUITO: usa somente o recurso oficial de abrir uma conversa
  // com texto pre-preenchido. O operador envia manualmente no WhatsApp Web.
  // Nenhum script acessa a sessao do WhatsApp e nao existe disparo automatico.
  function textoManual(fila,contato) {
    const alternativa=origemPublica?'use o link Denunciar mensagem':'responda DENUNCIAR';
    const corpo=String(fila.mensagem||'')
      .replace(/toque em Denunciar convite/gi,alternativa)
      .replace(/clique em Denunciar convite/gi,alternativa)
      .trim();
    const instrucoes=origemPublica
      ? '\n\n🚩 Denunciar mensagem (registro interno, não é denúncia ao WhatsApp):\n'+
        origemPublica+'/denunciar?token='+bloqueios.tokenDenuncia(contato)
      : '';
    return corpo+'\n\n🔗 Entrar no grupo de ofertas:\n'+fila.grupoUrl+
      instrucoes+'\n\n🚫 Para parar de receber ou denunciar, '+
      'responda SAIR ou DENUNCIAR nesta conversa.';
  }

  function localizarManual(campanhaId,contatoId) {
    if (!UUID.test(String(campanhaId||'')) ||
        !UUID.test(String(contatoId||''))) throw new Error('Identificador inválido.');
    const dados=lerFilas();
    const fila=dados.filas.find(f=>f.id===campanhaId);
    if (!fila || fila.modo!=='web') throw new Error('Fila do WhatsApp Web não encontrada.');
    const item=fila.itens.find(i=>i.contatoId===contatoId);
    if (!item) throw new Error('Contato não pertence à fila.');
    const contato=contatoMap().get(contatoId);
    if (!elegivel(contato))throw new Error('Contato bloqueado ou sem opt-in atual.');
    return {dados,fila,item,contato};
  }

  function convidadosManual(dados) {
    return new Set(dados.filas.flatMap(f=>
      f.itens.filter(i=>f.modo==='web'
        ? i.status==='enviado-manualmente'
        : ['aceito','enviado','entregue','lido'].includes(i.status))
        .map(i=>i.contatoId)));
  }

  function diaOperacional(valor) {
    const partes=new Intl.DateTimeFormat('en-US',{
      timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',
    }).formatToParts(new Date(valor));
    const dict=Object.fromEntries(partes.map(p=>[p.type,p.value]));
    return dict.year+'-'+dict.month+'-'+dict.day;
  }

  function estatisticasManual(dados=lerFilas()) {
    const hoje=diaOperacional(agora());
    const itens=dados.filas.filter(f=>f.modo==='web').flatMap(f=>f.itens);
    const confirmadosHoje=itens.filter(i=>i.confirmadoEm &&
      diaOperacional(i.confirmadoEm)===hoje).length;
    const iniciadosHoje=itens.filter(i=>i.abertoEm &&
      diaOperacional(i.abertoEm)===hoje).length;
    return {limiteDiario:LIMITE_MANUAL_DIARIO,confirmadosHoje,iniciadosHoje,
      restantesHoje:Math.max(0,LIMITE_MANUAL_DIARIO-
        Math.max(confirmadosHoje,iniciadosHoje)),simultaneos:1,
      automatico:false,denunciaPorCliqueConfigurada:Boolean(origemPublica)};
  }

  function prepararManual({campanhaId,contatoId}) {
    const {dados,fila,item,contato}=localizarManual(campanhaId,contatoId);
    if (convidadosManual(dados).has(contatoId)) {
      throw new Error('Este contato já tem convite manual confirmado.');
    }
    if (!['pendente','aberto'].includes(item.status)) {
      throw new Error('Contato já foi tratado nesta campanha.');
    }
    const outroAberto=dados.filas.filter(f=>f.modo==='web').flatMap(f=>f.itens)
      .some(i=>i.status==='aberto' && i!==item);
    if (outroAberto) {
      throw new Error('Finalize ou ignore o contato com a conversa já preparada.');
    }
    if (item.status==='pendente') {
      if (estatisticasManual(dados).restantesHoje<=0) {
        throw new Error('Limite interno de 50 conversas preparadas hoje atingido.');
      }
      item.status='aberto';
      item.abertoEm=agora().toISOString();
      salvarArquivo(arquivoFilas,dados);
    }
    const mensagem=textoManual(fila,contato);
    return {nome:contato.nome||'',numeroMascarado:'+'+
      contato.telefone.slice(0,4)+' •••• '+contato.telefone.slice(-4),
      mensagem, url:'https://wa.me/'+contato.telefone+
        '?text='+encodeURIComponent(mensagem),
      aviso:'A conversa será aberta com o texto pronto. Você precisa conferir e enviar manualmente.'};
  }

  function validarEnvioManual({campanhaId,contatoId}) {
    const {dados,item}=localizarManual(campanhaId,contatoId);
    if(item.status!=='aberto')throw new Error('A conversa não está em preparação.');
    if(convidadosManual(dados).has(contatoId)) {
      throw new Error('O contato já recebeu convite confirmado.');
    }
    if(estatisticasManual(dados).confirmadosHoje>=LIMITE_MANUAL_DIARIO) {
      throw new Error('Limite diário de 50 envios confirmados atingido.');
    }
    return true;
  }

  function marcarTentativaIncerta({campanhaId,contatoId}) {
    if(!UUID.test(String(campanhaId||'')) ||
        !UUID.test(String(contatoId||'')))throw new Error('Identificadores inválidos.');
    const dados=lerFilas();
    const fila=dados.filas.find(f=>f.id===campanhaId && f.modo==='web');
    const item=fila?.itens.find(i=>i.contatoId===contatoId);
    if(!item)throw new Error('Contato não encontrado na fila supervisionada.');
    if(item.status==='aberto') {
      item.status='incerto';
      item.solicitadoEm=agora().toISOString();
      salvarArquivo(arquivoFilas,dados);
    }
    return {status:item.status};
  }

  // O controlador reserva a tentativa ANTES de solicitar o clique ao Chrome.
  // Depois de uma falha, incerto impede a abertura de outra conversa ou retry.
  function confirmarTentativaWorker({campanhaId,contatoId}) {
    const {dados,item}=localizarManual(campanhaId,contatoId);
    if (item.status!=='incerto') throw new Error('Tentativa não está aguardando verificação.');
    if (convidadosManual(dados).has(contatoId)) {
      throw new Error('Convite já confirmado em outra fila.');
    }
    item.status='enviado-manualmente';
    item.confirmadoEm=agora().toISOString();
    item.tratadoEm=item.confirmadoEm;
    salvarArquivo(arquivoFilas,dados);
    return {status:item.status,confirmadoEm:item.confirmadoEm};
  }

  // Só corrige uma tentativa incerta depois de uma conferência humana real.
  function conciliarTentativa({campanhaId,contatoId,resultado,confirmado=false}) {
    if (confirmado!==true ||
        !['enviado','nao-enviado'].includes(resultado)) {
      throw new Error('Confira a conversa e confirme o resultado manualmente.');
    }
    if (!UUID.test(String(campanhaId||'')) ||
        !UUID.test(String(contatoId||''))) throw new Error('Identificadores inválidos.');
    const dados=lerFilas();
    const fila=dados.filas.find(f=>f.id===campanhaId && f.modo==='web');
    const item=fila?.itens.find(i=>i.contatoId===contatoId);
    if (!item || item.status!=='incerto') {
      throw new Error('Não há tentativa incerta para conciliar.');
    }
    if (resultado==='enviado') {
      if (convidadosManual(dados).has(contatoId)) {
        throw new Error('Convite já confirmado anteriormente.');
      }
      item.status='enviado-manualmente';
      item.confirmadoEm=agora().toISOString();
    } else {
      // Não libera diretamente o próximo disparo: apenas retorna à fila.
      // O contato ainda precisa de opt-in válido e deve passar pelo limite diário.
      item.status='pendente';
    }
    item.conciliadoEm=agora().toISOString();
    item.tratadoEm=item.conciliadoEm;
    salvarArquivo(arquivoFilas,dados);
    return {status:item.status,conciliadoEm:item.conciliadoEm};
  }

  function marcarManual({campanhaId,contatoId,acao,confirmado=false}) {
    if (!['enviado','ignorado','denunciado','cancelado'].includes(acao)) {
      throw new Error('Ação manual inválida.');
    }
    const {dados,item,contato}=localizarManual(campanhaId,contatoId);
    if (item.status!=='aberto' &&
        !(acao==='denunciado' && item.status==='enviado-manualmente')) {
      throw new Error('Prepare primeiro a conversa deste contato.');
    }
    if (acao==='enviado' && confirmado!==true) {
      throw new Error('Confirme que enviou manualmente a mensagem no WhatsApp.');
    }
    if (acao==='enviado' && convidadosManual(dados).has(contatoId)) {
      throw new Error('Este número já recebeu convite manual confirmado.');
    }
    const quando=agora().toISOString();
    if (acao==='denunciado') {
      bloqueios.registrar({telefone:contato.telefone,
        mensagemId:'operador-'+randomUUID(),motivo:'denuncia-convite',
        origem:'registro-manual-apos-resposta'});
      item.status='denunciado';
    } else if (acao==='enviado') {
      if (estatisticasManual(dados).confirmadosHoje>=LIMITE_MANUAL_DIARIO) {
        throw new Error('Limite interno de 50 confirmações hoje atingido.');
      }
      item.status='enviado-manualmente';
      item.confirmadoEm=quando;
    } else if (acao==='ignorado') {
      item.status='ignorado';
    } else {
      item.status='pendente';
    }
    item.tratadoEm=quando;
    salvarArquivo(arquivoFilas,dados);
    return {status:item.status,quando};
  }

  function simular({contatoIds=[]}={}) {
    if (!Array.isArray(contatoIds) || contatoIds.length>MAX_CONTATOS) {
      throw new Error('Quantidade invalida para simulacao.');
    }
    const mapa=contatoMap();
    const distintas=[...new Set(contatoIds)];
    const aptas=distintas.filter(id=>elegivel(mapa.get(id)));
    const bloqueadas=distintas.length-aptas.length;
    const cfg=configuracao();
    return {
      modo:'SIMULACAO',enviadas:0,preparadas:aptas.length,
      bloqueadas,mensagem:cfg.mensagem,
      botoes:['Entrar no grupo','Denunciar convite'],
      grupoConfigurado:Boolean(cfg.grupoUrl),
      amostra:aptas.slice(0,5).map(id=>{
        const c=mapa.get(id);
        return {nome:c.nome||'',telefoneMascarado:'+'+c.telefone.slice(0,4)+' •••• '+c.telefone.slice(-4)};
      }),
    };
  }

  async function conferirModelo(fila=null) {
    if (!configMeta.configuracaoValida) {
      return {aprovado:false,encontrado:false,status:'SEM_CREDENCIAIS',
        textoIdentico:false};
    }
    const cfg=fila || configuracao();
    if (cfg.nomeModelo !== configMeta.template) {
      return {aprovado:false,encontrado:false,status:'NOME_DIVERGENTE',
        textoIdentico:false};
    }
    return consultarModeloMeta(configMeta,{
      nomeModelo:cfg.nomeModelo,texto:cfg.mensagem,
    },fetchImpl);
  }

  async function processarLote({campanhaId,limite=10,confirmar=false}) {
    if (confirmar!==true || !configMeta.configuracaoValida || !configMeta.habilitado) {
      throw new Error('Envio real indisponivel. Configure a Meta e confirme o lote.');
    }
    if (!UUID.test(String(campanhaId||'')) ||
        !Number.isInteger(limite) || limite<1 || limite>MAX_POR_LOTE) {
      throw new Error('Campanha ou limite de lote invalido.');
    }
    if (loteEmExecucao) throw new Error('Ja existe um lote em processamento.');
    loteEmExecucao=true;
    try {
      const dados=lerFilas();
      const fila=dados.filas.find(f=>f.id===campanhaId);
      if (!fila) throw new Error('Campanha de convites nao encontrada.');
      if (fila.modo==='web') throw new Error('Esta campanha exige envio manual no WhatsApp Web.');
      const statusModelo=await conferirModelo(fila);
      if (!statusModelo.aprovado) {
        throw new Error('Modelo nao aprovado ou texto/botoes divergentes na Meta.');
      }
      const hoje=agora().toISOString().slice(0,10);
      const enviadosHoje=dados.filas.flatMap(f=>f.itens).filter(i=>
        i.solicitadoEm?.startsWith(hoje)).length;
      const orcamento=Number(configMeta.maximoDiario||50);
      if (enviadosHoje>=orcamento) throw new Error('Limite diario de envios atingido.');
      const mapa=contatoMap();
      const disponiveis=fila.itens.filter(item=>
        item.status==='pendente' && elegivel(mapa.get(item.contatoId)))
        .slice(0,Math.min(limite,MAX_POR_LOTE,orcamento-enviadosHoje));
      const resultado={aceitos:0,incertos:0,bloqueados:0,tentados:0};
      for (const item of disponiveis) {
        const contato=contatoMap().get(item.contatoId);
        if (!elegivel(contato)) {resultado.bloqueados++;continue;}
        // Rele a base antes e depois da chamada de rede, para nao sobrescrever
        // eventos de status chegados pelo webhook enquanto o fetch aguardava.
        const atual=lerFilas();
        const atualItem=atual.filas.find(f=>f.id===campanhaId)?.itens
          .find(i=>i.contatoId===item.contatoId);
        if (!atualItem || atualItem.status!=='pendente') continue;
        atualItem.status='processando';
        atualItem.solicitadoEm=agora().toISOString();
        salvarArquivo(arquivoFilas,atual);
        resultado.tentados++;
        let idMensagem=null;
        try {
          const aceito=await enviarConviteMeta(configMeta,{
            para:contato.telefone,template:fila.nomeModelo,
          },fetchImpl);
          idMensagem=aceito.mensagemId;
          resultado.aceitos++;
        } catch {
          resultado.incertos++;
        }
        const recente=lerFilas();
        const persistido=recente.filas.find(f=>f.id===campanhaId)?.itens
          .find(i=>i.contatoId===item.contatoId);
        if (persistido?.status==='processando') {
          persistido.status=idMensagem?'aceito':'incerto';
          persistido.mensagemId=idMensagem;
          salvarArquivo(arquivoFilas,recente);
        }
      }
      return {...resultado,restantes:detalhesFila(campanhaId).pendentes};
    } finally { loteEmExecucao=false; }
  }

  function registrarStatus({mensagemId,status}) {
    const dados=lerFilas();
    let mudou=false;
    const equivalencia={sent:'enviado',delivered:'entregue',read:'lido',failed:'falhou'};
    const novo=equivalencia[status];
    if (!novo || typeof mensagemId!=='string') return false;
    const ranking={aceito:0,enviado:1,entregue:2,lido:3,incerto:-1,processando:-1};
    for (const fila of dados.filas) {
      const item=fila.itens.find(i=>i.mensagemId===mensagemId);
      if (!item) continue;
      if (item.status==='lido' || (item.status==='entregue' && novo==='enviado'))return false;
      if (novo==='falhou' && ['entregue','lido'].includes(item.status))return false;
      if (item.status!==novo &&
          (novo==='falhou' || (ranking[novo]||0)>(ranking[item.status]??-1))) {
        item.status=novo;mudou=true;
      }
      break;
    }
    if (mudou)salvarArquivo(arquivoFilas,dados);
    return mudou;
  }

  async function processarCliqueEntrar({telefone,mensagemId}) {
    const id=String(mensagemId||'');
    if (id.length<4||id.length>255)throw new Error('Evento invalido.');
    const hash=createHash('sha256').update(id).digest('hex');
    const dados=lerArquivo(arquivoRespostas,{versao:1,cliques:[]});
    if (!Array.isArray(dados.cliques))throw new Error('Historico de cliques invalido.');
    if (dados.cliques.some(c=>c.hash===hash))return {duplicada:true};
    const usuario=contatos.listar().find(c=>c.telefone===telefone);
    if (!elegivel(usuario))return {respondido:false,bloqueado:true};
    const cfg=configuracao();
    if (!cfg.grupoUrl || !configMeta.configuracaoValida || !configMeta.habilitado) {
      return {respondido:false,pendente:true};
    }
    dados.cliques.push({hash,estado:'tentando',em:agora().toISOString()});
    if (dados.cliques.length>10000)dados.cliques.shift();
    salvarArquivo(arquivoRespostas,dados);
    function atualizarResposta(estado) {
      const recente=lerArquivo(arquivoRespostas,{versao:1,cliques:[]});
      const registro=recente.cliques.find(x=>x.hash===hash);
      if (registro) {
        registro.estado=estado;
        salvarArquivo(arquivoRespostas,recente);
      }
    }
    try {
      await responderLinkMeta(configMeta,{para:telefone,urlGrupo:cfg.grupoUrl},fetchImpl);
      atualizarResposta('respondido');
      return {respondido:true};
    } catch {
      atualizarResposta('incerto');
      return {respondido:false,incerto:true};
    }
  }

  return {
    configuracao,salvarConfiguracao,templateParaMeta,pessoasElegiveis,
    listarFilas,detalhesFila,criarFila,converterFilaParaWeb,
    limparFilasPendentes,limparFilaSelecionada,simular,conferirModelo,
    processarLote,registrarStatus,processarCliqueEntrar,
    estatisticasManual,prepararManual,marcarManual,validarEnvioManual,
    marcarTentativaIncerta,confirmarTentativaWorker,conciliarTentativa,
  };
}
