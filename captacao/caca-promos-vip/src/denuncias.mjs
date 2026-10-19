import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { createHmac, randomBytes } from 'node:crypto';

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

  return { registrar, estaBloqueado, listar, resumo };
}
