import {contatoComConsentimento,EVIDENCIA_IMPORTADA,
  validarNovaAutorizacao} from './contatos.mjs';

const FILTROS=new Set(['todos','autorizado','bloqueado','descadastrado','pendente','sem-autorizacao']);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function nomeSeguro(c){
  return String(c.nome||'').trim().slice(0,80)||'Contato sem nome';
}
function numeroMascarado(telefone){
  const t=String(telefone||'').replace(/\D/g,'');
  return t.length>=12
    ? '+55 ('+t.slice(2,4)+') •••••-'+t.slice(-4)
    : 'Número indisponível';
}
function motivoBloqueio(motivo){
  if(motivo==='denuncia-convite')return 'Denúncia interna confirmada';
  if(motivo==='saida-solicitada')return 'Pedido de saída';
  if(motivo==='bloqueio-administrativo')return 'Bloqueio administrativo';
  return 'Bloqueio registrado';
}
function statusEfetivo(c,b){
  if(b)return 'bloqueado';
  if(c.status==='descadastrado'||c.descadastroEm)return 'descadastrado';
  if(contatoComConsentimento(c))return 'autorizado';
  if(c.status==='pendente')return 'pendente';
  return 'sem-autorizacao';
}
function apresentar(c,b) {
  const status=statusEfetivo(c,b);
  return {
    id:c.id,
    nome:nomeSeguro(c),
    telefoneMascarado:numeroMascarado(c.telefone),
    ultimosDigitos:String(c.telefone||'').slice(-4),
    status,
    origem:String(c.origem||'').slice(0,90)||'Não informada',
    consentimentoEm:c.consentimentoConfirmadoEm||null,
    descadastroEm:c.descadastroEm||null,
    reativadoEm:c.reativadoEm||null,
    ultimoEnvioManualEm:c.ultimoEnvioManualEm||null,
    bloqueioEm:b?.primeiroBloqueioEm||null,
    motivoBloqueio:b?motivoBloqueio(b.motivo):null,
    evidencia:c.evidencia===EVIDENCIA_IMPORTADA
      ? 'Autorização declarada pelo responsável'
      : c.evidencia==='checkbox-e-mensagem-iniciada-pelo-titular'
        ? 'Confirmado pelo próprio contato'
        : 'Sem confirmação válida',
    registroAutorizacao:c.registroAutorizacao?{
      origem:String(c.registroAutorizacao.origem||'').slice(0,140),
      dataAutorizacao:c.registroAutorizacao.dataAutorizacao||null,
      referencia:String(c.registroAutorizacao.referencia||'').slice(0,240),
    }:null,
  };
}

export function iniciarGestaoContatos({
  contatos,denuncias,convitesUnicos,campanhas,sincronizacaoNetlify,
  controleWhatsapp,conexaoWhatsapp,agora=()=>new Date(),
}){
  function dados(){
    const todos=contatos.listar();
    const bloqueados=denuncias.bloqueiosPorContato(todos);
    const linhas=todos.map(c=>({
      ...apresentar(c,bloqueados.get(c.id)),_numeroIndex:String(c.telefone||''),
    }));
    const resumo={total:linhas.length,autorizado:0,bloqueado:0,
      descadastrado:0,pendente:0,'sem-autorizacao':0,
      bloqueiosPersistentes:denuncias.resumo().bloqueados,
      denuncias:denuncias.resumo().denuncias};
    for(const item of linhas)resumo[item.status]++;
    return {linhas,resumo};
  }
  function listar({filtro='todos',busca='',pagina=1,limite=15}={}){
    const status=String(filtro||'todos');
    if(!FILTROS.has(status))throw new Error('Filtro de contatos inválido.');
    const termo=String(busca||'').trim().slice(0,90).toLocaleLowerCase('pt-BR');
    const numerico=termo.replace(/\D/g,'');
    const page=Number(pagina),take=Number(limite);
    if(!Number.isSafeInteger(page)||page<1||page>100000 ||
       !Number.isSafeInteger(take)||take<1||take>50)
      throw new Error('Paginação inválida.');
    const {linhas,resumo}=dados();
    const filtradas=linhas.filter(c=>(status==='todos'||c.status===status) &&
      (!termo||c.nome.toLocaleLowerCase('pt-BR').includes(termo)||
        c.origem.toLocaleLowerCase('pt-BR').includes(termo)||
        (numerico.length>=3 && (numerico.length<=4
          ?c._numeroIndex.endsWith(numerico)
          :c._numeroIndex.includes(numerico)))));
    const paginas=Math.max(1,Math.ceil(filtradas.length/take));
    const actual=Math.min(page,paginas);
    return {resumo,filtro:status,busca:termo,pagina:actual,limite:take,
      paginas,totalFiltrado:filtradas.length,
      contatos:filtradas.slice((actual-1)*take,actual*take).map(
        ({_numeroIndex,...publico})=>publico)};
  }
  function detalhe(id){
    if(!UUID.test(String(id||'')))throw new Error('Contato inválido.');
    const {linhas}=dados();
    const contato=linhas.find(c=>c.id===id);
    if(!contato)throw new Error('Contato não encontrado.');
    const eventos=denuncias.listar().filter(e=>e.contatoId===id).slice(0,8)
      .map(e=>({motivo:e.motivo,origem:e.origem,recebidoEm:e.recebidoEm}));
    const {_numeroIndex,...publico}=contato;
    return {...publico,eventos};
  }
  function bloquear({id,confirmado=false}={}){
    if(confirmado!==true)throw new Error('Confirme o bloqueio do contato.');
    if(!UUID.test(String(id||'')))throw new Error('Contato inválido.');
    const c=contatos.listar().find(item=>item.id===id);
    if(!c)throw new Error('Contato não encontrado.');
    if(denuncias.estaBloqueado(c.telefone))return {jaBloqueado:true,bloqueado:true};
    // Bloqueio administrativo não pode parecer denúncia feita pelo destinatário.
    denuncias.registrar({
      telefone:c.telefone,mensagemId:'bloqueio-administrativo-'+id+'-'+Date.now(),
      motivo:'bloqueio-administrativo',origem:'painel-local-gestao-contatos',
    });
    return {bloqueado:true,jaBloqueado:false};
  }
  async function desbloquear({
    id,confirmado=false,novaAutorizacao=false,origemAutorizacao,
    referenciaAutorizacao,dataAutorizacao,
  }={}){
    if(confirmado!==true||novaAutorizacao!==true)
      throw new Error('É necessário confirmar a nova autorização do titular.');
    if(!UUID.test(String(id||'')))throw new Error('Contato inválido.');
    let c=contatos.listar().find(item=>item.id===id);
    if(!c)throw new Error('Contato não encontrado.');
    let bloqueio=denuncias.bloqueiosPorContato([c]).get(id);
    if(!bloqueio)throw new Error('Este contato não está bloqueado.');
    if(c.status!=='descadastrado'||!c.descadastroEm)
      throw new Error('O cadastro não está descadastrado. Revise antes de liberar.');
    let prova=validarNovaAutorizacao({origemAutorizacao,
      referenciaAutorizacao,dataAutorizacao,
      bloqueadoEm:bloqueio.primeiroBloqueioEm,agora});
    // Pendências de opt-out/denúncia no Netlify nunca podem ser apagadas
    // por uma liberação local sem primeiro serem importadas.
    if(sincronizacaoNetlify?.estado().configurada){
      const res=await sincronizacaoNetlify.sincronizar();
      if(!res.ok||res.novas>=50){
        throw new Error('Não foi possível conferir todos os pedidos do Netlify. Sincronize novamente antes de desbloquear.');
      }
    }
    const worker=controleWhatsapp?.estado();
    if(worker?.ocupado||worker?.processoAtivo||conexaoWhatsapp?.estado().ocupado)
      throw new Error('Aguarde a conclusão da sessão do WhatsApp antes de desbloquear.');
    c=contatos.listar().find(item=>item.id===id);
    bloqueio=denuncias.bloqueiosPorContato([c]).get(id);
    if(!bloqueio||c.status!=='descadastrado')
      throw new Error('Situação do contato mudou. Atualize e tente novamente.');
    prova=validarNovaAutorizacao({origemAutorizacao,
      referenciaAutorizacao,dataAutorizacao,
      bloqueadoEm:bloqueio.primeiroBloqueioEm,agora});
    // Fecha somente pendências SEM tentativas, para nunca ressuscitar
    // convites antigos com a nova permissão.
    const antigasWeb=convitesUnicos?.encerrarPendenciasContato(id).encerrados||0;
    const antigasCrm=campanhas?.encerrarPendenciasContato(id).encerrados||0;
    const ativado=contatos.reativarComNovaAutorizacao({id,
      origemAutorizacao:prova.origem,
      referenciaAutorizacao:prova.referencia,
      dataAutorizacao:prova.dataAutorizacao,
      bloqueadoEm:bloqueio.primeiroBloqueioEm});
    const liberacao=denuncias.liberarComNovaAutorizacao({
      telefone:c.telefone,contatoId:id,
    });
    return {desbloqueado:true,reativadoEm:ativado.reativadoEm,
      filasAnterioresEncerradas:antigasWeb+antigasCrm,
      liberadoEm:liberacao.liberadoEm};
  }
  return {listar,detalhe,bloquear,desbloquear,resumo:()=>dados().resumo};
}
