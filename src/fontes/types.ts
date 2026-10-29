export interface Oferta {
  plataforma: string;
  produtoId: string;
  titulo: string;
  precoAtual: number;
  // Mercado Livre: somente o vencedor compravel e com estoque confirmado.
  anuncioId?: string;
  vendedorId?: number;
  estoqueDisponivel?: number;
  disponibilidadeConfirmada?: boolean;
  disponibilidadeVerificadaEm?: string;
  // Mercado Livre: preco referenciado ao anuncio vencedor, nunca a outro
  // vendedor. Nao presume condicoes de Pix ou parcelamento a partir da API.
  precoFonte?: "catalogo-vencedor-api";
  precoVerificadoEm?: string;
  precoCondicaoPagamento?: "nao-verificada";
  // "Coerente" confirma somente o canal marketplace, nao Pix/cartao.
  precoContextoStatus?: "coerente";
  precoContextoVerificadoEm?: string;
  precoAnterior?: number;
  descontoPercentual?: number;
  cupom?: string;
  cupomCodigo?: string;
  cupomPercentual?: number;
  cupomValor?: number;
  cupomCompraMinima?: number;
  cupomDescontoMaximo?: number;
  cupomValidoAte?: string;
  cupomColetadoEm?: string;
  cupomValidacao?: "catalogo-oficial-estimado" | "produto-confirmado";
  cupomConfirmadoEm?: string;
  cupomProdutoIdConfirmado?: string;
  cupomAnuncioIdConfirmado?: string;
  cupomFonteConfirmacao?: "checkout";
  precoComCupomEstimado?: number;
  descontoEfetivoPercentual?: number;
  imagem?: string;
  urlProduto: string;
  urlAfiliado?: string;
  categoria?: string;
  comissaoEstimadaPercentual?: number;
  scoreOferta?: number;
  encontradoEm: Date;
}

export interface FonteDeOfertas {
  nome: string;
  buscar(): Promise<Oferta[]>;
}
