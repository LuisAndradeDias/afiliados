import type { Oferta } from "../types.js";

interface ProdutoBusca {
  id: string;
  name: string;
  status: string;
}

interface RespostaBuscaProdutos {
  results?: ProdutoBusca[];
}

interface ProdutoDetalhe {
  id: string;
  name: string;
  status: string;
  permalink?: string;
  pictures?: Array<{ url?: string; secure_url?: string }>;
  buy_box_winner?: {
    item_id: string;
    price: number;
    original_price?: number | null;
  } | null;
}

interface ItemDetalhe {
  id: string;
  title: string;
  price: number;
  original_price?: number | null;
  permalink?: string;
  thumbnail?: string;
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

  private async getJson<T>(url: URL | string): Promise<T> {
    const resposta = await fetch(url, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${this.accessToken}`
      }
    });

    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => "");
      if (
        resposta.status === 403 &&
        corpo.includes("PA_UNAUTHORIZED_RESULT_FROM_POLICIES")
      ) {
        throw new Error(
          "Mercado Livre: recurso bloqueado pela permissao do aplicativo."
        );
      }
      throw new Error(
        `Mercado Livre API HTTP ${resposta.status}: ${corpo.slice(0, 300)}`
      );
    }

    return (await resposta.json()) as T;
  }

  private async detalheProduto(id: string): Promise<ProdutoDetalhe> {
    return this.getJson<ProdutoDetalhe>(
      `https://api.mercadolibre.com/products/${encodeURIComponent(id)}`
    );
  }

  private async detalheItem(id: string): Promise<ItemDetalhe | undefined> {
    try {
      return await this.getJson<ItemDetalhe>(
        `https://api.mercadolibre.com/items/${encodeURIComponent(id)}`
      );
    } catch {
      return undefined;
    }
  }

  async buscar(): Promise<Oferta[]> {
    if (!this.accessToken?.trim()) {
      throw new Error("Mercado Livre API nao conectada.");
    }

    const url = new URL("https://api.mercadolibre.com/products/search");
    url.searchParams.set("status", "active");
    url.searchParams.set("site_id", "MLB");
    url.searchParams.set("q", this.consulta);
    url.searchParams.set("limit", String(this.limite));

    const dados = await this.getJson<RespostaBuscaProdutos>(url);
    const produtos = dados.results ?? [];
    const ofertas: Oferta[] = [];

    for (const resumo of produtos) {
      const produto = await this.detalheProduto(resumo.id);
      const vencedor = produto.buy_box_winner;
      if (produto.status !== "active" || !vencedor?.item_id) continue;

      const item = await this.detalheItem(vencedor.item_id);
      const atual = item?.price ?? vencedor.price;
      const anterior = item?.original_price ?? vencedor.original_price;
      const link =
        item?.permalink ??
        produto.permalink ??
        `https://www.mercadolivre.com.br/p/${produto.id}`;
      const imagem =
        item?.thumbnail ??
        produto.pictures?.[0]?.secure_url ??
        produto.pictures?.[0]?.url;

      ofertas.push({
        plataforma: "Mercado Livre",
        produtoId: item?.id ?? vencedor.item_id,
        titulo: item?.title ?? produto.name,
        precoAtual: atual,
        precoAnterior:
          anterior && anterior > atual ? anterior : undefined,
        descontoPercentual: desconto(atual, anterior),
        imagem,
        urlProduto: link,
        categoria: this.consulta,
        encontradoEm: new Date()
      });
    }

    return ofertas;
  }
}
