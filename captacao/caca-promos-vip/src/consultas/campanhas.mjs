/**
 * Respostas para consultas locais GET/HEAD de campanhas e convites.
 * Não fornece autorização HTTP e não implementa POSTs ou envios.
 * O server.mjs faz Host/Origin/CSRF e rate limits ANTES de usar este módulo.
 */
export function consultarCampanhasLocais({
  pathname, busca, campanhas, convitesUnicos, denuncias,
  sincronizacaoNetlify, contatoResumo, controleWhatsapp,
  conexaoWhatsapp, configMeta, resumoMeta
}) {
  if (pathname === '/api/local/campanhas') {
    return { status: 200, body: { ok: true, campanhas: campanhas.listar() } };
  }
  if (pathname === '/api/local/campanhas/meta') {
    return { status: 200, body: {
      ok: true, integracao: resumoMeta(configMeta), denuncias: denuncias.resumo()
    } };
  }
  if (pathname === '/api/local/campanhas/denuncias') {
    return { status: 200, body: {
      ok: true, ocorrencias: denuncias.listar(), sincronizacao: sincronizacaoNetlify.estado()
    } };
  }
  if (pathname === '/api/local/campanhas/convite/modelo') {
    return { status: 200, body: {
      ok: true, configuracao: convitesUnicos.configuracao(),
      modeloMeta: convitesUnicos.templateParaMeta()
    } };
  }
  if (pathname === '/api/local/campanhas/convite/filas') {
    return { status: 200, body: { ok: true, filas: convitesUnicos.listarFilas() } };
  }
  if (pathname === '/api/local/campanhas/convite/manual/estatisticas') {
    return { status: 200, body: {
      ok: true, controle: convitesUnicos.estatisticasManual()
    } };
  }
  if (pathname === '/api/local/campanhas/convite/whatsapp/estado') {
    return { status: 200, body: { ok: true, estado: controleWhatsapp.estado() } };
  }
  if (pathname === '/api/local/campanhas/convite/whatsapp/conexao/estado') {
    return { status: 200, body: { ok: true, estado: conexaoWhatsapp.estado() } };
  }
  if (pathname === '/api/local/campanhas/convite/fila') {
    try {
      return { status: 200, body: {
        ok: true, fila: convitesUnicos.detalhesFila(busca.get('id'))
      } };
    } catch (erro) {
      return { status: 404, body: { ok: false, mensagem: erro.message } };
    }
  }
  if (pathname === '/api/local/campanhas/destinatarios') {
    return { status: 200, body: { ok: true, destinatarios: campanhas.destinatarios() } };
  }
  if (pathname === '/api/local/campanhas/configuracao') {
    const resumo = contatoResumo();
    return { status: 200, body: {
      ok: true, remetente: resumo.remetente,
      remetenteConfigurado: resumo.remetenteConfigurado
    } };
  }
  if (pathname === '/api/local/campanhas/detalhe') {
    try {
      return { status: 200, body: {
        ok: true, campanha: campanhas.obter(busca.get('id'))
      } };
    } catch (erro) {
      return { status: 404, body: { ok: false, mensagem: erro.message } };
    }
  }
  return null;
}
