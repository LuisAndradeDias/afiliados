import type { FonteDeOfertas, Oferta } from "./types.js";

export class FonteMock implements FonteDeOfertas {
  nome = "mock";

  async buscar(): Promise<Oferta[]> {
    return [{
      plataforma: "mock",
      produtoId: "produto-001",
      titulo: "Air Fryer Exemplo",
      precoAtual: 299.90,
      precoAnterior: 449.90,
      descontoPercentual: 33,
      cupom: "CASA20",
      urlProduto: "https://example.com/produto-001",
      categoria: "Casa",
      encontradoEm: new Date()
    }];
  }
}
