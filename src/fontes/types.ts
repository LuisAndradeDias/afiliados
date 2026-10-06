export interface Oferta {
  plataforma: string;
  produtoId: string;
  titulo: string;
  precoAtual: number;
  precoAnterior?: number;
  descontoPercentual?: number;
  cupom?: string;
  cupomCodigo?: string;
  cupomPercentual?: number;
  cupomValor?: number;
  cupomCompraMinima?: number;
  cupomDescontoMaximo?: number;
  cupomValidoAte?: string;
  cupomValidacao?: "catalogo-oficial-estimado" | "produto-confirmado";
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
