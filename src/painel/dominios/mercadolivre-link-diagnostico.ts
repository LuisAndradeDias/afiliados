/**
 * Um teste tecnico do Gerador de Links NAO e uma oferta.
 * Nao valida estoque, descontos nem elegibilidade de publicacao.
 * O processo real continua exigindo revalidacao de compra/estoque.
 */
export interface CondicoesTesteLink {
  pausado: boolean;
  semEnvioAutomatico: boolean;
  semMonitoramento: boolean;
  semWhatsappEmExecucao: boolean;
  semPedidoAnterior: boolean;
  extensaoConectada: boolean;
}

export function permitirTesteTecnicoLink(condicoes: CondicoesTesteLink): boolean {
  return Object.values(condicoes).every(Boolean);
}

export function validarUrlProdutoTesteMercadoLivre(valor: string): {
  produtoId: string;
  urlProduto: string;
} {
  if (typeof valor !== "string" || valor.length > 1024 || !valor.trim()) {
    throw new Error("Informe uma URL de produto do Mercado Livre, copiada do navegador.");
  }

  let url: URL;
  try {
    url = new URL(valor.trim());
  } catch {
    throw new Error("URL de produto invalida.");
  }

  if (
    url.protocol !== "https:" || url.username || url.password ||
    url.port || ![
      "www.mercadolivre.com.br",
      "mercadolivre.com.br",
      "produto.mercadolivre.com.br"
    ].includes(url.hostname.toLowerCase())
  ) {
    throw new Error("Aceitamos apenas enderecos HTTPS oficiais de produtos do Mercado Livre.");
  }

  const catalogo = url.pathname.match(/(?:^|\/)p\/(MLB\d+)\/?$/i);
  if (catalogo) {
    const id = catalogo[1].toUpperCase();
    return {
      produtoId: id,
      // A extensao recebe sempre a forma canonica que ela valida.
      urlProduto: "https://www.mercadolivre.com.br/p/" + id
    };
  }

  const anuncio = url.pathname.match(/^\/MLB-(\d+)(?:-[a-z0-9_-]+)?\/?$/i);
  if (anuncio) {
    const produtoId = "MLB" + anuncio[1];
    const path = url.pathname.replace(/\/$/, "");
    return {
      produtoId,
      urlProduto: "https://produto.mercadolivre.com.br" + path
    };
  }

  throw new Error("Use o link direto de um anuncio ou a pagina de produto /p/MLB.");
}
