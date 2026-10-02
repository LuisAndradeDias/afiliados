import type { Oferta } from "../types.js";

interface ProdutoBusca {
  id: string;
  name: string;
  status: string;
  pictures?: Array<{ url?: string; secure_url?: string }>;
}

interface RespostaBuscaProdutos {
  paging?: {
    total?: number;
    offset?: number;
    limit?: number;
  };
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
  private ultimaRequisicaoEm = 0;

  constructor(
    private readonly consulta: string,
    private readonly limite = 20,
    private readonly accessToken = process.env.MERCADOLIVRE_ACCESS_TOKEN
  ) {}

  private async requisicao(
    url: URL | string
  ): Promise<Response> {
    let resposta: Response | undefined;
    const intervalo = Math.max(
      250,
      Number(process.env.MERCADOLIVRE_REQUEST_INTERVAL_MS ?? 500)
    );

    for (let tentativa = 1; tentativa <= 4; tentativa += 1) {
      const espera = Math.max(
        0,
        intervalo - (Date.now() - this.ultimaRequisicaoEm)
      );
      if (espera > 0) {
        await new Promise((resolve) => setTimeout(resolve, espera));
      }

      this.ultimaRequisicaoEm = Date.now();
      resposta = await fetch(url, {
        headers: {
          accept: "application/json",
          authorization: `Bearer ${this.accessToken}`
        }
      });

      if (resposta.status !== 429) return resposta;

      if (tentativa < 4) {
        const retryAfter = Number(resposta.headers.get("retry-after") ?? 0);
        const atraso = retryAfter > 0
          ? retryAfter * 1_000
          : tentativa * 2_500;
        await new Promise((resolve) => setTimeout(resolve, atraso));
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

      let verdes = 0;
      let semNivel = 0;
      let outros = 0;

      for (const entrada of resposta) {
        const usuario = entrada.body;
        if (!usuario?.id) continue;
        const nivel = usuario.seller_reputation?.level_id;
        const verde = nivel === "4_light_green" || nivel === "5_green";
        if (verde) verdes += 1;
        else if (!nivel) semNivel += 1;
        else outros += 1;

        this.reputacaoVerdePorVendedor.set(usuario.id, verde);
      }

      if (process.env.MERCADOLIVRE_DEBUG_SELLERS === "true") {
        console.log(
          `Mercado Livre reputacao: verdes=${verdes}, sem_nivel=${semNivel}, outros=${outros}, consultados=${pendentes.length}`
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

    if (process.env.MERCADOLIVRE_DEBUG_SELLERS === "true") {
      console.log(
        `Mercado Livre publicacoes: total=${publicacoes.length}, novas=${candidatas.length}`
      );
    }

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

    const ofertas: Oferta[] = [];
    const produtosVistos = new Set<string>();
    const maximo = Math.max(
      1,
      Number(process.env.MERCADOLIVRE_MAX_OFFERS_PER_QUERY ?? 5)
    );
    const paginas = Math.max(
      1,
      Math.min(
        5,
        Number(process.env.MERCADOLIVRE_SEARCH_PAGES_PER_QUERY ?? 3)
      )
    );

    for (let pagina = 0; pagina < paginas; pagina += 1) {
      const url = new URL(
        "https://api.mercadolibre.com/products/search"
      );
      url.searchParams.set("status", "active");
      url.searchParams.set("site_id", "MLB");
      url.searchParams.set("q", this.consulta);
      url.searchParams.set("limit", String(this.limite));
      url.searchParams.set("offset", String(pagina * this.limite));

      let dados: RespostaBuscaProdutos;
      try {
        dados = await this.getJson<RespostaBuscaProdutos>(url);
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : String(error);
        if (mensagem.includes("HTTP 429") && pagina > 0) {
          console.warn(
            `Mercado Livre: limite de requisicoes na pagina ${pagina + 1}; encerrando esta rodada.`
          );
          break;
        }
        throw error;
      }

      const produtos = dados.results ?? [];
      if (produtos.length === 0) break;

      if (process.env.MERCADOLIVRE_DEBUG_SELLERS === "true") {
        console.log(
          `Mercado Livre catalogo: pagina=${pagina + 1}, produtos=${produtos.length}, total=${dados.paging?.total ?? "?"}`
        );
      }

      for (const produto of produtos) {
        if (produto.status !== "active" || produtosVistos.has(produto.id)) {
          continue;
        }
        produtosVistos.add(produto.id);

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

        if (ofertas.length >= maximo) return ofertas;
      }

      const total = dados.paging?.total;
      if (typeof total === "number" && (pagina + 1) * this.limite >= total) {
        break;
      }
    }

    return ofertas;
  }
}
