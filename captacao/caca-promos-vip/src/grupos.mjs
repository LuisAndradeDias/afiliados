import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';

// Links de convite indicam a origem da campanha, nunca concedem acesso à lista
// de participantes. Não há scraping de membros ou automação do WhatsApp Web.
export function validarLinkGrupo(valor) {
  if (typeof valor !== 'string' || valor.length > 200) {
    throw new Error('Cole o link HTTPS de convite do grupo.');
  }
  let url;
  try { url = new URL(valor.trim()); }
  catch { throw new Error('Link de grupo inválido.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'chat.whatsapp.com' ||
      url.username || url.password || url.port || url.search || url.hash ||
      !/^\/[A-Za-z0-9]{16,64}\/?$/.test(url.pathname)) {
    throw new Error('Use somente um link https://chat.whatsapp.com/ seguido do código do grupo.');
  }
  return 'https://chat.whatsapp.com' + url.pathname.replace(/\/$/, '');
}

export function validarOrigemGrupo(valor) {
  const origem = String(valor ?? '').trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]{2,31}$/.test(origem)) {
    throw new Error('Identificador: use de 3 a 32 caracteres, letras minúsculas, números e hífens.');
  }
  return origem;
}

export function iniciarGrupos(dataDir, agora = () => new Date()) {
  mkdirSync(dataDir, { recursive: true });
  const arquivo = join(dataDir, 'grupos-origem.json');

  function ler() {
    try {
      const dados = JSON.parse(readFileSync(arquivo, 'utf8'));
      if (dados?.versao !== 1 || !Array.isArray(dados.grupos)) {
        throw new Error('Estrutura de grupos inválida.');
      }
      return dados;
    } catch (erro) {
      if (erro.code === 'ENOENT') return { versao: 1, grupos: [] };
      throw new Error('Arquivo de grupos indisponível: ' + erro.message);
    }
  }

  function salvar(dados) {
    const temporario = arquivo + '.' + process.pid + '.' + randomBytes(5).toString('hex') + '.tmp';
    writeFileSync(temporario, JSON.stringify(dados, null, 2) + '\n', {
      encoding: 'utf8', mode: 0o600,
    });
    renameSync(temporario, arquivo);
  }

  function cadastrar({ nome, link, origem, permissaoDivulgacao }) {
    const nomeSeguro = String(nome ?? '').trim().replace(/[\x00-\x1f<>]/g, '').slice(0, 70);
    if (nomeSeguro.length < 3) throw new Error('Informe um nome de grupo com pelo menos 3 caracteres.');
    const url = validarLinkGrupo(link);
    const slug = validarOrigemGrupo(origem);
    if (permissaoDivulgacao !== true && permissaoDivulgacao !== false) {
      throw new Error('Informe se o administrador autorizou a divulgação.');
    }
    const dados = ler();
    if (dados.grupos.length >= 250) throw new Error('Limite de 250 grupos de origem atingido.');
    if (dados.grupos.some((g) => g.origem === slug || g.link === url)) {
      throw new Error('Esse grupo ou identificador já foi cadastrado.');
    }
    const criadoEm = agora().toISOString();
    const grupo = {
      id: randomUUID(),
      nome: nomeSeguro,
      link: url,
      origem: slug,
      permissaoDivulgacao,
      cadastradoEm: criadoEm,
      autorizadoEm: permissaoDivulgacao ? criadoEm : null,
    };
    dados.grupos.push(grupo);
    salvar(dados);
    return grupo;
  }

  function alterarPermissao({ id, permitido }) {
    if (typeof permitido !== 'boolean') throw new Error('Autorização inválida.');
    const dados = ler();
    const grupo = dados.grupos.find((g) => g.id === id);
    if (!grupo) throw new Error('Grupo não encontrado.');
    grupo.permissaoDivulgacao = permitido;
    grupo.autorizadoEm = permitido ? agora().toISOString() : null;
    salvar(dados);
    return grupo;
  }

  function excluir(id) {
    const dados = ler();
    const indice = dados.grupos.findIndex((g) => g.id === id);
    if (indice < 0) throw new Error('Grupo não encontrado.');
    dados.grupos.splice(indice, 1);
    salvar(dados);
    // Contatos que já optaram por receber mensagens mantêm a origem,
    // pois o histórico de consentimento não pode ser apagado silenciosamente.
    return true;
  }

  return {
    listar: () => ler().grupos.slice().reverse(),
    cadastrar,
    alterarPermissao,
    excluir,
  };
}
