/**
 * Consultas administrativas de leitura, sem servidor HTTP nem autenticação.
 * IMPORTANTE: só chamar depois de acessoCampanhasLocais no server.mjs.
 * Nunca adicionar aqui ações de envio, bloqueio ou reativação.
 */
export function consultarGestaoLocal({
  pathname, busca,
  gestaoContatos, convitesUnicos, denuncias, controleWhatsapp, sincronizacaoNetlify
}) {
  if (pathname === '/api/local/gestao/contatos') {
    return { status: 200, body: {
      ok: true, ...gestaoContatos.listar({
        filtro: busca.get('filtro') || 'todos',
        busca: busca.get('busca') || '',
        pagina: Number(busca.get('pagina') || 1),
        limite: 15,
      })
    } };
  }

  if (pathname === '/api/local/gestao/contato') {
    return { status: 200, body: {
      ok: true, contato: gestaoContatos.detalhe(busca.get('id'))
    } };
  }

  if (pathname === '/api/local/gestao/resumo') {
    const todas = convitesUnicos.listarFilas();
    const eventos = denuncias.listar();
    return { status: 200, body: {
      ok: true, contatos: gestaoContatos.resumo(),
      filas: {
        total: todas.length,
        web: todas.filter(f => f.modo === 'web').length,
        pendentes: todas.reduce((n, f) => n + (f.pendentes || 0), 0)
      },
      whatsapp: { fase: controleWhatsapp.estado().fase },
      denuncias: eventos.filter(e => e.motivo === 'denuncia-convite').slice(0, 5),
      sincronizacao: sincronizacaoNetlify.estado()
    } };
  }

  if (pathname === '/api/local/gestao/denuncias') {
    return { status: 200, body: {
      ok: true, ocorrencias: denuncias.listar(),
      resumo: denuncias.resumo(), sincronizacao: sincronizacaoNetlify.estado()
    } };
  }

  return null;
}
