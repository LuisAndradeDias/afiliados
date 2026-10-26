/** Utilitários puros de origem e token de sessão; não emitem permissões. */
export function validarOrigem(req) {
  const origem = req.headers.origin;
  if (!origem) return true;
  try {
    const parsed = new URL(origem);
    return parsed.host === req.headers.host && (parsed.protocol === 'http:' || parsed.protocol === 'https:');
  } catch {
    return false;
  }
}

export function extrairSessao(req) {
  const cookies = String(req.headers.cookie || '').split(';').map(v => v.trim());
  const item = cookies.find(v => /^cpv_admin=[0-9a-f]{64}$/.test(v));
  return item ? item.slice('cpv_admin='.length) : '';
}

