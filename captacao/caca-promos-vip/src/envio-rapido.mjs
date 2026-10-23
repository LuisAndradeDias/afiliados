import {contatoComConsentimento,telefoneBrasil} from './contatos.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mascarar=n=>'+55 ('+n.slice(2,4)+') •••••-'+n.slice(-4);

export function iniciarEnvioRapido({contatos,denuncias,gestaoContatos,convites,agora=()=>new Date()}){
  function consultar({telefone}={}){
    const numero=telefoneBrasil(telefone);
    if(!numero)throw new Error('Digite um número brasileiro com DDD. Ex.: (31) 99999-9999.');
    const c=contatos.listar().find(p=>p.telefone===numero);
    if(!c)return {situacao:'novo',telefoneMascarado:mascarar(numero),
      mensagem:'Este número ainda não consta no cadastro.'};
    const bloqueado=denuncias.estaBloqueado(numero);
    const situacao=bloqueado?'bloqueado'
      :(c.status==='descadastrado'||c.descadastroEm?'descadastrado'
      :contatoComConsentimento(c)?'autorizado':'pendente');
    const textos={
      bloqueado:'O contato pediu para não receber convites ou foi bloqueado. Libere somente depois de nova autorização.',
      descadastrado:'O contato está descadastrado. Revise a autorização na área de Contatos.',
      autorizado:'Este número já possui autorização para convites.',
      pendente:'A autorização deste número ainda não foi confirmada.',
    };
    return {situacao,contatoId:c.id,nome:c.nome||'Contato',
      telefoneMascarado:mascarar(numero),mensagem:textos[situacao]};
  }
  function buscar({termo=''}={}){
    const busca=String(termo??'').trim();
    if(busca.length<2||busca.length>80)throw new Error('Digite pelo menos 2 caracteres para buscar.');
    const result=gestaoContatos.listar({filtro:'autorizado',
      busca,pagina:1,limite:12});
    return {contatos:result.contatos.map(c=>({
      id:c.id,nome:c.nome,telefoneMascarado:c.telefoneMascarado,
      status:c.status,
    })),total:result.totalFiltrado};
  }
  function cadastrarProprio({telefone,nome='',souTitular=false,
    autorizado=false,confirmado=false}={}){
    if(souTitular!==true||autorizado!==true||confirmado!==true)
      throw new Error('Confirme que o número é seu e que você autoriza este teste.');
    const anterior=consultar({telefone});
    if(['bloqueado','descadastrado'].includes(anterior.situacao)){
      throw new Error('Número com saída ou bloqueio registrado. Use Contatos → Bloqueados e apresente uma nova autorização.');
    }
    if(anterior.situacao==='autorizado')return {contato:anterior,jaCadastrado:true};
    const nomeSeguro=String(nome||'').trim().replace(/[<>\x00-\x1f]/g,' ').slice(0,80);
    if(nomeSeguro.length<2)throw new Error('Digite um nome para identificar seu teste.');
    const data=agora().toISOString().slice(0,10);
    const registro=contatos.importarConsentimentosExternos({
      pessoas:[{nome:nomeSeguro,telefone}],
      origemAutorizacao:'Cadastro voluntário do próprio titular no painel local',
      referenciaAutorizacao:'Declaração individual do titular para teste pelo painel de envio guiado',
      dataAutorizacao:data,declaracao:true,
      verificarBloqueio:numero=>denuncias.estaBloqueado(numero),
    });
    if(registro.bloqueados||registro.invalidos||
      !(registro.autorizadosNovos||registro.jaRegistrados)){
      throw new Error('Não foi possível registrar a autorização. Revise a situação em Contatos.');
    }
    const contato=consultar({telefone});
    if(contato.situacao!=='autorizado')throw new Error('O cadastro ainda não está autorizado.');
    return {contato,jaCadastrado:false};
  }
  function criar({contatoId,confirmado=false,proprio=false}={}){
    if(confirmado!==true)throw new Error('Confirme que deseja preparar um convite individual.');
    if(!UUID.test(String(contatoId||'')))throw new Error('Escolha um contato autorizado.');
    const c=contatos.listar().find(c=>c.id===contatoId);
    if(!c||!contatoComConsentimento(c)||denuncias.estaBloqueado(c.telefone))
      throw new Error('O contato não está autorizado para receber convites.');
    const filas=convites.listarFilas().filter(f=>f.modo==='web');
    for(const f of filas){
      if(!f.incertos&&!f.pendentes&&!f.abertos)continue;
      const detalhes=convites.detalhesFila(f.id);
      for(const item of detalhes.itens){
        if(item.status==='incerto'&&item.contatoId===contatoId)
          throw new Error('Há uma tentativa com resultado incerto para este contato. Confira a fila anterior antes de criar outra.');
        if(['pendente','aberto'].includes(item.status)&&item.contatoId===contatoId)
          return {fila:detalhes,reutilizada:true};
        if(item.status==='aberto'&&item.contatoId!==contatoId)
          throw new Error('Existe outra conversa preparada. Termine ou cancele antes de começar esta.');
      }
    }
    const stamp=agora().toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
    const nome=(proprio?'Meu teste de WhatsApp':'Convite individual')+
      ' - '+(c.nome||'Contato').slice(0,42)+' - '+stamp;
    const fila=convites.criarFila({nome,contatoIds:[contatoId],modo:'web'});
    return {fila,reutilizada:false};
  }
  return {consultar,buscar,cadastrarProprio,criar};
}
