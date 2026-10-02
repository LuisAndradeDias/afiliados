import type { Oferta } from "../types.js";

interface ProdutoBusca {
  id: string;
  name: string;
  status: string;
  pictures?: Array<{ url?: string; secure_url?: string }>;
}

interface RespostaBuscaProdutos {
  results?: ProdutoBusca[];
}

interface PublicacaoCatalogo {
  item_id: string;
  seller_id: number;
  price: number;
  original_price?: number | null;
  condition?: string;
  available_quantity?: number | null;
}

interface RespostaCompeticao {
  results?: PublicacaoCatalogo[];
}

interface UsuarioMercadoLivre {
  id: number;
  seller_reputation?: {
    level_id?: string | null;
  };
}

interface UsuarioBulk {
  status_code?: number;
  code?: number;
  body?: UsuarioMercadoLivre;
}

function desconto(
  atual: number,
  anterior?: number | null
): number | undefined {
  if (!anterior || anterior <= atual) return undefined;
  return Math.round(((anterior - atual) / anterior) * 100);
}

function urlProdutoCatalogo(id: string): string {
  return `https://www.mercadolivre.com.br/p/${id}`;
}

function imagemProduto(produto: ProdutoBusca): string | undefined {
  return (
    produto.pictures?.[0]?.secure_url ??
    produto.pictures?.[0]?.url
  );
}
export class MercadoLivreApiFonte {
  nome = "mercadolivre-api";
  private readonly reputacaoVerdePorVendedor = new Map<number, boolean>();

  constructor(
    private readonly consulta: string,
    private readonly limite = 20,
    private readonly accessToken = process.env.MERCADOLIVRE_ACCESS_TOKEN
  ) {}

  private async requisicao(
    url: URL | string
  ): Promise<Response> {
    let resposta: Response | undefined;

    for (let tentativa = 1; tentativa <= 4; tentativa += 1) {
      resposta = await fetch(url, {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${this.accessToken}`
        }
      });

      if (resposta.status !== 429) return resposta;

      if (tentativa < 4) {
        await new Promise((resolve) =>
          setTimeout(resolve, tentativa * 1_500)
        );
      }
    }

    return resposta!;
  }

  private async getJson<T>(
    url: URL | string
  ): Promise<T> {
    const resposta = await this.requisicao(url);
    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => "");
      if (
        resposta.status === 403 &&
        corpo.includes("PA_UNAUTHORIZED_RESULT_FROM_POLICIES")
      ) {
        throw new Error(
          "Mercado Livre: recurso bloqueado pelas permissoes do aplicativo."
        );
      }
      throw new Error(
        `Mercado Livre API HTTP ${resposta.status}: ${corpo.slice(0, 300)}`
      );
    }

    return (await resposta.json()) as T;
  }

  private async buscarPublicacoes(
    produtoId: string
  ): Promise<PublicacaoCatalogo[]> {
    const resposta = await this.requisicao(
      `https://api.mercadolibre.com/products/${encodeURIComponent(produtoId)}/items`
    );
    if (resposta.status === 404) return [];

    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => "");
      if (resposta.status === 403) {
        throw new Error(
          "Mercado Livre: sem permissao para consultar publicacoes do catalogo."
        );
      }
      throw new Error(
        `Mercado Livre competicao HTTP ${resposta.status}: ${corpo.slice(0, 250)}`
      );
    }

    const dados = (await resposta.json()) as RespostaCompeticao;
    return dados.results ?? [];
  }

  private async carregarReputacoes(
    sellerIds: number[]
  ): Promise<void> {
    const pendentes = [...new Set(sellerIds)]
      .filter((id) => !this.reputacaoVerdePorVendedor.has(id))
      .slice(0, 20);

    if (pendentes.length === 0) return;

    try {
      const resposta = await this.getJson<UsuarioBulk[]>(
        `https://api.mercadolibre.com/users/bulk?ids=${pendentes.join(",")}`
      );

      for (const entrada of resposta) {
        const usuario = entrada.body;
        if (!usuario?.id) continue;
        const nivel = usuario.seller_reputation?.level_id;
        this.reputacaoVerdePorVendedor.set(
          usuario.id,
          nivel === "4_light_green" || nivel === "5_green"
        );
      }
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      console.warn(
        `Mercado Livre: reputacao em lote indisponivel: ${mensagem}`
      );
    }

    for (const id of pendentes) {
      if (!this.reputacaoVerdePorVendedor.has(id)) {
        this.reputacaoVerdePorVendedor.set(id, false);
      }
    }
  }

  private async melhorPublicacao(
    publicacoes: PublicacaoCatalogo[]
  ): Promise<PublicacaoCatalogo | undefined> {
    const candidatas = publicacoes
      .filter((item) => item.condition === "new" && item.price > 0)
      .sort((a, b) => {
        const da = desconto(a.price, a.original_price) ?? 0;
        const db = desconto(b.price, b.original_price) ?? 0;
        return db - da || a.price - b.price;
      });

    const maximoVendedores = Math.max(
      1,
      Math.min(
        20,
        Number(process.env.MERCADOLIVRE_SELLER_CHECKS_PER_PRODUCT ?? 20)
      )
    );
    const consideradas = candidatas.slice(0, maximoVendedores);
    await this.carregarReputacoes(
      consideradas.map((item) => item.seller_id)
    );

    return consideradas.find(
      (item) => this.reputacaoVerdePorVendedor.get(item.seller_id) === true
    );
  }

  async buscar(): Promise<Oferta[]> {
    if (!this.accessToken?.trim()) {
      throw new Error("Mercado Livre API nao conectada.");
    }

    const url = new URL(
      "https://api.mercadolibre.com/products/search"
    );
    url.searchParams.set("status", "active");
    url.searchParams.set("site_id", "MLB");
    url.searchParams.set("q", this.consulta);
    url.searchParams.set("limit", String(this.limite));

    const dados = await this.getJson<RespostaBuscaProdutos>(url);
    const produtos = dados.results ?? [];
    const ofertas: Oferta[] = [];
    for (const produto of produtos) {
      if (produto.status !== "active") continue;

      await new Promise((resolve) => setTimeout(resolve, 200));

      let publicacoes: PublicacaoCatalogo[];
      try {
        publicacoes = await this.buscarPublicacoes(produto.id);
      } catch (error) {
        const mensagem =
          error instanceof Error ? error.message : String(error);
        console.warn(
          `Mercado Livre: pulando ${produto.id}: ${mensagem}`
        );
        continue;
      }

      const melhor = await this.melhorPublicacao(publicacoes);
      if (!melhor) continue;

      const anterior =
        melhor.original_price && melhor.original_price > melhor.price
          ? melhor.original_price
          : undefined;

      ofertas.push({
        plataforma: "Mercado Livre",
        produtoId: produto.id,
        titulo: produto.name,
        precoAtual: melhor.price,
        precoAnterior: anterior,
        descontoPercentual: desconto(melhor.price, anterior),
        imagem: imagemProduto(produto),
        urlProduto: urlProdutoCatalogo(produto.id),
        categoria: this.consulta,
        encontradoEm: new Date()
      });

      const maximo = Number(
        process.env.MERCADOLIVRE_MAX_OFFERS_PER_QUERY ?? 5
      );
      if (ofertas.length >= maximo) break;
    }

    return ofertas;
  }
}
