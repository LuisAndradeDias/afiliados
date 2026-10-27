import type { Oferta } from "../types.js";
import { descontoMinimoOferta } from "../../ofertas/qualidade.js";
import { CacheCatalogo404 } from "./cache-catalogo-404.js";
import { catalogoComCompraConfirmada, publicacaoCandidataParaConfirmar,
  type DetalheCatalogoDisponibilidade } from "./disponibilidade.js";
import {
  MercadoLivreReautorizacaoNecessaria,
  obterTokenMercadoLivreValido
} from "../../afiliados/mercadolivre-token.js";

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

let proximaRequisicaoGlobalEm = 0;

async function aguardarRitmoCompartilhado(intervaloMs: number): Promise<void> {
  const agora = Date.now();
  const atraso = Math.max(0, proximaRequisicaoGlobalEm - agora);
  proximaRequisicaoGlobalEm = agora + atraso + intervaloMs;
  if (atraso > 0) {
    await new Promise((resolve) => setTimeout(resolve, atraso));
  }
}

export class MercadoLivreLimiteRequisicoes extends Error {
  readonly code = "MERCADOLIVRE_LIMITE_REQUISICOES";

  constructor() {
    super(
      "Mercado Livre API HTTP 429: limite de requisicoes; " +
      "interrompendo esta rodada sem tentar novamente."
    );
    this.name = "MercadoLivreLimiteRequisicoes";
  }
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

  private accessToken?: string;
  private readonly tokenInformadoManualmente: boolean;

  constructor(
    private readonly consulta: string,
    private readonly limite = 20,
    accessToken?: string
  ) {
    this.tokenInformadoManualmente = accessToken !== undefined;
    this.accessToken = accessToken ?? process.env.MERCADOLIVRE_ACCESS_TOKEN;
  }

  private async requisicao(
    url: URL | string
  ): Promise<Response> {
    const configurado = Number(
      process.env.MERCADOLIVRE_REQUEST_INTERVAL_MS ?? 500
    );
    const intervalo = Math.max(
      250,
      Number.isFinite(configurado) ? configurado : 500
    );

    if (!this.tokenInformadoManualmente) {
      this.accessToken = await obterTokenMercadoLivreValido();
    }

    let renovouApos401 = false;
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      // Compartilhar o ritmo evita rajadas ao trocar de categoria na rodada.
      await aguardarRitmoCompartilhado(intervalo);
      const resposta = await fetch(url, {
        headers: {
          accept: "application/json",
          authorization: "Bearer " + this.accessToken
        }
      });

      if (resposta.status === 429) {
        // O painel ja impõe backoff ao detectar a mensagem HTTP 429.
        // Não repetir esta requisição e não percorrer outros catálogos.
        throw new MercadoLivreLimiteRequisicoes();
      }

      if (resposta.status === 401) {
        if (renovouApos401 || this.tokenInformadoManualmente) {
          throw new MercadoLivreReautorizacaoNecessaria(
            "A API recusou o token de acesso do Mercado Livre."
          );
        }
        this.accessToken = await obterTokenMercadoLivreValido({
          forcar: true,
          tokenRejeitado: this.accessToken
        });
        renovouApos401 = true;
        continue;
      }

      return resposta;
    }

    throw new MercadoLivreReautorizacaoNecessaria();
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
  ): Promise<PublicacaoCatalogo[] | null> {
    const resposta = await this.requisicao(
      `https://api.mercadolibre.com/products/${encodeURIComponent(produtoId)}/items`
    );
    if (resposta.status === 404) return null;

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
      if (
        error instanceof MercadoLivreReautorizacaoNecessaria ||
        error instanceof MercadoLivreLimiteRequisicoes
      ) throw error;
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
      .filter((item) => publicacaoCandidataParaConfirmar(item))
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
    if (
      !this.accessToken?.trim() &&
      !process.env.MERCADOLIVRE_REFRESH_TOKEN?.trim()
    ) {
      throw new MercadoLivreReautorizacaoNecessaria(
        "Mercado Livre API sem autoriza��o configurada."
      );
    }

    const ofertas: Oferta[] = [];
    const produtosVistos = new Set<string>();
    const cache404 = new CacheCatalogo404();
    let catalogosConsultados = 0;
    let ignoradosCache = 0;
    let semPublicacoes404 = 0;
    let vendedoresVerdes = 0;
    let descontosMinimos = 0;
    const quantidade = Number(process.env.MERCADOLIVRE_MAX_OFFERS_PER_QUERY ?? 10);
    const maximo = Number.isFinite(quantidade)
      ? Math.max(1, Math.min(16, Math.trunc(quantidade)))
      : 10;
    // S� as ofertas com DESCONTO verificado contam para encerrar a varredura.
    // Antes, os primeiros 5 an�ncios sem desconto impediam a busca de avan�ar.
    const minimoVerificado = descontoMinimoOferta();
    let elegiveisPorDesconto = 0;
    const paginas = Math.max(
      1,
      Math.min(
        5,
        Number(process.env.MERCADOLIVRE_SEARCH_PAGES_PER_QUERY ?? 3)
      )
    );

    try {
      for (let pagina = 0; pagina < paginas; pagina += 1) {
        const url = new URL(
          "https://api.mercadolibre.com/products/search"
        );
        url.searchParams.set("status", "active");
        url.searchParams.set("site_id", "MLB");
        url.searchParams.set("q", this.consulta);
        url.searchParams.set("limit", String(this.limite));
        url.searchParams.set("offset", String(pagina * this.limite));

        // HTTP 429 deve interromper a rodada inteira, inclusive em paginas
        // posteriores: nao retornar uma amostra parcial como sucesso.
        const dados = await this.getJson<RespostaBuscaProdutos>(url);

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

          if (await cache404.contem(produto.id)) {
            ignoradosCache += 1;
            continue;
          }
          catalogosConsultados += 1;
          let publicacoes: PublicacaoCatalogo[] | null;
          try {
            publicacoes = await this.buscarPublicacoes(produto.id);
          } catch (error) {
            if (
              error instanceof MercadoLivreReautorizacaoNecessaria ||
              error instanceof MercadoLivreLimiteRequisicoes
            ) throw error;
            const mensagem =
              error instanceof Error ? error.message : String(error);
            console.warn(
              `Mercado Livre: pulando ${produto.id}: ${mensagem}`
            );
            continue;
          }

          if (publicacoes === null) {
            semPublicacoes404 += 1;
            await cache404.registrar404(produto.id);
            continue;
          }
          const melhor = await this.melhorPublicacao(publicacoes);
          if (!melhor) continue;

          // A ficha "active" pode mostrar "produto indisponivel".
          // Comprovar vendedor vencedor e estoque no catalogo antes da oferta.
          let catalogo: DetalheCatalogoDisponibilidade;
          try {
            catalogo = await this.getJson<DetalheCatalogoDisponibilidade>(
              "https://api.mercadolibre.com/products/" + encodeURIComponent(produto.id)
            );
          } catch (error) {
            if (error instanceof MercadoLivreReautorizacaoNecessaria ||
                error instanceof MercadoLivreLimiteRequisicoes) throw error;
            console.warn("Mercado Livre: disponibilidade nao confirmada; ignorando catalogo.");
            continue;
          }
          if (!catalogoComCompraConfirmada(produto.id, melhor, catalogo)) {
            console.warn("Mercado Livre: catalogo sem compra/estoque confirmados; ignorando.");
            continue;
          }
          vendedoresVerdes += 1;

          const anterior =
            melhor.original_price && melhor.original_price > melhor.price
              ? melhor.original_price
              : undefined;

          const percentualVerificado = desconto(melhor.price, anterior);
          ofertas.push({
            plataforma: "Mercado Livre",
            produtoId: produto.id,
            anuncioId: melhor.item_id,
            vendedorId: melhor.seller_id,
            estoqueDisponivel: Math.min(
              melhor.available_quantity ?? catalogo.buy_box_winner!.available_quantity!,
              catalogo.buy_box_winner!.available_quantity!
            ),
            disponibilidadeConfirmada: true,
            disponibilidadeVerificadaEm: new Date().toISOString(),
            titulo: produto.name,
            precoAtual: melhor.price,
            precoAnterior: anterior,
            descontoPercentual: percentualVerificado,
            imagem: imagemProduto(produto),
            urlProduto: urlProdutoCatalogo(produto.id),
            categoria: this.consulta,
            encontradoEm: new Date()
          });

          if ((percentualVerificado ?? 0) >= minimoVerificado) {
            elegiveisPorDesconto++;
            descontosMinimos += 1;
          }
          if (elegiveisPorDesconto >= maximo) return ofertas;
        }

        const total = dados.paging?.total;
        if (typeof total === "number" && (pagina + 1) * this.limite >= total) {
          break;
        }
      }

      return ofertas;
    } finally {
      await cache404.persistir();
      console.log(
        `Mercado Livre catalogo: consultados=${catalogosConsultados}, ` +
        `404=${semPublicacoes404}, cache404=${ignoradosCache}, ` +
        `vendedores-verdes=${vendedoresVerdes}, descontos-minimos=${descontosMinimos}.`
      );
    }
  }
}
