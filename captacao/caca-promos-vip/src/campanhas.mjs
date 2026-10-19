import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';

const LIMITE_CAMPANHAS = 150;
const LIMITE_DESTINATARIOS = 1500;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function textoSeguro(valor, maximo, minimo = 0) {
  const texto = String(valor ?? '').trim();
  if (texto.length < minimo || texto.length > maximo ||
      /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(texto)) {
    throw new Error('Texto inválido ou fora do tamanho permitido.');
  }
  return texto;
}

function confirmarContato(contato) {
  return Boolean(contato && contato.status === 'ativo' &&
    contato.consentimentoConfirmadoEm &&
    contato.evidencia === 'checkbox-e-mensagem-iniciada-pelo-titular' &&
    !contato.descadastroEm);
}
function mascarar(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  return digitos ? '+' + digitos.slice(0, 4) + ' •••• ' + digitos.slice(-4) : '';
}

export function iniciarCampanhas(dataDir, contatos, agora = () => new Date(), bloqueios = null) {
  function elegivel(contato) {
    return confirmarContato(contato) && !bloqueios?.estaBloqueado(contato.telefone);
  }
  mkdirSync(dataDir, { recursive: true });
  const arquivo = join(dataDir, 'campanhas-manuais.json');

  function ler() {
    try {
      const dados = JSON.parse(readFileSync(arquivo, 'utf8'));
      if (dados?.versao !== 1 || !Array.isArray(dados.campanhas)) {
        throw new Error('Estrutura de campanhas inválida.');
      }
      return dados;
    } catch (erro) {
      if (erro.code === 'ENOENT') return { versao: 1, campanhas: [] };
      throw new Error('Não foi possível ler as campanhas.');
    }
  }

  function salvar(dados) {
    const tmp = arquivo + '.' + process.pid + '.' + randomBytes(4).toString('hex') + '.tmp';
    writeFileSync(tmp, JSON.stringify(dados, null, 2) + '\n', { encoding:'utf8', mode:0o600 });
    renameSync(tmp, arquivo);
  }

  function contatoMap() {
    return new Map(contatos.listar().map(c => [c.id, c]));
  }

  function destinatarios() {
    return contatos.listar().filter(elegivel).map(c => ({
      id:c.id, nome:c.nome || '', telefone:c.telefone, origem:c.origem,
      consentimentoConfirmadoEm:c.consentimentoConfirmadoEm,
    }));
  }

  function validarModelo(modelo) {
    const texto = textoSeguro(modelo, 1200, 8);
    const expressoes = texto.match(/\{[^{}]*\}/g) || [];
    if (expressoes.some(v => v !== '{nome}' && v !== '{grupo}') ||
        texto.includes('{{') || texto.includes('}}')) {
      throw new Error('Use apenas as variáveis {nome} e {grupo}.');
    }
    return texto;
  }

  function criar({ nome, grupo, modelo, contatoIds }) {
    const titulo = textoSeguro(nome, 90, 3);
    const origem = textoSeguro(grupo || '', 90);
    const mensagem = validarModelo(modelo);
    if (!Array.isArray(contatoIds) || !contatoIds.length ||
        contatoIds.length > LIMITE_DESTINATARIOS) {
      throw new Error('Escolha de 1 a 1.500 destinatários com consentimento confirmado.');
    }
    const ids = [...new Set(contatoIds)];
    if (ids.length !== contatoIds.length || ids.some(id => typeof id !== 'string' || !UUID.test(id))) {
      throw new Error('Há destinatários duplicados ou inválidos.');
    }
    const mapa = contatoMap();
    if (ids.some(id => !elegivel(mapa.get(id)))) {
      throw new Error('Campanhas só podem incluir contatos ativos com consentimento de mensagens confirmado.');
    }
    const dados = ler();
    if (dados.campanhas.length >= LIMITE_CAMPANHAS) {
      throw new Error('Limite de campanhas atingido. Arquive campanhas antigas antes de criar mais.');
    }
    const campanha = {
      id:randomUUID(), nome:titulo, grupo:origem, modelo:mensagem,
      criadaEm:agora().toISOString(),
      itens:ids.map(id => ({ contatoId:id, status:'pendente', enviadoEm:null, ignoradoEm:null })),
    };
    dados.campanhas.unshift(campanha);
    salvar(dados);
    return { id:campanha.id, nome:campanha.nome, total:ids.length };
  }

  function resumo(campanha, mapa) {
    const estado = campanha.itens.map(item => {
      const c = mapa.get(item.contatoId);
      return item.status === 'enviado' || item.status === 'ignorado'
        ? item.status : !elegivel(c) ? 'bloqueado' : item.status;
    });
    const enviado = estado.filter(s => s === 'enviado').length;
    const bloqueado = estado.filter(s => s === 'bloqueado').length;
    const ignorado = estado.filter(s => s === 'ignorado').length;
    return {
      id:campanha.id, nome:campanha.nome, grupo:campanha.grupo,
      criadaEm:campanha.criadaEm, total:campanha.itens.length,
      enviados:enviado, bloqueados:bloqueado, ignorados:ignorado,
      pendentes:estado.length-enviado-bloqueado-ignorado,
    };
  }

  function listar() {
    const mapa = contatoMap();
    return ler().campanhas.map(c => resumo(c, mapa));
  }

  function obter(id) {
    if (typeof id !== 'string' || !UUID.test(id)) throw new Error('Campanha inválida.');
    const campanha = ler().campanhas.find(c => c.id === id);
    if (!campanha) throw new Error('Campanha não encontrada.');
    const mapa = contatoMap();
    const itens = campanha.itens.map(item => {
      const c = mapa.get(item.contatoId);
      const permitido = elegivel(c);
      return {
        id:item.contatoId,
        nome:c?.nome || 'Contato indisponível',
        telefone:permitido ? c.telefone : null,
        telefoneMascarado:mascarar(c?.telefone),
        status: item.status === 'enviado' || item.status === 'ignorado'
          ? item.status : permitido ? item.status : 'bloqueado',
        enviadoEm:item.enviadoEm,
      };
    });
    return {
      ...resumo(campanha,mapa), modelo:campanha.modelo,
      remetenteConfigurado:contatos.resumo().remetenteConfigurado,
      itens,
    };
  }

  function encontrar(campanhaId, contatoId) {
    const dados = ler();
    const campanha = dados.campanhas.find(c => c.id === campanhaId);
    if (!campanha) throw new Error('Campanha não encontrada.');
    const item = campanha.itens.find(i => i.contatoId === contatoId);
    if (!item) throw new Error('Contato não pertence a esta campanha.');
    const contato = contatoMap().get(contatoId);
    if (!elegivel(contato)) {
      throw new Error('Contato sem autorização atual para mensagens. Envio bloqueado.');
    }
    return { dados, campanha, item, contato };
  }

  function prepararMensagem({ campanhaId, contatoId }) {
    const { campanha, item, contato } = encontrar(campanhaId, contatoId);
    if (item.status !== 'pendente') throw new Error('Este contato já foi tratado na campanha.');
    const primeiroNome = String(contato.nome || '').trim().split(/\s+/)[0] || 'pessoal';
    let mensagem = campanha.modelo
      .replace(/\{nome\}/g, primeiroNome)
      .replace(/\{grupo\}/g, campanha.grupo || 'nossa comunidade');
    if (!/\bSAIR\b/i.test(mensagem)) {
      mensagem += '\n\nPara não receber mais mensagens, responda SAIR.';
    }
    if (mensagem.length > 1700) throw new Error('Mensagem gerada muito longa.');
    const numero = String(contato.telefone || '');
    if (!/^[1-9]\d{7,14}$/.test(numero)) throw new Error('Número para WhatsApp inválido.');
    return {
      nome:contato.nome || '', numero, mensagem,
      url:'https://wa.me/' + numero + '?text=' + encodeURIComponent(mensagem),
      aviso:'Abrir a conversa NÃO confirma que a mensagem foi enviada.',
    };
  }

  function registrar({ campanhaId, contatoId, enviado }) {
    if (enviado !== true) throw new Error('Confirme o envio manual depois de enviar pelo WhatsApp.');
    const { dados, item } = encontrar(campanhaId, contatoId);
    if (item.status !== 'pendente') throw new Error('Este contato já foi tratado.');
    // Mantém a exigência já existente de segundo remetente configurado
    // e a trilha de auditoria do CRM original.
    const dataEnvio = contatos.marcarEnvioManual(contatoId);
    item.status = 'enviado';
    item.enviadoEm = dataEnvio;
    salvar(dados);
    return { enviadoEm:dataEnvio };
  }

  function ignorar({ campanhaId, contatoId }) {
    const { dados, item } = encontrar(campanhaId, contatoId);
    if (item.status !== 'pendente') throw new Error('Este contato já foi tratado.');
    item.status = 'ignorado';
    item.ignoradoEm = agora().toISOString();
    salvar(dados);
    return { ignoradoEm:item.ignoradoEm };
  }

  return { destinatarios, criar, listar, obter, prepararMensagem, registrar, ignorar };
}
