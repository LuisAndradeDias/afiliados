import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

/**
 * The public tunnel must NEVER point to the unprotected promotions dashboard.
 * Expose only this one-use OAuth callback endpoint. No secrets are logged here.
 */
const CALLBACK = '/oauth/mercadolivre/callback';
const RETURN_LOCAL = 'http://127.0.0.1:3030/?mercadolivre=conectado';
const HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
};
function responder(res, status, message) {
  res.writeHead(status, {
    ...HEADERS,
    'content-type': 'text/plain; charset=utf-8',
  });
  res.end(message);
}
function codigoValido(valor) {
  return typeof valor === 'string' && valor.length >= 6 &&
    valor.length <= 2048 && /^[A-Za-z0-9._~-]+$/.test(valor);
}
function estadoValido(valor) {
  return typeof valor === 'string' && /^[a-f0-9]{48}$/.test(valor);
}

export async function iniciarPonteOAuth({
  port = 3031,
  target = 'http://127.0.0.1:3030',
  fetchImpl = fetch,
} = {}) {
  const dest = new URL(target);
  if (dest.protocol !== 'http:' || dest.hostname !== '127.0.0.1' ||
      !/^[0-9]+$/.test(dest.port) || dest.pathname !== '/' ||
      dest.search || dest.hash || dest.username || dest.password) {
    throw new Error('OAuth target must be a loopback HTTP service.');
  }
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('Invalid bridge port.');
  }

  const server = createServer(async (req, res) => {
    if (req.method !== 'GET') {
      responder(res, 405, 'Somente GET e permitido neste endereco.');
      return;
    }
    const raw = String(req.url ?? '');
    if (raw.length > 3200) {
      responder(res, 414, 'Callback muito longo.');
      return;
    }
    let uri;
    try { uri = new URL(raw, 'http://127.0.0.1'); }
    catch { responder(res, 400, 'Callback invalido.'); return; }
    if (uri.pathname !== CALLBACK) {
      responder(res, 404, 'Endereco indisponivel. Use o painel local.');
      return;
    }
    if (uri.searchParams.has('error')) {
      responder(res, 400, 'Autorizacao do Mercado Livre nao foi concluida. Volte ao painel.');
      return;
    }
    const code = uri.searchParams.get('code');
    const state = uri.searchParams.get('state');
    const keys = [...uri.searchParams.keys()];
    if (keys.length !== 2 || !keys.includes('code') || !keys.includes('state') ||
        !codigoValido(code) || !estadoValido(state)) {
      responder(res, 400, 'Retorno incompleto. Inicie a autorizacao pelo painel local.');
      return;
    }
    try {
      // Construct a new local URL: never use arbitrary public Host or forwarded headers.
      const local = new URL(CALLBACK, target);
      local.searchParams.set('code', code);
      local.searchParams.set('state', state);
      const upstream = await fetchImpl(local, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(35_000),
        headers: { accept: 'text/html' },
      });
      if (upstream.status === 302 &&
          upstream.headers.get('location') === '/?mercadolivre=conectado') {
        res.writeHead(302, { ...HEADERS, location: RETURN_LOCAL });
        res.end();
        return;
      }
      // Do not echo upstream bodies, codes, query strings or any credentials.
      console.error('OAuth bridge: local callback did not confirm (HTTP ' +
        String(upstream.status) + ').');
      responder(res, 502,
        'O Mercado Livre retornou, mas o painel local nao concluiu o login. ' +
        'Confirme as credenciais e inicie uma nova autorizacao.');
    } catch (error) {
      console.error('OAuth bridge: callback connection failed (' +
        (error?.name === 'TimeoutError' ? 'timeout' : 'unavailable') + ').');
      responder(res, 502,
        'O painel local nao respondeu. Confirme se a Central de Ofertas esta aberta.');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const addr = server.address();
  return { server, address: 'http://127.0.0.1:' + addr.port };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  iniciarPonteOAuth().then(({address}) => {
    console.log('Mercado Livre OAuth-only bridge ready at ' + address);
    console.log('No promotions dashboard or WhatsApp routes are publicly exposed.');
  }).catch(() => {
    console.error('OAuth-only bridge could not start.');
    process.exitCode = 1;
  });
}
