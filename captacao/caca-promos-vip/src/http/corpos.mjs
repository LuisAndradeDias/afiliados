/** Limites de leitura mantidos para payloads administrativos e webhooks. */
export async function corpoJson(req, limiteBytes = 4096) {
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

export async function corpoAssinado(req, limiteBytes = 256_000) {
  const partes=[];
  let bytes=0;
  for await (const pedaco of req) {
    bytes += pedaco.length;
    if (bytes > limiteBytes) throw new Error('Evento acima do limite permitido.');
    partes.push(pedaco);
  }
  return Buffer.concat(partes);
}

