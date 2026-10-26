/** Cabeçalhos, CSP e formatos HTTP usados por rotas públicas e locais. */
export const headersBase = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'cross-origin-resource-policy': 'same-origin',
};

export function codigoHtml(res, status, html) {
  res.writeHead(status, {
    ...headersBase,
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': "default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  });
  res.end(html);
}

export function codigoTexto(res, status, texto, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { ...headersBase, 'content-type': contentType });
  res.end(texto);
}

export function json(res, status, valor, extraHeaders = {}) {
  res.writeHead(status, {
    ...headersBase,
    'content-type': 'application/json; charset=utf-8',
    ...extraHeaders,
  });
  res.end(JSON.stringify(valor));
}

