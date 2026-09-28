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
  encontradoEm: Date;
}

export interface FonteDeOfertas {
  nome: string;
  buscar(): Promise<Oferta[]>;
}
