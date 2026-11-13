import type { Oferta } from "../types.js";
import { MercadoLivreAcessoNegado, MercadoLivreLimiteApi, lerRetryAfterMs, diagnosticarNegacaoMeli403 } from "./erros.js";
import {
  estoqueEsgotadoReportado, limiteInteiro, ordenarPublicacoes,
  resumirPublicacoes, textoDeIndisponibilidade, validarPermalinkOficial
} from "./selecao.js";
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
  title?: string;
  message?: string;
  status?: string;
  sub_status?: string[];
}

interface RespostaCompeticao {
  results?: PublicacaoCatalogo[];
}

interface DetalheAnuncio {
  id?: string;
  seller_id?: number;
  status?: string;
  sub_status?: string[];
  title?: string;
  message?: string;
  permalink?: string;
  price?: number;
  original_price?: number | null;
  condition?: string;
  available_quantity?: number | null;
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
    let resposta: Response | undefined;
    const configurado = Number(process.env.MERCADOLIVRE_REQUEST_INTERVAL_MS ?? 500);
    const intervalo = Math.max(250, Number.isFinite(configurado) ? configurado : 500);

    if (!this.tokenInformadoManualmente) {
      this.accessToken = await obterTokenMercadoLivreValido();
    }

    let renovouApos401 = false;
    // Só 401 permite uma segunda tentativa após renovar o token.
    // 403/429 interrompem imediatamente; o painel controla a espera.
    for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
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
          authorization: "Bearer " + this.accessToken
        },
        signal: AbortSignal.timeout(15_000)
      });

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
        await resposta.body?.cancel();
        continue;
      }

      if (resposta.status === 403) {
        // Preserva somente codigos documentados e X-Request-ID; nunca imprime
        // corpo bruto, credenciais, cookies ou cabecalhos de autorizacao.
        const corpo = await resposta.text().catch(() => "");
        const diagnostico = diagnosticarNegacaoMeli403(
          corpo, resposta.headers.get("x-request-id")
        );
        throw new MercadoLivreAcessoNegado(new URL(url).pathname, diagnostico);
      }
      if (resposta.status === 429) {
        const retryAfterMs = lerRetryAfterMs(resposta.headers.get("retry-after"));
        await resposta.body?.cancel();
        throw new MercadoLivreLimiteApi(retryAfterMs);
      }
      return resposta;
    }

    return resposta!;
  }

  private async getJson<T>(
    url: URL | string
  ): Promise<T> {
    const resposta = await this.requisicao(url);
    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => "");
      throw new Error(
        `Mercado Livre API HTTP ${resposta.status}: ${corpo.slice(0, 300)}`
      );
    }

    return (await resposta.json()) as T;
  }

  private async buscarPublicacoes(
    produtoId: string
  ): Promise<{ publicacoes: PublicacaoCatalogo[]; naoEncontrado: boolean }> {
    const resposta = await this.requisicao(
      `https://api.mercadolibre.com/products/${encodeURIComponent(produtoId)}/items`
    );
    if (resposta.status === 404) return { publicacoes: [], naoEncontrado: true };

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
    return { publicacoes: dados.results ?? [], naoEncontrado: false };
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
        const status = entrada.status_code ?? entrada.code ?? 200;
        if (status === 403) throw new MercadoLivreAcessoNegado('/users/bulk');
        if (status === 429) throw new MercadoLivreLimiteApi(0);
        if (status === 401) throw new MercadoLivreReautorizacaoNecessaria();
        if (status < 200 || status >= 300) continue;
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
      if (error instanceof MercadoLivreReautorizacaoNecessaria ||
          error instanceof MercadoLivreAcessoNegado ||
          error instanceof MercadoLivreLimiteApi) throw error;
      const mensagem = error instanceof Error ? error.message : String(error);
      if (mensagem.includes("HTTP 429")) throw error;
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

  private async candidatasComReputacao(
    publicacoes: PublicacaoCatalogo[]
  ): Promise<PublicacaoCatalogo[]> {
    const candidatas = ordenarPublicacoes(publicacoes);

    if (process.env.MERCADOLIVRE_DEBUG_SELLERS === "true") {
      console.log(
        `Mercado Livre publicacoes: total=${publicacoes.length}, novas_com_estoque=${candidatas.length}`
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

    return consideradas.filter(
      (item, index, lista) =>
        this.reputacaoVerdePorVendedor.get(item.seller_id) === true &&
        lista.findIndex(outro => outro.item_id === item.item_id) === index
    ).slice(0, 3);
  }

  /**
   * O link usado pelo Gerador de Afiliados deve corresponder ao anúncio
   * realmente escolhido (vendedor, estoque, preço), não só ao catálogo.
   * O portal pode ainda recusar a elegibilidade; nunca contornar essa recusa.
   */
  private async detalharAnuncio(
    publicacao: PublicacaoCatalogo
  ): Promise<{
    url: string;
    preco: number;
    anterior?: number;
    estoqueNaoInformado: boolean;
  } | null> {
    const id = publicacao.item_id;
    const detalhe = await this.getJson<DetalheAnuncio>(
      `https://api.mercadolibre.com/items/${encodeURIComponent(id)}`
    );
    if (detalhe.id !== id || detalhe.status !== "active" ||
        detalhe.condition !== "new" ||
        detalhe.seller_id !== publicacao.seller_id ||
        estoqueEsgotadoReportado(detalhe.available_quantity) ||
        textoDeIndisponibilidade(detalhe.title) ||
        textoDeIndisponibilidade(detalhe.message) ||
        (detalhe.sub_status || []).some(textoDeIndisponibilidade) ||
        !Number.isFinite(detalhe.price) || !detalhe.price ||
        detalhe.price <= 0) return null;

    const permalink = validarPermalinkOficial(detalhe.permalink, id);
    if (!permalink) return null;

    // Só aproveitar o preço anterior vindo da competição se o preço atual
    // ainda for o mesmo; senão usar o dado atual da publicação detalhada.
    const anterior = detalhe.original_price && detalhe.original_price > detalhe.price
      ? detalhe.original_price
      : detalhe.price === publicacao.price &&
        publicacao.original_price && publicacao.original_price > detalhe.price
        ? publicacao.original_price
        : undefined;
    return {
      url: permalink,
      preco: detalhe.price,
      anterior,
      estoqueNaoInformado: detalhe.available_quantity == null
    };
  }

  async buscar(): Promise<Oferta[]> {
    if (
      !this.accessToken?.trim() &&
      !process.env.MERCADOLIVRE_REFRESH_TOKEN?.trim()
    ) {
      throw new MercadoLivreReautorizacaoNecessaria(
        "Mercado Livre API sem autorização configurada."
      );
    }

    const ofertas: Oferta[] = [];
    const produtosVistos = new Set<string>();
    const maximo = limiteInteiro(
      process.env.MERCADOLIVRE_MAX_OFFERS_PER_QUERY, 5, 1, 30
    );
    const paginas = limiteInteiro(
      process.env.MERCADOLIVRE_SEARCH_PAGES_PER_QUERY, 3, 1, 5
    );
    // Orçamento técnico de verificações. Não parar ao achar 5 anúncios
    // quaisquer: podem ter desconto baixo, vendedor ruim ou sem estoque.
    const limiteProdutos = limiteInteiro(
      process.env.MERCADOLIVRE_PRODUCTS_CHECKED_PER_QUERY,
      25, Math.max(maximo, 5), 60
    );
    let analisados = 0;
    let semEstoqueOuVendedor = 0;
    let semDadosValidos = 0;
    let estoqueNaoInformado = 0;
    let publicacoesRecebidas = 0;
    let candidatasTecnicas = 0;
    let estoqueNaoInformadoCatalogo = 0;
    let estoqueEsgotadoExplicito = 0;
    let mensagensIndisponiveis = 0;
    let catalogos404 = 0;
    let catalogosSemPublicacoes = 0;
    let catalogos403 = 0;
    let semReputacaoAprovada = 0;
    let detalhes403 = 0;
    let condicaoNaoNova = 0;
    let vendedoresInvalidos = 0;
    let precosInvalidos = 0;
    let identificadoresInvalidos = 0;

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
        // A Central aplica backoff à API. Não mascarar 429 como
        // "nenhuma oferta"; isso provocaria novas consultas excessivas.
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
        if (analisados >= limiteProdutos) break;
        if (produto.status !== "active" || produtosVistos.has(produto.id) ||
            !/^MLB\d+$/i.test(produto.id) || !produto.name?.trim() ||
            textoDeIndisponibilidade(produto.name)) {
          continue;
        }
        produtosVistos.add(produto.id);
        analisados += 1;

        let resultadoPublicacoes: {
          publicacoes: PublicacaoCatalogo[];
          naoEncontrado: boolean;
        };
        try {
          resultadoPublicacoes = await this.buscarPublicacoes(produto.id);
        } catch (error) {
          if (error instanceof MercadoLivreReautorizacaoNecessaria ||
          error instanceof MercadoLivreAcessoNegado ||
          error instanceof MercadoLivreLimiteApi) throw error;
          const mensagem = error instanceof Error ? error.message : String(error);
          if (mensagem.includes("HTTP 429")) throw error;
          if (mensagem.includes("sem permissao")) catalogos403 += 1;
          console.warn(
            `Mercado Livre: pulando ${produto.id}: ${mensagem}`
          );
          continue;
        }

        const publicacoes = resultadoPublicacoes.publicacoes;
        if (resultadoPublicacoes.naoEncontrado) catalogos404 += 1;
        else if (publicacoes.length === 0) catalogosSemPublicacoes += 1;
        const triagem = resumirPublicacoes(publicacoes);
        publicacoesRecebidas += triagem.total;
        candidatasTecnicas += triagem.tecnicamenteValidas;
        estoqueNaoInformadoCatalogo += triagem.estoqueNaoInformado;
        estoqueEsgotadoExplicito += triagem.esgotadasExplicitamente;
        mensagensIndisponiveis += triagem.mensagensIndisponibilidade;
        condicaoNaoNova += triagem.condicaoNaoNova;
        vendedoresInvalidos += triagem.vendedoresInvalidos;
        precosInvalidos += triagem.precosInvalidos;
        identificadoresInvalidos += triagem.identificadoresInvalidos;

        const candidatas = await this.candidatasComReputacao(publicacoes);
        if (candidatas.length === 0) {
          semEstoqueOuVendedor += 1;
          if (triagem.tecnicamenteValidas > 0) semReputacaoAprovada += 1;
          continue;
        }

        let detalhe: Awaited<ReturnType<typeof this.detalharAnuncio>> = null;
        for (const candidata of candidatas) {
          try {
            const confirmado = await this.detalharAnuncio(candidata);
            if (confirmado && (!detalhe ||
                (desconto(confirmado.preco, confirmado.anterior) ?? 0) >
                  (desconto(detalhe.preco, detalhe.anterior) ?? 0) ||
                ((desconto(confirmado.preco, confirmado.anterior) ?? 0) ===
                  (desconto(detalhe.preco, detalhe.anterior) ?? 0) &&
                  confirmado.preco < detalhe.preco))) {
              detalhe = confirmado;
            }
          } catch (error) {
            if (error instanceof MercadoLivreReautorizacaoNecessaria ||
                error instanceof MercadoLivreAcessoNegado ||
                error instanceof MercadoLivreLimiteApi) throw error;
            const mensagem = error instanceof Error ? error.message : String(error);
            if (mensagem.includes("HTTP 429")) throw error;
            console.warn(`Mercado Livre: anuncio ${candidata.item_id} nao confirmado: ${mensagem}`);
          }
          // Reclassificar até três anúncios pelo preço realmente confirmado.
          // O próximo anúncio tem de passar pelas MESMAS regras. Não há
          // construção de permalink nem reaproveitamento de preço inválido.
        }
        if (!detalhe) {
          semDadosValidos += 1;
          continue;
        }

        if (detalhe.estoqueNaoInformado) estoqueNaoInformado += 1;
        ofertas.push({
          plataforma: "Mercado Livre",
          produtoId: produto.id,
          titulo: produto.name,
          precoAtual: detalhe.preco,
          precoAnterior: detalhe.anterior,
          descontoPercentual: desconto(detalhe.preco, detalhe.anterior),
          imagem: imagemProduto(produto),
          // Link da publicação específica que foi validada na API, não
          // URL genérica de catálogo que pode não passar pelo gerador.
          urlProduto: detalhe.url,
          categoria: this.consulta,
          encontradoEm: new Date()
        });
      }

      if (analisados >= limiteProdutos) break;

      const total = dados.paging?.total;
      if (typeof total === "number" && (pagina + 1) * this.limite >= total) {
        break;
      }
    }

    const ordenadas = ofertas.sort((a, b) => (
      (b.descontoPercentual ?? 0) - (a.descontoPercentual ?? 0) ||
      a.precoAtual - b.precoAtual
    ));
    console.log(
      `Mercado Livre busca: categoria="${this.consulta}", ` +
      `analisados=${analisados}, ofertas_validadas=${ofertas.length}, ` +
      `sem_candidata_ou_vendedor_aprovado=${semEstoqueOuVendedor}, ` +
      `detalhe_nao_validado=${semDadosValidos}, ` +
      `estoque_nao_informado_validado=${estoqueNaoInformado}, ` +
      `selecionadas=${Math.min(maximo, ordenadas.length)}.`
    );
    // Funil observado na API real: motivos podem se sobrepor, não somar
    // contagens de rejeição como se fossem produtos distintos.
    console.log(
      `Mercado Livre funil: categoria="${this.consulta}", ` +
      `publicacoes=${publicacoesRecebidas}, ` +
      `candidatas_tecnicas=${candidatasTecnicas}, ` +
      `estoque_nao_informado_competicao=${estoqueNaoInformadoCatalogo}, ` +
      `estoque_esgotado_explicito=${estoqueEsgotadoExplicito}, ` +
      `mensagem_indisponivel=${mensagensIndisponiveis}, ` +
      `nao_novos=${condicaoNaoNova}, vendedor_invalido=${vendedoresInvalidos}, ` +
      `preco_invalido=${precosInvalidos}, item_invalido=${identificadoresInvalidos}, ` +
      `catalogos_404=${catalogos404}, catalogos_vazios=${catalogosSemPublicacoes}, ` +
      `catalogos_403=${catalogos403}, sem_reputacao_aprovada=${semReputacaoAprovada}, ` +
      `detalhe_http403=${detalhes403}, validadas=${ofertas.length}.`
    );
    return ordenadas.slice(0, maximo);
  }
}
