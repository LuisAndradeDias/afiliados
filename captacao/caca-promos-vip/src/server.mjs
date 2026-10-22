import { createServer } from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { iniciarAnaliticos, normalizarOrigem, autorizarChave } from './analytics.mjs';
import { iniciarContatos } from './contatos.mjs';
import { iniciarGrupos, validarOrigemGrupo } from './grupos.mjs';
import { iniciarImportacaoAutorizada } from './importacao-autorizada.mjs';
import { iniciarCampanhas } from './campanhas.mjs';
import { iniciarConvitesUnicos } from './convites-unicos.mjs';
import { iniciarControleWhatsapp } from './whatsapp-convite-controller.mjs';
import { iniciarConexaoWhatsapp } from './whatsapp-conexao-controller.mjs';
import { iniciarDenuncias } from './denuncias.mjs';
import { obterConfigMeta, resumoMeta, verificarDesafioMeta, verificarAssinaturaMeta, lerEventosMeta, lerStatusMeta } from './meta-cloud.mjs';
import { renderCampanhas } from './campanhas-ui.mjs';
import { renderEnvioRapido } from './envio-rapido-ui.mjs';
import { iniciarEnvioRapido } from './envio-rapido.mjs';
import { iniciarRespostasBotoes } from './respostas-botoes.mjs';
import { renderGestao } from './gestao-ui.mjs';
import { iniciarGestaoContatos } from './gestao-contatos.mjs';
import { renderLanding, renderRelatorio, renderFavicon } from './templates.mjs';
import { renderDescadastro } from './descadastro-ui.mjs';
import { renderDenuncia } from './denuncia-ui.mjs';
import {lerConfigNetlify,iniciarSincronizacaoNetlify} from './netlify-denuncia-sync.mjs';

const GROUP_URL = 'https://chat.whatsapp.com/CpMG7JTqP464hgJwf8ElFc';
const sourceDir = dirname(fileURLToPath(import.meta.url));
const planilhaModelo = readFileSync(join(sourceDir, '..', 'modelos', 'Modelo_Contatos_Autorizados.xlsx'));
const scripts = new Map([
  ['/assets/landing.js', readFileSync(join(sourceDir, 'assets', 'landing.js'), 'utf8')],
  ['/assets/campanhas.js', readFileSync(join(sourceDir, 'assets', 'campanhas.js'), 'utf8')],
  ['/assets/envio-rapido.js', readFileSync(join(sourceDir, 'assets', 'envio-rapido.js'), 'utf8')],
  ['/assets/gestao.js', readFileSync(join(sourceDir, 'assets', 'gestao.js'), 'utf8')],
  ['/assets/descadastro.js', readFileSync(join(sourceDir, 'assets', 'descadastro.js'), 'utf8')],
  ['/assets/denuncia.js', readFileSync(join(sourceDir, 'assets', 'denuncia.js'), 'utf8')],
  ['/assets/respostas-botoes.js', readFileSync(join(sourceDir, 'assets', 'respostas-botoes.js'), 'utf8')],
]);
const styles=new Map([
  ['/assets/painel-theme.css',readFileSync(join(sourceDir,'assets','painel-theme.css'),'utf8')],
  ['/assets/envio-rapido.css',readFileSync(join(sourceDir,'assets','envio-rapido.css'),'utf8')],
]);
const headersBase = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'cross-origin-resource-policy': 'same-origin',
};

function codigoHtml(res, status, html) {
  res.writeHead(status, {
    ...headersBase,
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': "default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  });
  res.end(html);
}

function codigoTexto(res, status, texto, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { ...headersBase, 'content-type': contentType });
  res.end(texto);
}

function json(res, status, valor, extraHeaders = {}) {
  res.writeHead(status, {
    ...headersBase,
    'content-type': 'application/json; charset=utf-8',
    ...extraHeaders,
  });
  res.end(JSON.stringify(valor));
}

function convitesCsv(dados) {
  const linhas = ['origem;visitas;cliques;taxa_cliques_percentual'];
  for (const [origem, stats] of Object.entries(dados.campanhas).sort()) {
    const ratio = stats.visitas ? (100 * stats.cliques / stats.visitas).toFixed(1).replace('.', ',') : '0,0';
    linhas.push(`${origem};${stats.visitas};${stats.cliques};${ratio}`);
  }
  return '\ufeff' + linhas.join('\r\n') + '\r\n';
}

async function corpoJson(req, limiteBytes = 4096) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
    throw new Error('Envie JSON com content-type application/json.');
  }
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > limiteBytes) throw new Error('Dados acima do tamanho permitido.');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  const data = JSON.parse(text || '{}');
  if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('JSON inválido.');
  return data;
}

async function corpoAssinado(req, limiteBytes = 256_000) {
  const partes=[];
  let bytes=0;
  for await (const pedaco of req) {
    bytes += pedaco.length;
    if (bytes > limiteBytes) throw new Error('Evento acima do limite permitido.');
    partes.push(pedaco);
  }
  return Buffer.concat(partes);
}

function validarOrigem(req) {
  const origem = req.headers.origin;
  if (!origem) return true;
  try {
    const parsed = new URL(origem);
    return parsed.host === req.headers.host && (parsed.protocol === 'http:' || parsed.protocol === 'https:');
  } catch {
    return false;
  }
}

function extrairSessao(req) {
  const cookies = String(req.headers.cookie || '').split(';').map(v => v.trim());
  const item = cookies.find(v => /^cpv_admin=[0-9a-f]{64}$/.test(v));
  return item ? item.slice('cpv_admin='.length) : '';
}

export function criarPiloto({
  dataDir = join(sourceDir, '..', 'dados'),
  inviteUrl = GROUP_URL,
  agora = () => new Date(),
  metaAmbiente = process.env,
  publicBaseUrl = process.env.CAPTACAO_PUBLIC_BASE_URL || '',
  netlifySecret = '',
  recusaAtiva = true,
  whatsappWorkerTeste = false,
} = {}) {
  let urlGrupo;
  try { urlGrupo = new URL(inviteUrl); }
  catch { throw new Error('O link de convite do grupo é inválido.'); }
  if (urlGrupo.protocol !== 'https:' || urlGrupo.hostname !== 'chat.whatsapp.com') {
    throw new Error('Use um link HTTPS de chat.whatsapp.com como convite do grupo.');
  }

  const metricas = iniciarAnaliticos(dataDir, agora);
  const contatos = iniciarContatos(dataDir, agora);
  const grupos = iniciarGrupos(dataDir, agora);
  const importacoes = iniciarImportacaoAutorizada(dataDir, agora);
  const denuncias = iniciarDenuncias(dataDir, contatos, agora);
  const campanhas = iniciarCampanhas(dataDir, contatos, agora, denuncias);
  const configMeta = obterConfigMeta(metaAmbiente);
  const convitesUnicos = iniciarConvitesUnicos({
    dataDir,contatos,bloqueios:denuncias,configMeta,grupoInicial:urlGrupo.toString(),agora,
    publicBaseUrl,netlifySecret,recusaAtiva,
  });
  const controleWhatsapp = iniciarControleWhatsapp({
    convites:convitesUnicos,sourceDir,simulacaoWorker:whatsappWorkerTeste,agora,
  });
  const conexaoWhatsapp = iniciarConexaoWhatsapp({
    sourceDir,simulacaoWorker:whatsappWorkerTeste,agora,
  });
  const sincronizacaoNetlify=iniciarSincronizacaoNetlify({
    config:netlifySecret?{publicBaseUrl,segredo:netlifySecret}:null,
    denuncias,agora,
  });
  const gestaoContatos=iniciarGestaoContatos({
    contatos,denuncias,convitesUnicos,campanhas,sincronizacaoNetlify,
    controleWhatsapp,conexaoWhatsapp,agora,
  });
  const envioRapido=iniciarEnvioRapido({
    contatos,denuncias,gestaoContatos,convites:convitesUnicos,agora,
  });
  const respostasBotoes=iniciarRespostasBotoes({
    dataDir,contatos,denuncias,convites:convitesUnicos,agora,
  });
  const sessoes = new Map();
  const limites = new Map();

  function limitar(req, prefixo, maximo = 8) {
    const chave = prefixo + ':' + req.socket.remoteAddress;
    const t = Date.now();
    const atual = limites.get(chave);
    const info = atual && t - atual.iniciado < 3_600_000
      ? atual : { iniciado: t, contador: 0 };
    info.contador += 1;
    limites.set(chave, info);
    // Mantém somente poucas entradas efêmeras na memória, sem registrar IP em arquivo.
    if (limites.size > 2048) limites.clear();
    return info.contador <= maximo;
  }

  function autenticado(req) {
    const token = extrairSessao(req);
    const expira = sessoes.get(token);
    if (!expira) return false;
    if (expira < Date.now()) {
      sessoes.delete(token);
      return false;
    }
    return true;
  }

  function autorizado(req, res, alteracao = false) {
    if (!autenticado(req)) {
      json(res, 401, { ok: false, mensagem: 'Entre com a chave administrativa para continuar.' });
      return false;
    }
    if (alteracao && req.headers['x-cpv-admin'] !== '1') {
      json(res, 403, { ok: false, mensagem: 'Verificação de proteção administrativa necessária.' });
      return false;
    }
    return true;
  }

  // Painel SEM senha somente no próprio computador. Em instalações públicas,
  // em outras interfaces de rede ou com Host adulterado, o acesso é negado.
  // POST exige Origin idêntica e cabeçalho não-simples contra CSRF.
  function acessoCampanhasLocais(req, alteracao = false) {
    const escuta = servidor.address();
    if (!escuta || typeof escuta === 'string' || escuta.address !== '127.0.0.1' ||
        req.socket.remoteAddress !== '127.0.0.1' ||
        req.socket.localAddress !== '127.0.0.1' ||
        req.headers.host !== '127.0.0.1:' + escuta.port) return false;
    const site = req.headers['sec-fetch-site'];
    if (site && site !== 'same-origin' && site !== 'none') return false;
    if (!alteracao) return true;
    return req.headers.origin === 'http://127.0.0.1:' + escuta.port &&
      req.headers['x-cpv-local'] === '1';
  }

  const servidor = createServer(async (req, res) => {
    try {
      const endereco = new URL(req.url ?? '/', 'http://localhost');
      const pathname = endereco.pathname;
      const method = req.method || 'GET';
      const leitura = method === 'GET' || method === 'HEAD';

      if (method === 'POST' && !validarOrigem(req)) {
        json(res, 403, { ok: false, mensagem: 'Origem da solicitação não autorizada.' });
        return;
      }

      if (pathname === '/saude' && leitura) return codigoTexto(res, 200, 'OK');
      if (pathname === '/favicon.svg' && leitura) return codigoTexto(res, 200, renderFavicon(), 'image/svg+xml; charset=utf-8');
      if (scripts.has(pathname) && leitura) return codigoTexto(res, 200, scripts.get(pathname), 'text/javascript; charset=utf-8');
      if (styles.has(pathname) && leitura) return codigoTexto(res,200,styles.get(pathname),'text/css; charset=utf-8');
      if (pathname === '/robots.txt' && leitura) return codigoTexto(res, 200,
        'User-agent: *\nDisallow: /relatorio\nDisallow: /relatorio.csv\nDisallow: /painel\nDisallow: /campanhas\nDisallow: /inicio\nDisallow: /contatos\nDisallow: /denuncias\nDisallow: /api/\nDisallow: /sair\nDisallow: /denunciar\n');

      // Endpoint preparado para o webhook HTTPS oficial da Meta.
      // Nunca libera dados ou contatos sem HMAC valido; sem segredos, fica desativado.
      if (pathname === '/webhooks/whatsapp') {
        if (method === 'GET') {
          if (!configMeta.webhookToken || configMeta.webhookToken.length < 24) {
            return codigoTexto(res, 503, 'Webhook nao configurado');
          }
          const desafio = verificarDesafioMeta(endereco.searchParams, configMeta.webhookToken);
          return desafio === null
            ? codigoTexto(res, 403, 'Verificacao recusada')
            : codigoTexto(res, 200, desafio);
        }
        if (method === 'POST') {
          if (!configMeta.appSecret || !/^[0-9]{6,30}$/.test(configMeta.telefoneId)) {
            return json(res, 503, { ok:false, mensagem:'Webhook nao configurado.' });
          }
          let bytes;
          try { bytes = await corpoAssinado(req); }
          catch { return json(res, 413, { ok:false, mensagem:'Evento acima do limite.' }); }
          if (!verificarAssinaturaMeta(bytes, req.headers['x-hub-signature-256'], configMeta.appSecret)) {
            return json(res, 403, { ok:false, mensagem:'Assinatura Meta invalida.' });
          }
          let payload;
          try { payload = JSON.parse(bytes.toString('utf8')); }
          catch { return json(res, 400, { ok:false, mensagem:'Evento Meta invalido.' }); }
          const eventos = lerEventosMeta(payload, configMeta.telefoneId);
          for (const evento of eventos) {
            if (evento.tipo === 'denuncia' || evento.tipo === 'sair') {
              denuncias.registrar({
                telefone:evento.from, mensagemId:evento.id,
                motivo:evento.tipo === 'denuncia' ? 'denuncia-convite' : 'saida-solicitada',
              });
            } else if (evento.tipo === 'entrar') {
              await convitesUnicos.processarCliqueEntrar({
                telefone:evento.from,mensagemId:evento.id,
              });
            }
          }
          for (const status of lerStatusMeta(payload,configMeta.telefoneId)) {
            convitesUnicos.registrarStatus(status);
          }
          return json(res, 200, { ok:true });
        }
        return codigoTexto(res, 405, 'Metodo nao permitido');
      }

      if (pathname === '/relatorio' || pathname === '/relatorio.csv') {
        if (!leitura) return codigoTexto(res, 405, 'Método não permitido');
        if (!autorizarChave(endereco.searchParams.get('chave'), metricas.chave)) {
          return codigoTexto(res, 403, 'Acesso restrito');
        }
        const dados = metricas.ler();
        return pathname.endsWith('.csv')
          ? codigoTexto(res, 200, convitesCsv(dados), 'text/csv; charset=utf-8')
          : codigoHtml(res, 200, renderRelatorio(dados, metricas.chave));
      }

      if (pathname === '/entrar' && leitura) {
        if (method === 'HEAD') return codigoTexto(res, 405, 'Método não permitido');
        metricas.registrar('cliques', endereco.searchParams.get('origem'));
        res.writeHead(303, {
          location: urlGrupo.toString(), ...headersBase,
        });
        res.end();
        return;
      }

      // O painel de captacao v0.5 foi aposentado. Mantemos apenas os dados e
      // endpoints necessarios ao consentimento. O endereco antigo agora abre
      // o painel de campanhas atual, sem expor acesso externo.
      if (pathname === '/painel' && leitura) {
        if (!acessoCampanhasLocais(req)) return codigoTexto(res, 403,
          'Painel disponivel somente no computador local.');
        res.writeHead(302, {...headersBase,location:'/enviar'});
        return res.end();
      }
      if (['/inicio','/contatos','/denuncias','/respostas-botoes'].includes(pathname) && leitura) {
        if (!acessoCampanhasLocais(req))return codigoTexto(res,403,
          'Área administrativa disponível somente no ACER, via 127.0.0.1.');
        return codigoHtml(res,200,renderGestao(pathname==='/respostas-botoes'?'respostas':pathname.slice(1)));
      }
      if (pathname === '/enviar' && leitura) {
        if (!acessoCampanhasLocais(req))return codigoTexto(res,403,
          'Envio guiado disponível somente no ACER, via 127.0.0.1.');
        return codigoHtml(res,200,renderEnvioRapido(convitesUnicos.configuracao()));
      }
      if (pathname === '/campanhas' && leitura) {
        if (!acessoCampanhasLocais(req)) return codigoTexto(res, 403,
          'Painel de campanhas disponível somente no computador local, via 127.0.0.1.');
        return codigoHtml(res, 200, renderCampanhas());
      }
      if (pathname === '/sair' && leitura) return codigoHtml(res, 200, renderDescadastro());
      // A página pública é inerte até o clique explícito no botão.
      if (pathname === '/denunciar' && leitura) return codigoHtml(res,200,renderDenuncia());
      if (pathname === '/api/denunciar' && method === 'POST') {
        if (!limitar(req,'denuncia-link',30)) return json(res,429,
          {ok:false,mensagem:'Muitas tentativas. Aguarde um pouco.'});
        let entrada;
        try { entrada=await corpoJson(req,1024); }
        catch { return json(res,400,{ok:false,mensagem:'Solicitação inválida.'}); }
        const resultado=denuncias.registrarCliqueDenuncia(entrada.token);
        return resultado.encontrado
          ? json(res,200,{ok:true,registrada:true,bloqueado:true})
          : json(res,404,{ok:false,mensagem:'Este link de denúncia não foi encontrado.'});
      }

      if (pathname === '/api/cadastro' && method === 'POST') {
        if (!limitar(req, 'cadastro', 10)) {
          return json(res, 429, { ok: false, mensagem: 'Muitas solicitações. Tente novamente mais tarde.' });
        }
        let entrada;
        try { entrada = await corpoJson(req); }
        catch { return json(res, 400, { ok: false, mensagem: 'Dados inválidos para cadastro.' }); }
        try {
          const dados = contatos.cadastrar(entrada);
          return json(res, 200, { ok: true, ...dados });
        } catch (error) {
          return json(res, 400, { ok: false, mensagem: error.message });
        }
      }
      if (pathname === '/api/descadastro' && method === 'POST') {
        if (!limitar(req, 'descadastro', 15)) {
          return json(res, 429, { ok: false, mensagem: 'Tente novamente mais tarde.' });
        }
        let entrada;
        try { entrada = await corpoJson(req); }
        catch { return json(res, 400, { ok: false, mensagem: 'Dados inválidos.' }); }
        return contatos.descadastrarPorToken(entrada.token)
          ? json(res, 200, { ok: true })
          : json(res, 404, { ok: false, mensagem: 'Link de descadastro não encontrado.' });
      }

      // Ponte privada do monitor WhatyGo (somente processo local autorizado).
      // Nunca aceitar cookies, Origin de navegador ou mensagens sem chave.
      if (pathname === '/api/local/whatygo/evento') {
        if (method !== 'POST')return codigoTexto(res,405,'Método não permitido');
        if (req.socket.remoteAddress!=='127.0.0.1' ||
            req.socket.localAddress!=='127.0.0.1' ||
            req.headers.host!=='127.0.0.1:'+servidor.address()?.port ||
            req.headers.origin ||
            !respostasBotoes.checkBridgeKey(req.headers['x-cpv-whatygo'])) {
          return json(res,403,{ok:false,mensagem:'Ponte local não autorizada.'});
        }
        try {
          const entrada=await corpoJson(req,4096);
          const resultado=respostasBotoes.receive(entrada);
          return json(res,200,resultado);
        }catch {
          return json(res,400,{ok:false,mensagem:'Evento de botão inválido.'});
        }
      }
      if (pathname === '/api/local/whatygo/respostas' && leitura) {
        if(!acessoCampanhasLocais(req))return json(res,403,{ok:false,mensagem:'Somente no computador local.'});
        return json(res,200,{ok:true,...respostasBotoes.list()});
      }

      // Visão gerencial restrita à instalação local, sem dados pessoais no Netlify.
      if (pathname.startsWith('/api/local/gestao/')){
        if (!acessoCampanhasLocais(req,method==='POST'))
          return json(res,403,{ok:false,mensagem:'Acesso permitido apenas no painel local.'});
        try{
          if (pathname === '/api/local/gestao/contatos' && leitura)
            return json(res,200,{ok:true,...gestaoContatos.listar({
              filtro:endereco.searchParams.get('filtro')||'todos',
              busca:endereco.searchParams.get('busca')||'',
              pagina:Number(endereco.searchParams.get('pagina')||1),
              limite:15,
            })});
          if (pathname === '/api/local/gestao/contato' && leitura)
            return json(res,200,{ok:true,contato:gestaoContatos.detalhe(
              endereco.searchParams.get('id'))});
          if (pathname === '/api/local/gestao/resumo' && leitura){
            const todas=convitesUnicos.listarFilas();
            const eventos=denuncias.listar();
            return json(res,200,{ok:true,contatos:gestaoContatos.resumo(),
              filas:{total:todas.length,web:todas.filter(f=>f.modo==='web').length,
                pendentes:todas.reduce((n,f)=>n+(f.pendentes||0),0)},
              whatsapp:{fase:controleWhatsapp.estado().fase},
              denuncias:eventos.filter(e=>e.motivo==='denuncia-convite').slice(0,5),
              sincronizacao:sincronizacaoNetlify.estado()});
          }
          if (pathname === '/api/local/gestao/denuncias' && leitura)
            return json(res,200,{ok:true,ocorrencias:denuncias.listar(),
              resumo:denuncias.resumo(),sincronizacao:sincronizacaoNetlify.estado()});
          if (pathname === '/api/local/gestao/contato/bloquear' && method==='POST'){
            if(!limitar(req,'gestao-bloquear',25))
              return json(res,429,{ok:false,mensagem:'Limite de bloqueios atingido.'});
            const entrada=await corpoJson(req,1500);
            return json(res,200,{ok:true,resultado:gestaoContatos.bloquear(entrada)});
          }
          if (pathname === '/api/local/gestao/contato/desbloquear' && method==='POST'){
            if(!limitar(req,'gestao-desbloquear',12))
              return json(res,429,{ok:false,mensagem:'Limite de reativações atingido.'});
            const entrada=await corpoJson(req,1500);
            return json(res,200,{ok:true,
              resultado:await gestaoContatos.desbloquear(entrada)});
          }
          return json(res,method==='GET'?404:405,
            {ok:false,mensagem:'Recurso de gestão não encontrado.'});
        }catch(erro){
          return json(res,400,{ok:false,mensagem:erro.message});
        }
      }

      // As campanhas têm um fluxo local sem senha; o CRM administrativo e
      // suas demais APIs continuam exigindo autenticação como antes.
      if (pathname === '/api/local/campanhas' ||
          pathname.startsWith('/api/local/campanhas/')) {
        if (!acessoCampanhasLocais(req, method === 'POST')) {
          return json(res, 403, { ok: false,
            mensagem: 'Operação permitida somente neste computador e nesta página local.' });
        }
        if (pathname === '/api/local/campanhas' && leitura) {
          return json(res, 200, { ok: true, campanhas: campanhas.listar() });
        }
        if (pathname === '/api/local/campanhas/meta' && leitura) {
          return json(res, 200, { ok:true, integracao:resumoMeta(configMeta),
            denuncias:denuncias.resumo() });
        }
        if (pathname === '/api/local/campanhas/denuncias' && leitura) {
          return json(res, 200, { ok:true, ocorrencias:denuncias.listar(),
            sincronizacao:sincronizacaoNetlify.estado() });
        }
        if (pathname === '/api/local/campanhas/rapido/contatos' && leitura) {
          if(!limitar(req,'rapido-busca',120))return json(res,429,
            {ok:false,mensagem:'Muitas consultas de contatos. Aguarde.'});
          return json(res,200,{ok:true,...envioRapido.buscar({
            termo:endereco.searchParams.get('busca'),
          })});
        }
        if (pathname === '/api/local/campanhas/convite/modelo' && leitura) {
          return json(res, 200, { ok:true, configuracao:convitesUnicos.configuracao(),
            modeloMeta:convitesUnicos.templateParaMeta() });
        }
        if (pathname === '/api/local/campanhas/convite/filas' && leitura) {
          return json(res, 200, { ok:true, filas:convitesUnicos.listarFilas() });
        }
        if (pathname === '/api/local/campanhas/convite/manual/estatisticas' && leitura) {
          return json(res, 200, {ok:true,controle:convitesUnicos.estatisticasManual()});
        }
        if (pathname === '/api/local/campanhas/convite/whatsapp/estado' && leitura) {
          return json(res, 200, {ok:true,estado:controleWhatsapp.estado()});
        }
        if (pathname === '/api/local/campanhas/convite/whatsapp/conexao/estado' && leitura) {
          return json(res, 200, {ok:true,estado:conexaoWhatsapp.estado()});
        }
        if (pathname === '/api/local/campanhas/convite/fila' && leitura) {
          try {return json(res, 200, {ok:true,
            fila:convitesUnicos.detalhesFila(endereco.searchParams.get('id'))});}
          catch(erro){return json(res,404,{ok:false,mensagem:erro.message});}
        }
        if (pathname === '/api/local/campanhas/convite/validacao' && leitura) {
          if (!limitar(req,'meta-validacao',60))return json(res,429,
            {ok:false,mensagem:'Limite de verificacoes atingido.'});
          try {return json(res, 200, {ok:true,validacao:await convitesUnicos.conferirModelo()});}
          catch {return json(res, 502, {ok:false,
            mensagem:'Nao foi possivel verificar o modelo na Meta.'});}
        }
        if (pathname === '/api/local/campanhas/destinatarios' && leitura) {
          return json(res, 200, { ok: true, destinatarios: campanhas.destinatarios() });
        }
        if (pathname === '/api/local/campanhas/configuracao' && leitura) {
          const resumo = contatos.resumo();
          return json(res, 200, { ok: true, remetente: resumo.remetente,
            remetenteConfigurado: resumo.remetenteConfigurado });
        }
        if (pathname === '/api/local/campanhas/detalhe' && leitura) {
          try {
            return json(res, 200, { ok: true, campanha: campanhas.obter(endereco.searchParams.get('id')) });
          } catch (erro) { return json(res, 404, { ok: false, mensagem: erro.message }); }
        }
        if (method !== 'POST') return json(res, 405, {
          ok: false, mensagem: 'Método não permitido para campanhas.' });
        if (!limitar(req, 'campanhas-locais', 4500)) {
          return json(res, 429, { ok: false, mensagem: 'Limite de operações locais atingido.' });
        }
        let dados;
        try {
          dados = await corpoJson(req,
            pathname === '/api/local/campanhas' ||
            pathname === '/api/local/campanhas/convite/fila'
              ? 90_000 : pathname === '/api/local/campanhas/importar-autorizados'
                ? 24_000 : 4096);
        } catch {
          return json(res, 400, { ok: false, mensagem: 'Dados inválidos para campanhas.' });
        }
        try {
          if (pathname === '/api/local/campanhas/rapido/consultar') {
            if(!limitar(req,'rapido-consulta',100))return json(res,429,
              {ok:false,mensagem:'Muitas verificações de números. Aguarde.'});
            return json(res,200,{ok:true,contato:envioRapido.consultar(dados)});
          }
          if (pathname === '/api/local/campanhas/rapido/cadastrar') {
            if(!limitar(req,'rapido-cadastro',12))return json(res,429,
              {ok:false,mensagem:'Limite de cadastros individuais atingido.'});
            return json(res,200,{ok:true,...envioRapido.cadastrarProprio(dados)});
          }
          if (pathname === '/api/local/campanhas/rapido/criar') {
            if(!limitar(req,'rapido-criar',25))return json(res,429,
              {ok:false,mensagem:'Limite de convites individuais atingido.'});
            if(conexaoWhatsapp.estado().ocupado||controleWhatsapp.estado().processoAtivo)
              return json(res,409,{ok:false,
                mensagem:'Finalize a janela atual do WhatsApp antes de começar outra.'});
            return json(res,200,{ok:true,...envioRapido.criar(dados)});
          }
          if (pathname === '/api/local/campanhas') {
            if (!limitar(req, 'campanhas-locais-criar', 30)) {
              return json(res, 429, { ok: false, mensagem: 'Limite de criação de campanhas atingido.' });
            }
            return json(res, 200, { ok: true, campanha: campanhas.criar(dados) });
          }
          if (pathname === '/api/local/campanhas/importar-autorizados') {
            if (!limitar(req,'campanhas-importar-consentimento',50)) {
              return json(res,429,{ok:false,
                mensagem:'Muitos lotes importados nesta hora. Aguarde para continuar.'});
            }
            // Apenas contatos que o operador declara ter autorizado a publicidade.
            // A origem e a data ficam documentadas e SAIR/denuncia nunca e reativado.
            return json(res,200,{ok:true,
              resultado:contatos.importarConsentimentosExternos({
                ...dados,verificarBloqueio:telefone=>denuncias.estaBloqueado(telefone),
              })});
          }
          if (pathname === '/api/local/campanhas/denuncias/sincronizar') {
            if (!limitar(req,'denuncia-netlify-sincronizacao',25))
              return json(res,429,{ok:false,mensagem:'Muitas sincronizações solicitadas.'});
            const resultado=await sincronizacaoNetlify.sincronizar();
            return json(res,resultado.ok?200:503,
              {ok:resultado.ok,resultado,mensagem:resultado.mensagem});
          }
          if (pathname === '/api/local/campanhas/convite/modelo') {
            return json(res, 200, {ok:true,
              configuracao:convitesUnicos.salvarConfiguracao(dados)});
          }
          if (pathname === '/api/local/campanhas/convite/simular') {
            return json(res, 200, {ok:true,simulacao:convitesUnicos.simular(dados)});
          }
          if (pathname === '/api/local/campanhas/convite/fila') {
            if (!limitar(req,'convite-criar',30))return json(res,429,
              {ok:false,mensagem:'Limite de criacao de filas atingido.'});
            return json(res, 200, {ok:true,fila:convitesUnicos.criarFila(dados)});
          }
          if (pathname === '/api/local/campanhas/convite/fila/usar-web') {
            if (!limitar(req,'convite-converter-web',20))return json(res,429,
              {ok:false,mensagem:'Limite de conversoes de filas atingido.'});
            return json(res,200,{ok:true,
              fila:convitesUnicos.converterFilaParaWeb(dados)});
          }
          if (pathname === '/api/local/campanhas/convite/fila/limpar') {
            if (!limitar(req,'convite-limpar-uma',10))return json(res,429,
              {ok:false,mensagem:'Limite de limpezas de fila atingido.'});
            if (controleWhatsapp.estado().processoAtivo || conexaoWhatsapp.estado().ocupado) {
              return json(res,409,{ok:false,
                mensagem:'Existe uma conversa aberta no WhatsApp. Finalize ou cancele antes de limpar esta fila.'});
            }
            return json(res,200,{ok:true,
              resultado:convitesUnicos.limparFilaSelecionada(dados)});
          }
          if (pathname === '/api/local/campanhas/convite/filas/limpar') {
            if (!limitar(req,'convite-limpar',5))return json(res,429,
              {ok:false,mensagem:'Limite de limpezas de fila atingido.'});
            if (controleWhatsapp.estado().processoAtivo || conexaoWhatsapp.estado().ocupado) {
              return json(res,409,{ok:false,
                mensagem:'Há uma janela do WhatsApp ativa. Finalize ou cancele a conversa antes de limpar as filas.'});
            }
            return json(res,200,{ok:true,
              resultado:convitesUnicos.limparFilasPendentes(dados)});
          }
          if (pathname === '/api/local/campanhas/convite/enviar') {
            if (!limitar(req,'convite-enviar',100))return json(res,429,
              {ok:false,mensagem:'Limite de requisicoes de envio atingido.'});
            return json(res, 200, {ok:true,resultado:await convitesUnicos.processarLote(dados)});
          }
          if (pathname === '/api/local/campanhas/convite/manual/preparar') {
            return json(res, 200, {ok:true,conversa:convitesUnicos.prepararManual(dados)});
          }
          if (pathname === '/api/local/campanhas/convite/whatsapp/conexao/abrir') {
            if (!limitar(req,'whatsapp-conexao-abrir',12))return json(res,429,
              {ok:false,mensagem:'Muitas tentativas de abrir a sessão do WhatsApp.'});
            if (controleWhatsapp.estado().ocupado) {
              return json(res,409,{ok:false,
                mensagem:'Finalize a conversa atual antes de abrir a conexão.'});
            }
            return json(res,202,{ok:true,estado:conexaoWhatsapp.abrir()});
          }
          if (pathname === '/api/local/campanhas/convite/whatsapp/conexao/fechar') {
            return json(res,202,{ok:true,estado:conexaoWhatsapp.fechar()});
          }
          if (pathname === '/api/local/campanhas/convite/whatsapp/preparar') {
            if (!limitar(req,'whatsapp-preparar',60))return json(res,429,
              {ok:false,mensagem:'Limite de preparacoes atingido.'});
            if (conexaoWhatsapp.estado().ocupado) {
              return json(res,409,{ok:false,
                mensagem:'Finalize a conexão do WhatsApp Web antes de preparar um convite.'});
            }
            return json(res, 202, {ok:true,estado:controleWhatsapp.iniciar(dados)});
          }
          if (pathname === '/api/local/campanhas/convite/whatsapp/enviar') {
            return json(res, 202, {ok:true,estado:controleWhatsapp.enviar(dados)});
          }
          if (pathname === '/api/local/campanhas/convite/whatsapp/cancelar') {
            return json(res, 202, {ok:true,estado:controleWhatsapp.cancelar(dados)});
          }
          if (pathname === '/api/local/campanhas/convite/whatsapp/conciliar') {
            if (controleWhatsapp.estado().ocupado) {
              return json(res, 409, {ok:false,
                mensagem:'Aguarde o Chrome terminar antes de conciliar uma tentativa.'});
            }
            return json(res, 200, {ok:true,
              resultado:convitesUnicos.conciliarTentativa(dados)});
          }
          if (pathname === '/api/local/campanhas/convite/manual/registrar') {
            return json(res, 200, {ok:true,resultado:convitesUnicos.marcarManual(dados)});
          }
          if (pathname === '/api/local/campanhas/remetente') {
            return json(res, 200, { ok: true,
              remetente: contatos.configurarRemetente(dados.telefone) });
          }
          if (pathname === '/api/local/campanhas/preparar') {
            return json(res, 200, { ok: true, mensagem: campanhas.prepararMensagem(dados) });
          }
          if (pathname === '/api/local/campanhas/registrar') {
            return json(res, 200, { ok: true, resultado: campanhas.registrar(dados) });
          }
          if (pathname === '/api/local/campanhas/ignorar') {
            return json(res, 200, { ok: true, resultado: campanhas.ignorar(dados) });
          }
          if (pathname === '/api/local/campanhas/descadastrar') {
            return json(res, 200, { ok: contatos.descadastrarPorId(dados.id) });
          }
        } catch (erro) {
          return json(res, 409, { ok: false, mensagem: erro.message });
        }
        return json(res, 404, { ok: false, mensagem: 'Ação de campanha inexistente.' });
      }

      if (pathname === '/api/admin/login' && method === 'POST') {
        if (!limitar(req, 'admin-login', 12)) {
          return json(res, 429, { ok: false, mensagem: 'Muitas tentativas de login; tente mais tarde.' });
        }
        let dados;
        try { dados = await corpoJson(req); }
        catch { return json(res, 400, { ok: false, mensagem: 'Requisição inválida.' }); }
        if (!autorizarChave(dados.chave, metricas.chave)) {
          return json(res, 401, { ok: false, mensagem: 'Chave administrativa incorreta.' });
        }
        const token = randomBytes(32).toString('hex');
        sessoes.set(token, Date.now() + 8 * 3_600_000);
        const secure = req.socket.encrypted || process.env.CAPTACAO_PUBLIC_HTTPS === 'true';
        const cookie = `cpv_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure ? '; Secure' : ''}`;
        return json(res, 200, { ok: true }, { 'set-cookie': cookie });
      }
      if (pathname === '/api/admin/logout' && method === 'POST') {
        if (!autorizado(req, res, true)) return;
        sessoes.delete(extrairSessao(req));
        return json(res, 200, { ok: true }, { 'set-cookie': 'cpv_admin=; Max-Age=0; Path=/; SameSite=Strict; HttpOnly' });
      }
      if (pathname.startsWith('/api/admin/')) {
        if (!autorizado(req, res, method === 'POST')) return;
        if (pathname === '/api/admin/resumo' && leitura) {
          const dados = metricas.ler();
          const campanhas = dados.campanhas;
          return json(res, 200, {
            ok: true,
            contatos: contatos.resumo(),
            metricas: {
              totalVisitas: Object.values(campanhas).reduce((s, x) => s + x.visitas, 0),
              totalCliques: Object.values(campanhas).reduce((s, x) => s + x.cliques, 0),
              campanhas,
            },
          });
        }
        if (pathname === '/api/admin/contatos' && leitura) return json(res, 200, { ok: true, contatos: contatos.listar() });
        if (pathname === '/api/admin/campanhas/destinatarios' && leitura) {
          return json(res, 200, { ok: true, destinatarios: campanhas.destinatarios() });
        }
        if (pathname === '/api/admin/campanhas' && leitura) {
          return json(res, 200, { ok: true, campanhas: campanhas.listar() });
        }
        if (pathname === '/api/admin/campanhas/detalhe' && leitura) {
          try {
            return json(res, 200, { ok: true, campanha: campanhas.obter(endereco.searchParams.get('id')) });
          } catch (erro) {return json(res, 404, { ok: false, mensagem: erro.message });}
        }
        if (pathname === '/api/admin/grupos' && leitura) return json(res, 200, { ok: true, grupos: grupos.listar() });
        if (pathname === '/api/admin/importados' && leitura) {
          return json(res, 200, { ok: true, ...importacoes.listar() });
        }
        if (pathname === '/api/admin/importados.csv' && leitura) {
          let origem = null;
          if (endereco.searchParams.has('origem')) {
            try { origem = validarOrigemGrupo(endereco.searchParams.get('origem')); }
            catch { return codigoTexto(res, 400, 'Origem inválida.'); }
          }
          const csv = importacoes.exportarCsv(origem);
          res.writeHead(200, {
            ...headersBase,
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': 'attachment; filename="participantes-importados.csv"',
          });
          return res.end(csv);
        }
        if (pathname === '/api/admin/modelo.xlsx' && leitura) {
          res.writeHead(200, {
            ...headersBase,
            'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'content-disposition': 'attachment; filename="Modelo_Contatos_Autorizados.xlsx"',
          });
          return res.end(planilhaModelo);
        }
        if (pathname === '/api/admin/contatos.csv' && leitura) {
          let origemFiltro = null;
          if (endereco.searchParams.has('origem')) {
            try { origemFiltro = validarOrigemGrupo(endereco.searchParams.get('origem')); }
            catch { return codigoTexto(res, 400, 'Origem inválida para exportação.'); }
          }
          // Gerar e validar os dados antes de enviar cabeçalhos para a resposta.
          const csv = contatos.exportarCsv(origemFiltro);
          res.writeHead(200, {
            ...headersBase,
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': 'attachment; filename="contatos-autorizados.csv"',
          });
          return res.end(csv);
        }
        if (pathname === '/api/admin/convite' && leitura) {
          try { return json(res, 200, { ok: true, ...contatos.prepararMensagem(endereco.searchParams.get('id')) }); }
          catch (error) { return json(res, 409, { ok: false, mensagem: error.message }); }
        }
        if (method === 'POST') {
          let dados;
          try { dados = await corpoJson(req, (pathname === '/api/admin/importados' || pathname === '/api/admin/importados/previa') ? 128_000 : pathname === '/api/admin/campanhas' ? 90_000 : 4096); }
          catch { return json(res, 400, { ok: false, mensagem: 'Dados JSON inválidos ou acima do tamanho permitido.' }); }
          try {
            if (pathname === '/api/admin/campanhas') {
              if (!limitar(req, 'campanhas-criar', 30)) {
                return json(res, 429, { ok: false, mensagem: 'Muitas campanhas criadas. Tente mais tarde.' });
              }
              return json(res, 200, { ok: true, campanha: campanhas.criar(dados) });
            }
            if (pathname === '/api/admin/campanhas/preparar') {
              if (!limitar(req, 'campanhas-preparar', 150)) {
                return json(res, 429, { ok: false, mensagem: 'Muitas mensagens preparadas.' });
              }
              return json(res, 200, { ok: true, mensagem: campanhas.prepararMensagem(dados) });
            }
            if (pathname === '/api/admin/campanhas/registrar') {
              return json(res, 200, { ok: true, resultado: campanhas.registrar(dados) });
            }
            if (pathname === '/api/admin/campanhas/ignorar') {
              return json(res, 200, { ok: true, resultado: campanhas.ignorar(dados) });
            }
            if (pathname === '/api/admin/importados/previa') {
              if (!limitar(req, 'admin-previa', 60)) {
                return json(res, 429, { ok: false, mensagem: 'Muitas prévias. Tente novamente mais tarde.' });
              }
              const grupo = grupos.listar().find(item => item.id === dados.grupoId);
              if (!grupo) throw new Error('Selecione um grupo cadastrado antes de conferir os números.');
              return json(res, 200, { ok: true, previa: importacoes.simular({ ...dados, origem: grupo.origem }) });
            }
            if (pathname === '/api/admin/importados') {
              if (!limitar(req, 'admin-importacao', 20)) return json(res, 429, { ok: false, mensagem: 'Muitas importações. Tente novamente mais tarde.' });
              const grupo = grupos.listar().find(item => item.id === dados.grupoId);
              if (!grupo) throw new Error('Cadastre e selecione um grupo de origem antes de importar.');
              const resultado = importacoes.importar({ ...dados, origem: grupo.origem });
              return json(res, 200, { ok: true, resultado });
            }
            if (pathname === '/api/admin/importados/excluir') {
              return json(res, 200, { ok: importacoes.excluir(dados.id) });
            }
            if (pathname === '/api/admin/grupos') {
              return json(res, 200, { ok: true, grupo: grupos.cadastrar(dados) });
            }
            if (pathname === '/api/admin/grupos/permissao') {
              return json(res, 200, { ok: true, grupo: grupos.alterarPermissao(dados) });
            }
            if (pathname === '/api/admin/grupos/excluir') {
              return json(res, 200, { ok: grupos.excluir(dados.id) });
            }
            if (pathname === '/api/admin/remetente') {
              return json(res, 200, { ok: true, remetente: contatos.configurarRemetente(dados.telefone) });
            }
            if (pathname === '/api/admin/confirmar') {
              return json(res, 200, { ok: true, id: contatos.confirmar(dados) });
            }
            if (pathname === '/api/admin/descadastrar') {
              return json(res, 200, { ok: contatos.descadastrarPorId(dados.id) });
            }
            if (pathname === '/api/admin/excluir') {
              return json(res, 200, { ok: contatos.excluirPorId(dados.id) });
            }
            if (pathname === '/api/admin/registrar-envio') {
              return json(res, 200, { ok: true, enviadoEm: contatos.marcarEnvioManual(dados.id) });
            }
          } catch (error) {
            return json(res, 409, { ok: false, mensagem: error.message });
          }
        }
        return json(res, 404, { ok: false, mensagem: 'Ação administrativa desconhecida.' });
      }

      if (pathname === '/' && leitura && acessoCampanhasLocais(req)) {
        // Links publicos de opt-in /c/<origem> permanecem operacionais.
        res.writeHead(302, {...headersBase,location:'/enviar'});
        return res.end();
      }
      if ((pathname === '/' || pathname.startsWith('/c/')) && leitura) {
        if (method === 'HEAD') {
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
          return res.end();
        }
        const origem = pathname.startsWith('/c/')
          ? normalizarOrigem(pathname.slice(3))
          : normalizarOrigem(endereco.searchParams.get('origem'));
        metricas.registrar('visitas', origem);
        return codigoHtml(res, 200, renderLanding(origem));
      }
      if (!leitura) return codigoTexto(res, 405, 'Método não permitido');
      return codigoTexto(res, 404, 'Página não encontrada');
    } catch (error) {
      console.error('Erro interno do piloto:', error.message);
      return json(res, 500, { ok: false, mensagem: 'Erro interno. Consulte o administrador.' });
    }
  });
  servidor.on('close',()=>sincronizacaoNetlify.parar());
  return {servidor,chave:metricas.chave,contatos,grupos,sincronizacaoNetlify};
}

export async function iniciarServidor({
  port = Number(process.env.PORT ?? 3040),
  host = process.env.HOST ?? '127.0.0.1',
  dataDir = process.env.DATA_DIR ?? join(sourceDir, '..', 'dados'),
  inviteUrl = process.env.CAPTACAO_GROUP_URL ?? GROUP_URL,
  metaAmbiente = process.env,
  publicBaseUrl = process.env.CAPTACAO_PUBLIC_BASE_URL || '',
  whatsappWorkerTeste = false,
  agora,
} = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('Porta inválida');
  }
  const confNetlify=lerConfigNetlify(dataDir,metaAmbiente);
  const urlEfetiva=confNetlify?.publicBaseUrl||publicBaseUrl;
  const { servidor, chave, contatos, sincronizacaoNetlify } = criarPiloto({
    dataDir,inviteUrl,agora,metaAmbiente,whatsappWorkerTeste,
    publicBaseUrl:urlEfetiva,netlifySecret:confNetlify?.segredo||'',
    recusaAtiva:confNetlify?.recusaAtiva===true,
  });
  await new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(port, host, resolve);
  });
  sincronizacaoNetlify.iniciar();
  const endereco = servidor.address();
  const base = `http://${host}:${endereco.port}`;
  return { servidor, base, chave, contatos };
}

const arquivoPrincipal = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (arquivoPrincipal) {
  iniciarServidor().then(({ base }) => {
    console.log('\n=== CAÇA PROMOS VIP — CAPTAÇÃO VOLUNTÁRIA 0.5 ===');
    console.log('Página de convite: ' + base + '/c/instagram');
    console.log('Painel de campanhas: ' + base + '/campanhas');
    console.log('Relatório existente continua disponível pelo atalho privado.');
    console.log('A chave administrativa está em dados/chave-admin.txt (não divulgue).');
    console.log('Nenhuma mensagem é enviada automaticamente.');
    console.log('Um cadastro só vira autorizado após confirmação recebida no segundo WhatsApp.');
    console.log('\nPressione Ctrl+C para encerrar.\n');
  }).catch(error => {
    console.error('Não foi possível iniciar o piloto:', error.message);
    process.exitCode = 1;
  });
}
