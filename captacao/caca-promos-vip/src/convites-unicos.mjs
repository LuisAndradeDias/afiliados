import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
  montarModeloMeta, montarConviteMeta, consultarModeloMeta,
  enviarConviteMeta, responderLinkMeta, validarTextoModelo,
} from './meta-cloud.mjs';

const MAX_CAMPANHAS = 100;
const MAX_CONTATOS = 1500;
const MAX_POR_LOTE = 20;
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
}) {
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
    return Boolean(c && c.status==='ativo' && c.consentimentoConfirmadoEm &&
      c.evidencia==='checkbox-e-mensagem-iniciada-pelo-titular' &&
      !c.descadastroEm && !bloqueios.estaBloqueado(c.telefone));
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
    if (item.status !== 'pendente') return item.status;
    return elegivel(c) ? 'pendente' : 'bloqueado';
  }
  function resumir(fila,mapa=contatoMap()) {
    const totais={pendentes:0,aceitos:0,enviados:0,entregues:0,lidos:0,
      bloqueados:0,falhas:0,incertos:0};
    for (const item of fila.itens) {
      const st=statusItem(item,mapa.get(item.contatoId));
      if (st==='pendente') totais.pendentes++;
      else if (st==='bloqueado') totais.bloqueados++;
      else if (st==='aceito') totais.aceitos++;
      else if (st==='enviado') totais.enviados++;
      else if (st==='entregue') totais.entregues++;
      else if (st==='lido') totais.lidos++;
      else if (st==='falhou') totais.falhas++;
      else if (st==='incerto' || st==='processando') totais.incertos++;
    }
    return {id:fila.id,nome:fila.nome,total:fila.itens.length,
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
        contatoId:item.contatoId,nome:c?.nome||'Contato indisponivel',
        telefoneMascarado:numero ? '+'+numero.slice(0,4)+' •••• '+numero.slice(-4) : '',
        status:statusItem(item,c),
        solicitadoEm:item.solicitadoEm||null,
      };
    });
    return {...resumir(fila,mapa),mensagem:fila.mensagem,itens};
  }

  function criarFila({nome,contatoIds}) {
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
    if (dados.filas.length>=MAX_CAMPANHAS) {
      throw new Error('Limite de campanhas atingido.');
    }
    const fila={
      id:randomUUID(),nome:titulo,criadaEm:agora().toISOString(),
      nomeModelo:cfg.nomeModelo,mensagem:cfg.mensagem,grupoUrl:cfg.grupoUrl,
      itens:contatoIds.map(id=>({contatoId:id,status:'pendente',
        solicitadoEm:null,mensagemId:null})),
    };
    dados.filas.unshift(fila);
    salvarArquivo(arquivoFilas,dados);
    return resumir(fila,mapa);
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
    listarFilas,detalhesFila,criarFila,simular,conferirModelo,
    processarLote,registrarStatus,processarCliqueEntrar,
  };
}
