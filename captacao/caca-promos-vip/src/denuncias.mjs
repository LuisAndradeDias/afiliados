import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const VERSAO = 1;
const MAX_EVENTOS = 10000;
const MAX_BLOQUEIOS = 100000;
function validarNumero(numero) {
  const n = String(numero ?? '').replace(/\D/g, '');
  if (!/^[1-9]\d{7,14}$/.test(n)) throw new Error('Número de WhatsApp inválido.');
  return n;
}

export function iniciarDenuncias(dataDir, contatos, agora = () => new Date()) {
  mkdirSync(dataDir, { recursive: true });
  const arquivo = join(dataDir, 'denuncias-bloqueios.json');
  const chave = join(dataDir, 'denuncias-chave-local.txt');

  function carregarChave() {
    try {
      const atual = readFileSync(chave, 'utf8').trim();
      if (!/^[a-f\d]{64}$/i.test(atual)) throw new Error('Chave local inválida.');
      return Buffer.from(atual, 'hex');
    } catch (erro) {
      if (erro.code !== 'ENOENT') throw erro;
      const novo = randomBytes(32).toString('hex');
      writeFileSync(chave, novo + '\n', { encoding:'utf8',mode:0o600,flag:'wx' });
      return Buffer.from(novo, 'hex');
    }
  }
  const segredo = carregarChave();

  function resumoNumero(numero) {
    return createHmac('sha256', segredo).update(validarNumero(numero)).digest('hex');
  }

  function ler() {
    try {
      const dados = JSON.parse(readFileSync(arquivo, 'utf8'));
      if (dados?.versao !== VERSAO || !Array.isArray(dados.bloqueados) ||
          !Array.isArray(dados.eventos)) throw new Error('Banco de denúncias inválido.');
      return dados;
    } catch (erro) {
      if (erro.code === 'ENOENT') return { versao:VERSAO, bloqueados:[], eventos:[] };
      throw erro;
    }
  }
  function salvar(dados) {
    const tmp = arquivo + '.' + process.pid + '.' + randomBytes(6).toString('hex') + '.tmp';
    writeFileSync(tmp, JSON.stringify(dados, null, 2) + '\n',
      { encoding:'utf8', mode:0o600 });
    renameSync(tmp, arquivo);
  }

  function estaBloqueado(numero) {
    if (!numero) return false;
    const hash = resumoNumero(numero);
    return ler().bloqueados.some(x => x.numeroHash === hash);
  }

  function registrar({ telefone, mensagemId, motivo = 'denuncia-convite', origem = 'whatsapp-webhook' }) {
    if (!['denuncia-convite','saida-solicitada'].includes(motivo)) {
      throw new Error('Motivo de bloqueio inválido.');
    }
    const numero = validarNumero(telefone);
    const eventId = String(mensagemId ?? '').trim();
    if (eventId.length < 4 || eventId.length > 255 ||
        /[\x00-\x1f]/.test(eventId)) throw new Error('Identificador de evento inválido.');
    const eventHash = createHmac('sha256', segredo).update(eventId).digest('hex');
    const dados = ler();
    if (dados.eventos.some(e => e.idHash === eventHash)) {
      return { duplicada:true, bloqueado:true };
    }
    const numeroHash = resumoNumero(numero);
    const contato = contatos.listar().find(c => c.telefone === numero);
    // O bloqueio persistente por hash impede campanhas futuras mesmo se o
    // cadastro original for removido e o numero reaparecer em novo CSV.
    if (!dados.bloqueados.some(b => b.numeroHash === numeroHash)) {
      if (dados.bloqueados.length >= MAX_BLOQUEIOS) {
        throw new Error('Limite de bloqueios atingido; revise a base antes de continuar.');
      }
      dados.bloqueados.push({
        numeroHash, primeiroBloqueioEm:agora().toISOString(), motivo,
        contatoId:contato?.id || null,
      });
    }
    if (contato && contato.status !== 'descadastrado') {
      contatos.descadastrarPorId(contato.id);
    }
    dados.eventos.push({
      idHash:eventHash, numeroHash, contatoId:contato?.id || null,
      motivo, origem, recebidoEm:agora().toISOString(),
    });
    if (dados.eventos.length > MAX_EVENTOS) {
      dados.eventos.splice(0, dados.eventos.length - MAX_EVENTOS);
    }
    salvar(dados);
    return { duplicada:false, bloqueado:true };
  }

  // Link de reclamacao gerado somente no servidor. O codigo nao contem
  // telefone, nome nem identificador em texto aberto.
  function tokenDenuncia(contato) {
    if (!contato?.id || !contato?.telefone) throw new Error('Contato indisponivel.');
    return createHmac('sha256', segredo)
      .update('denuncia-link-v1:' + contato.id + ':' + contato.telefone)
      .digest('hex');
  }

  function registrarCliqueDenuncia(token) {
    const recebido=String(token??'');
    if (!/^[a-f0-9]{64}$/i.test(recebido)) {
      return {encontrado:false,bloqueado:false};
    }
    const buffer=Buffer.from(recebido,'hex');
    const contato=contatos.listar().find(c=>{
      const esperado=Buffer.from(tokenDenuncia(c),'hex');
      return timingSafeEqual(buffer,esperado);
    });
    if (!contato) return {encontrado:false,bloqueado:false};
    const resultado=registrar({
      telefone:contato.telefone,
      mensagemId:'link-denuncia-v1-'+tokenDenuncia(contato),
      motivo:'denuncia-convite',
      origem:'clique-confirmado-pagina-publica',
    });
    return {encontrado:true,bloqueado:resultado.bloqueado,
      duplicada:resultado.duplicada};
  }

  // Assinatura independente para o portal Netlify: expõe apenas UUID pseudônimo,
  // nunca nome/telefone; validação do mesmo segredo nas duas pontas.
  function tokenNetlify(contato,secret){
    const id=String(contato?.id||'').toLowerCase();
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)
      || !/^[a-f0-9]{64}$/i.test(String(secret||''))) {
      throw new Error('Configuração do link de denúncia indisponível.');
    }
    return id+'.'+createHmac('sha256',Buffer.from(secret,'hex'))
      .update('cpv-netlify-report-v1:'+id).digest('hex');
  }
  function registrarTokenNetlify(token,secret){
    const partes=/^([a-f0-9-]{36})\.([a-f0-9]{64})$/i.exec(String(token||''));
    if(!partes||!/^[a-f0-9]{64}$/i.test(String(secret||''))) {
      return {valido:false,registrado:false};
    }
    const id=partes[1].toLowerCase();
    const esperado=createHmac('sha256',Buffer.from(secret,'hex'))
      .update('cpv-netlify-report-v1:'+id).digest('hex');
    if(!timingSafeEqual(Buffer.from(esperado,'hex'),Buffer.from(partes[2],'hex'))) {
      return {valido:false,registrado:false};
    }
    const contato=contatos.listar().find(c=>c.id===id);
    if(!contato)return {valido:true,registrado:false};
    const resposta=registrar({
      telefone:contato.telefone,
      mensagemId:'netlify-link-v1-'+token.toLowerCase(),
      motivo:'denuncia-convite',origem:'clique-confirmado-netlify',
    });
    return {valido:true,registrado:true,duplicada:resposta.duplicada};
  }

  function listar() {
    const base = ler();
    const contatosPorId = new Map(contatos.listar().map(c => [c.id,c]));
    return base.eventos.map(item => {
      const contato = contatosPorId.get(item.contatoId);
      const numero = String(contato?.telefone || '');
      return {
        contatoId:item.contatoId,
        telefoneMascarado:numero ? '+'+numero.slice(0,4)+' •••• '+numero.slice(-4) : 'Não cadastrado',
        motivo:item.motivo,
        recebidoEm:item.recebidoEm,
        origem:item.origem,
      };
    }).reverse();
  }

  function resumo() {
    const dados = ler();
    return {
      bloqueados: dados.bloqueados.length,
      denuncias: dados.eventos.filter(x => x.motivo === 'denuncia-convite').length,
      saidas: dados.eventos.filter(x => x.motivo === 'saida-solicitada').length,
    };
  }

  return { registrar, estaBloqueado, listar, resumo,
    tokenDenuncia, registrarCliqueDenuncia, tokenNetlify, registrarTokenNetlify };
}
