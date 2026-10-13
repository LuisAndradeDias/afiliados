import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';

export function normalizarOrigem(valor) {
  const origem = String(valor ?? '').trim().toLowerCase();
  // Um identificador de campanha, nunca nome/telefone de um participante.
  return /^[a-z][a-z0-9-]{0,31}$/.test(origem) ? origem : 'direto';
}

export function autorizarChave(recebida, esperada) {
  const a = Buffer.from(String(recebida ?? ''), 'utf8');
  const b = Buffer.from(String(esperada ?? ''), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function iniciarAnaliticos(dataDir, agora = () => new Date()) {
  mkdirSync(dataDir, { recursive: true });
  const metricsPath = join(dataDir, 'metricas.json');
  const adminPath = join(dataDir, 'chave-admin.txt');
  let chave;
  try {
    chave = readFileSync(adminPath, 'utf8').trim();
    if (!/^[0-9a-f]{48}$/.test(chave)) throw new Error('Chave de administrador invalida');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    chave = randomBytes(24).toString('hex');
    writeFileSync(adminPath, `${chave}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  }

  function ler() {
    try {
      const dados = JSON.parse(readFileSync(metricsPath, 'utf8'));
      if (dados?.versao !== 1 || typeof dados.campanhas !== 'object' ||
          dados.campanhas === null || typeof dados.dias !== 'object' || dados.dias === null) {
        throw new Error('Formato inesperado das metricas');
      }
      return dados;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { versao: 1, criadoEm: agora().toISOString(), campanhas: {}, dias: {} };
      }
      // Não apagar dados corruptos silenciosamente.
      throw new Error('Nao foi possivel ler as metricas: ' + error.message);
    }
  }

  function gravar(dados) {
    const temporario = `${metricsPath}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
    writeFileSync(temporario, JSON.stringify(dados, null, 2) + '\n', 'utf8');
    renameSync(temporario, metricsPath);
  }

  function registrar(tipo, origem) {
    if (tipo !== 'visitas' && tipo !== 'cliques') throw new Error('Metrica invalida');
    const campanha = normalizarOrigem(origem);
    const dados = ler();
    const dia = agora().toISOString().slice(0, 10);
    if (!dados.campanhas[campanha]) dados.campanhas[campanha] = { visitas: 0, cliques: 0 };
    if (!dados.dias[dia]) dados.dias[dia] = { visitas: 0, cliques: 0 };
    dados.campanhas[campanha][tipo] += 1;
    dados.dias[dia][tipo] += 1;
    gravar(dados);
    return campanha;
  }

  return { chave, ler, registrar };
}
