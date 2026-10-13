import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { telefoneBrasil } from './contatos.mjs';
import { validarOrigemGrupo } from './grupos.mjs';

const LIMITE_LINHAS = 1500;
const LIMITE_BYTES = 110_000;
const LIMITE_CONTATOS = 12_000;

function nomeSeguro(valor) {
  return String(valor ?? '').trim().replace(/[\x00-\x1f<>]/g, '').slice(0, 80);
}
function csvSeguro(valor) {
  let texto = String(valor ?? '').replace(/[\x00-\x1f]/g, ' ');
  if (/^\s*[=+@-]/.test(texto)) texto = "'" + texto;
  return '"' + texto.replace(/"/g, '""') + '"';
}
function normalizarNumero(valor) {
  const brasil = telefoneBrasil(valor);
  if (brasil) return brasil;
  const texto = String(valor ?? '').trim();
  if (!/^\+[0-9().\s-]{8,24}$/.test(texto)) return null;
  const digitos = texto.replace(/\D/g, '');
  if (!/^[1-9][0-9]{7,14}$/.test(digitos) || digitos.startsWith('55')) return null;
  return digitos;
}
function lerLinha(linha) {
  const valor = String(linha).trim();
  if (!valor) return { vazio: true };
  if (/^(nome|telefone|n[uú]mero|whatsapp)\s*([;,\t]|$)/i.test(valor)) return { cabecalho: true };
  const campos = valor.split(valor.includes('\t') ? '\t' : valor.includes(';') ? ';' : ',')
    .map(item => item.trim().replace(/^"|"$/g, '').trim());
  const indice = campos.findIndex(item => normalizarNumero(item) !== null);
  if (indice === -1) return { invalido: true };
  const nome = campos.length > 1 ? nomeSeguro(campos.find((campo, i) => i !== indice && normalizarNumero(campo) === null) || '') : '';
  return { telefone: normalizarNumero(campos[indice]), nome };
}

export function iniciarImportacaoAutorizada(dataDir, agora = () => new Date()) {
  mkdirSync(dataDir, { recursive: true });
  const arquivo = join(dataDir, 'participantes-importados.json');
  function ler() {
    try {
      const dados = JSON.parse(readFileSync(arquivo, 'utf8'));
      if (dados?.versao !== 1 || !Array.isArray(dados.contatos) || !Array.isArray(dados.historico)) {
        throw new Error('Arquivo de importação inválido');
      }
      return dados;
    } catch (error) {
      if (error.code === 'ENOENT') return { versao: 1, contatos: [], historico: [] };
      throw new Error('Não foi possível carregar os participantes importados.');
    }
  }
  function salvar(dados) {
    const temporario = `${arquivo}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
    writeFileSync(temporario, JSON.stringify(dados, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    renameSync(temporario, arquivo);
  }
  function importar({ origem, grupoId, lista, autorizacaoColeta, referenciaPermissao }) {
    const slug = validarOrigemGrupo(origem);
    if (autorizacaoColeta !== true) throw new Error('Confirme a autorização individual de coleta dos números.');
    if (typeof grupoId !== 'string' || !/^[0-9a-f-]{36}$/i.test(grupoId)) throw new Error('Grupo de origem inválido.');
    const referencia = String(referenciaPermissao ?? '').trim();
    if (referencia.length < 5 || referencia.length > 180 || /[\x00-\x1f]/.test(referencia)) {
      throw new Error('Informe uma referência à autorização (5 a 180 caracteres).');
    }
    if (typeof lista !== 'string' || !lista.trim() || Buffer.byteLength(lista, 'utf8') > LIMITE_BYTES) {
      throw new Error('Cole ou selecione uma lista de até 110 KB.');
    }
    const linhas = lista.split(/\r?\n/).filter(linha => linha.trim());
    if (linhas.length > LIMITE_LINHAS) throw new Error('Máximo de 1.500 linhas por importação.');

    const dados = ler();
    const index = new Map(dados.contatos.map(contato => [contato.telefone, contato]));
    const vistos = new Set();
    const instante = agora().toISOString();
    const resultado = { novos: 0, repetidos: 0, invalidos: 0, cabecalhos: 0, origem: slug };
    for (const linha of linhas) {
      const item = lerLinha(linha);
      if (item.cabecalho) { resultado.cabecalhos++; continue; }
      if (item.invalido || item.vazio) { resultado.invalidos++; continue; }
      if (vistos.has(item.telefone)) { resultado.repetidos++; continue; }
      vistos.add(item.telefone);
      const existente = index.get(item.telefone);
      if (existente) {
        resultado.repetidos++;
        if (!existente.origens.includes(slug)) existente.origens.push(slug);
        if (!existente.nome && item.nome) existente.nome = item.nome;
        existente.permissoesPorOrigem ??= {};
        existente.permissoesPorOrigem[slug] = { declaradaEm: instante, referencia };
        existente.atualizadoEm = instante;
      } else {
        if (dados.contatos.length >= LIMITE_CONTATOS) throw new Error('Limite local de registros atingido.');
        const contato = {
          id: randomUUID(), nome: item.nome, telefone: item.telefone, origens: [slug],
          captadoEm: instante, atualizadoEm: instante,
          permissoesPorOrigem: { [slug]: { declaradaEm: instante, referencia } },
          autorizadoParaMensagens: false,
        };
        dados.contatos.push(contato);
        index.set(item.telefone, contato);
        resultado.novos++;
      }
    }
    if (!vistos.size) throw new Error('Nenhum número de telefone válido foi identificado.');
    dados.historico.push({ id: randomUUID(), grupoId, origem: slug, em: instante,
      referenciaPermissao: referencia, ...resultado });
    if (dados.historico.length > 4000) dados.historico.splice(0, dados.historico.length - 4000);
    salvar(dados);
    return resultado;
  }
  function listar(origem = null) {
    const filtro = origem === null ? null : validarOrigemGrupo(origem);
    const contatos = ler().contatos.filter(contato => filtro === null || contato.origens.includes(filtro));
    return { total: contatos.length, contatos: contatos.slice().reverse() };
  }
  function exportarCsv(origem = null) {
    const registros = listar(origem).contatos;
    const cabecalho = 'nome;telefone;origens;coletado_em_utc;referencia_autorizacao;autorizado_mensagem_individual';
    const linhas = registros.map(contato => [contato.nome, contato.telefone,
      contato.origens.join(','), contato.captadoEm,
      origem === null
        ? contato.origens.map(o => `${o}: ${contato.permissoesPorOrigem?.[o]?.referencia ?? 'não informada'}`).join(' | ')
        : contato.permissoesPorOrigem?.[origem]?.referencia ?? 'não informada',
      'NAO - verificar autorizacao separada',
    ].map(csvSeguro).join(';'));
    return '\ufeff' + [cabecalho, ...linhas].join('\r\n') + '\r\n';
  }
  function excluir(id) {
    const dados = ler();
    const indice = dados.contatos.findIndex(c => c.id === id);
    if (indice === -1) throw new Error('Registro não encontrado.');
    dados.contatos.splice(indice, 1);
    salvar(dados);
    return true;
  }
  return { ler, importar, listar, exportarCsv, excluir };
}
