import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { normalizarOrigem } from './analytics.mjs';

export const VERSAO_TERMO = '2026-10-13-v1';
const LINK_GRUPO = 'https://chat.whatsapp.com/CpMG7JTqP464hgJwf8ElFc';

function agoraIso(agora) {
  return agora().toISOString();
}

export function telefoneBrasil(valor) {
  const texto = String(valor ?? '').trim();
  if (!/^\+?[0-9\s().-]{10,25}$/.test(texto)) return null;
  let digits = texto.replace(/\D/g, '');
  if (digits.length === 12 || digits.length === 13) {
    if (!digits.startsWith('55')) return null;
    digits = digits.slice(2);
  }
  if (!/^([1-9][0-9])([2-9][0-9]{7}|9[0-9]{8})$/.test(digits)) return null;
  return '55' + digits;
}

function csvSeguro(valor) {
  let texto = String(valor ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
  if (/^[\s]*[=+@-]/.test(texto)) texto = "'" + texto;
  return '"' + texto.replace(/"/g, '""') + '"';
}

export function iniciarContatos(dataDir, agora = () => new Date()) {
  mkdirSync(dataDir, { recursive: true });
  const path = join(dataDir, 'contatos-autorizados.json');

  function ler() {
    try {
      const dados = JSON.parse(readFileSync(path, 'utf8'));
      if (dados?.versao !== 2 || !Array.isArray(dados.contatos) ||
        typeof dados.remetente !== 'string') {
        throw new Error('Estrutura de contatos inválida');
      }
      return dados;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { versao: 2, atualizadoEm: agoraIso(agora), remetente: '', contatos: [] };
      }
      throw new Error('Arquivo de contatos indisponível: ' + error.message);
    }
  }

  function salvar(dados) {
    dados.atualizadoEm = agoraIso(agora);
    const temporario = `${path}.${process.pid}.${randomBytes(5).toString('hex')}.tmp`;
    writeFileSync(temporario, JSON.stringify(dados, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    renameSync(temporario, path);
  }

  function cadastrar({ nome, telefone, origem, consentimento, website }) {
    if (website) throw new Error('Não foi possível concluir o cadastro.');
    if (consentimento !== true) throw new Error('A autorização para mensagens individuais é obrigatória neste cadastro.');
    const numero = telefoneBrasil(telefone);
    if (!numero) throw new Error('Informe um WhatsApp brasileiro com DDD válido.');
    const nomeSeguro = String(nome ?? '').trim().replace(/[<>]/g, '').slice(0, 80);
    if (nomeSeguro.length > 80) throw new Error('Nome muito longo.');
    const dados = ler();
    const existente = dados.contatos.find((contato) => contato.telefone === numero);
    if (existente) {
      // Não revelar dados nem alterar permissões com um simples formulário público.
      // Usuários cancelados só voltam por uma nova verificação administrada.
      return { registrado: true, repetido: true, remetente: dados.remetente };
    }
    const contato = {
      id: randomUUID(),
      nome: nomeSeguro,
      telefone: numero,
      origem: normalizarOrigem(origem),
      status: 'pendente',
      consentimentoDeclaradoEm: agoraIso(agora),
      consentimentoConfirmadoEm: null,
      versaoTermo: VERSAO_TERMO,
      evidencia: 'checkbox-voluntario',
      codigoConfirmacao: randomBytes(3).toString('hex').toUpperCase(),
      tokenDescadastro: randomBytes(24).toString('hex'),
      ultimoEnvioManualEm: null,
      descadastroEm: null,
    };
    dados.contatos.push(contato);
    salvar(dados);
    return {
      registrado: true,
      repetido: false,
      codigo: contato.codigoConfirmacao,
      remetente: dados.remetente,
    };
  }

  function resumo() {
    const dados = ler();
    const total = dados.contatos.length;
    return {
      total,
      pendentes: dados.contatos.filter((c) => c.status === 'pendente').length,
      ativos: dados.contatos.filter((c) => c.status === 'ativo').length,
      descadastrados: dados.contatos.filter((c) => c.status === 'descadastrado').length,
      remetenteConfigurado: Boolean(dados.remetente),
      remetente: dados.remetente,
    };
  }

  function listar() {
    return ler().contatos.map(({ tokenDescadastro, ...resto }) => resto).reverse();
  }

  function configurarRemetente(valor) {
    const dados = ler();
    const numero = valor === '' ? '' : telefoneBrasil(valor);
    if (numero === null) throw new Error('Número do WhatsApp Business inválido. Informe com DDD.');
    dados.remetente = numero;
    salvar(dados);
    return dados.remetente;
  }

  function confirmar({ id, codigo, evidencia }) {
    if (evidencia !== 'mensagem-recebida') throw new Error('Confirme somente após receber QUERO VIP do próprio interessado.');
    const dados = ler();
    if (!dados.remetente) throw new Error('Configure o segundo WhatsApp antes de confirmar um contato.');
    const contato = dados.contatos.find((c) => c.id === id);
    if (!contato || contato.status !== 'pendente') throw new Error('Contato pendente não encontrado.');
    const esperado = Buffer.from(contato.codigoConfirmacao);
    const recebido = Buffer.from(String(codigo ?? '').trim().toUpperCase());
    if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) {
      throw new Error('Código não confere com a mensagem recebida no WhatsApp.');
    }
    contato.status = 'ativo';
    contato.consentimentoConfirmadoEm = agoraIso(agora);
    contato.evidencia = 'checkbox-e-mensagem-iniciada-pelo-titular';
    salvar(dados);
    return contato.id;
  }

  function descadastrarPorId(id) {
    const dados = ler();
    const contato = dados.contatos.find((c) => c.id === id);
    if (!contato) throw new Error('Contato não encontrado.');
    contato.status = 'descadastrado';
    contato.descadastroEm = agoraIso(agora);
    salvar(dados);
    return true;
  }

  function descadastrarPorToken(token) {
    const dados = ler();
    const contato = dados.contatos.find((c) => {
      const recebido = Buffer.from(String(token ?? ''));
      const esperado = Buffer.from(c.tokenDescadastro ?? '');
      return recebido.length > 0 && recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
    });
    if (!contato) return false;
    if (contato.status !== 'descadastrado') {
      contato.status = 'descadastrado';
      contato.descadastroEm = agoraIso(agora);
      salvar(dados);
    }
    return true;
  }

  function prepararMensagem(id) {
    const dados = ler();
    if (!dados.remetente) throw new Error('Configure o número secundário antes de preparar convites.');
    const contato = dados.contatos.find((c) => c.id === id);
    if (!contato || contato.status !== 'ativo' || !contato.consentimentoConfirmadoEm) {
      throw new Error('Somente contatos com consentimento confirmado podem receber convites.');
    }
    const nome = contato.nome ? `, ${contato.nome}` : '';
    let cancelamento = 'Se não quiser receber mais mensagens individuais, responda SAIR.';
    try {
      const raiz = new URL(process.env.CAPTACAO_PUBLIC_BASE_URL || '');
      if (raiz.protocol === 'https:' && !raiz.username && !raiz.password && !raiz.search && !raiz.hash) {
        const urlSair = new URL('/sair', raiz.origin);
        urlSair.searchParams.set('token', contato.tokenDescadastro);
        cancelamento += ` Ou cancele em ${urlSair.toString()}`;
      }
    } catch { /* Sem HTTPS público: opção de resposta SAIR permanece. */ }
    const mensagem = `Olá${nome}! 👑 Você autorizou receber novidades do Caça Promos VIP. Nosso grupo gratuito de ofertas é ${LINK_GRUPO}. ${cancelamento}`;
    return {
      id,
      numero: contato.telefone,
      numeroRemetente: dados.remetente,
      mensagem,
      url: `https://wa.me/${contato.telefone}?text=${encodeURIComponent(mensagem)}`,
    };
  }

  function marcarEnvioManual(id) {
    const dados = ler();
    const contato = dados.contatos.find((c) => c.id === id);
    if (!dados.remetente || !contato || contato.status !== 'ativo' || !contato.consentimentoConfirmadoEm) {
      throw new Error('Não é permitido registrar contato não autorizado.');
    }
    contato.ultimoEnvioManualEm = agoraIso(agora);
    salvar(dados);
    return contato.ultimoEnvioManualEm;
  }

  function excluirPorId(id) {
    const dados = ler();
    const indice = dados.contatos.findIndex(c => c.id === id);
    if (indice < 0) throw new Error('Contato não encontrado.');
    if (dados.contatos[indice].status !== 'descadastrado') {
      throw new Error('Desative o contato antes de excluir seus dados.');
    }
    dados.contatos.splice(indice, 1);
    salvar(dados);
    return true;
  }

  function exportarCsv() {
    const cabecalho = [
      'nome', 'telefone', 'origem', 'status', 'consentimento_declarado_em_utc',
      'consentimento_confirmado_em_utc', 'evidencia', 'versao_termo',
      'ultimo_envio_manual_em_utc', 'descadastro_em_utc', 'codigo_confirmacao'
    ];
    const linhas = ler().contatos.map((contato) => [
      contato.nome, contato.telefone, contato.origem, contato.status,
      contato.consentimentoDeclaradoEm, contato.consentimentoConfirmadoEm,
      contato.evidencia, contato.versaoTermo, contato.ultimoEnvioManualEm,
      contato.descadastroEm, contato.codigoConfirmacao,
    ].map(csvSeguro).join(';'));
    return '\ufeff' + [cabecalho.join(';'), ...linhas].join('\r\n') + '\r\n';
  }

  return {
    ler, cadastrar, resumo, listar, configurarRemetente, confirmar,
    descadastrarPorId, descadastrarPorToken, prepararMensagem,
    marcarEnvioManual, excluirPorId, exportarCsv,
  };
}
