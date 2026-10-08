import type { Oferta } from "../fontes/types.js";

const PRODUTOS_PRIORITARIOS =
  /\b(?:smartphone|celular|iphone|galaxy|ipad|tablet|notebook|laptop|ultrabook|macbook|computador|desktop|pc\s*gamer|placa\s+de\s+video|processador|memoria\s+ram|ssd|monitor|smart\s*tv|televisor|televisao|tv|fone(?:s)?|headphone|headset|earbuds|airpods|caixa\s+de\s+som|soundbar|home\s*theater|console|playstation|xbox|nintendo|switch|roteador|impressora|camera\s+digital|smartwatch|relogio\s+inteligente|echo|fire\s*tv|kindle|air\s*fryer|fritadeira\s+eletrica|cafeteira|aspirador|robo\s+aspirador|microondas|micro-ondas|geladeira|refrigerador|freezer|liquidificador|batedeira|maquina\s+de\s+lavar|lavadora|lava\s+e\s+seca|lava\s*loucas|fogao|cooktop|forno\s+eletrico|ventilador|climatizador|ar\s*condicionado|purificador\s+de\s+agua)\b/i;

const ACESSORIOS_E_CONSUMIVEIS =
  /\b(?:capa|capinha|pelicula|case\s+para|suporte\s+para|pelicula\s+de|adesivo|papel\s+para|forma\s+para|forro\s+para|protetor\s+para|bolsa\s+para|manual\s+de|refil|reposicao|peca\s+de|limpador\s+de|limpeza\s+de|cabo\s+para|alca\s+para|filtro\s+de|filtro\s+para|cartucho\s+para|kit\s+de\s+limpeza)\b/i;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function produtoPrioritario(oferta: Pick<Oferta, "titulo">): boolean {
  const titulo = normalizar(oferta.titulo);
  return (
    PRODUTOS_PRIORITARIOS.test(titulo) &&
    !ACESSORIOS_E_CONSUMIVEIS.test(titulo)
  );
}

export function acessorioOuConsumivel(oferta: Pick<Oferta, "titulo">): boolean {
  return ACESSORIOS_E_CONSUMIVEIS.test(normalizar(oferta.titulo));
}

export function economiaRealOferta(oferta: Oferta): number {
  const precoAtual = oferta.precoAtual;
  const anterior = oferta.precoAnterior;
  const comCupom =
    oferta.precoComCupomEstimado &&
    oferta.precoComCupomEstimado > 0 &&
    oferta.precoComCupomEstimado < precoAtual
      ? oferta.precoComCupomEstimado
      : precoAtual;

  if (anterior && Number.isFinite(anterior) && anterior > precoAtual) {
    // Economia estimada sobre o preco anterior efetivo do produto,
    // nunca sobre R$/kg ou sobre desconto percentual arredondado.
    if (((anterior - comCupom) / anterior) * 100 > 90) return 0;
    return Math.round((anterior - comCupom) * 100) / 100;
  }

  // Sem preco anterior, cupom so entra se confirmado para aquele produto.
  if (
    oferta.cupomValidacao === "produto-confirmado" &&
    comCupom < precoAtual
  ) {
    return Math.round((precoAtual - comCupom) * 100) / 100;
  }

  return 0;
}

export interface AvaliacaoQualidadeOferta {
  elegivel: boolean;
  motivo: string;
  prioritario: boolean;
  economiaReais: number;
}

function configuracaoPositiva(entrada: string | undefined, padrao: number): number {
  const valor = Number(entrada);
  return entrada?.trim() && Number.isFinite(valor) && valor >= 0
    ? valor
    : padrao;
}

/**
 * Filtro editorial para o grupo: privilegia o produto principal de
 * eletronicos/eletrodomesticos, desconto verificavel e ganho real em reais.
 */
export function avaliarQualidadeOferta(
  oferta: Oferta,
  env: NodeJS.ProcessEnv = process.env
): AvaliacaoQualidadeOferta {
  const minimoDesconto = configuracaoPositiva(env.MIN_DISCOUNT_PERCENT, 25);
  const minimoPreco = configuracaoPositiva(env.MIN_OFFER_PRICE_BRL, 79);
  const minimoEconomia = configuracaoPositiva(env.MIN_OFFER_SAVINGS_BRL, 35);
  const economiaReais = economiaRealOferta(oferta);
  const prioritario = produtoPrioritario(oferta);
  const retorno = (elegivel: boolean, motivo: string): AvaliacaoQualidadeOferta => ({
    elegivel,
    motivo,
    prioritario,
    economiaReais
  });

  if (!Number.isFinite(oferta.precoAtual) || oferta.precoAtual < minimoPreco) {
    return retorno(false, "preco muito baixo ou invalido");
  }

  if (acessorioOuConsumivel(oferta)) {
    return retorno(false, "acessorio ou consumivel");
  }

  const desconto =
    oferta.descontoEfetivoPercentual ?? oferta.descontoPercentual ?? 0;
  if (!Number.isFinite(desconto) || desconto < minimoDesconto || desconto > 90) {
    return retorno(false, "desconto insuficiente ou nao confiavel");
  }

  if (economiaReais < minimoEconomia) {
    return retorno(false, "economia em reais insuficiente ou nao comprovada");
  }

  if (!prioritario && (desconto < 50 || economiaReais < 150)) {
    return retorno(false, "produto fora do foco de tecnologia/eletrodomesticos");
  }

  return retorno(true, prioritario ? "produto prioritario" : "oferta excepcional");
}
