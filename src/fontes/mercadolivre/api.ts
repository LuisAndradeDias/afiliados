import type { Oferta } from "../types.js";

interface ResultadoMercadoLivre {
  id: string;
  title: string;
  price: number;
  original_price?: number | null;
  permalink: string;
  thumbnail?: string;
}

interface RespostaBuscaMercadoLivre {
  results?: ResultadoMercadoLivre[];
}

function desconto(atual: number, anterior?: number | null): number | undefined {
  if (!anterior || anterior <= atual) return undefined;
  return Math.round(((anterior - atual) / anterior) * 100);
}
export class MercadoLivreApiFonte {
  nome = "mercadolivre-api";

  constructor(
    private readonly consulta: string,
    private readonly limite = 20,
    private readonly accessToken = process.env.MERCADOLIVRE_ACCESS_TOKEN
  ) {}

  async buscar(): Promise<Oferta[]> {
    if (!this.accessToken?.trim()) {
      throw new Error(
        "Mercado Livre API não conectada. Configure MERCADOLIVRE_ACCESS_TOKEN após autorizar a aplicação."
      );
    }

    const url = new URL("https://api.mercadolibre.com/sites/MLB/search");
    url.searchParams.set("q", this.consulta);
    url.searchParams.set("limit", String(this.limite));

    const resposta = await fetch(url, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${this.accessToken}`
      }
    });
    if (!resposta.ok) {
      const texto = await resposta.text().catch(() => "");
      throw new Error(
        `Mercado Livre API retornou HTTP ${resposta.status}: ${texto.slice(0, 300)}`
      );
    }

    const dados = (await resposta.json()) as RespostaBuscaMercadoLivre;
    const encontrados = dados.results ?? [];

    return encontrados.map((item) => ({
      plataforma: "Mercado Livre",
      produtoId: item.id,
      titulo: item.title,
      precoAtual: item.price,
      precoAnterior:
        item.original_price && item.original_price > item.price
          ? item.original_price
          : undefined,
      descontoPercentual: desconto(item.price, item.original_price),
      imagem: item.thumbnail,
      urlProduto: item.permalink,
      categoria: this.consulta,
      encontradoEm: new Date()
    }));
  }
}
