export interface Oferta {
  plataforma: string;
  produtoId: string;
  titulo: string;
  precoAtual: number;
  precoAnterior?: number;
  descontoPercentual?: number;
  cupom?: string;
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
