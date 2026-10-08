import type { Oferta } from "../fontes/types.js";
import type { RegistroHistoricoOferta } from "./historico.js";
import { calcularScore } from "./score.js";
import { faixaPrecoOferta, type FaixaPrecoOferta } from "./qualidade.js";

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Categorias editoriais amplas, mesmo quando os títulos de Amazon/ML diferem.
 * Assim não repetimos fones (nem notebooks) em várias postagens seguidas.
 */
export function categoriaEditorial(titulo: string): string {
  const t = normalizar(titulo);
  if (/fone|headset|headphone|earphone|earbuds|airpods|auricular/.test(t)) return "fones";
  if (/caixa de som|soundbar|alto.falante|speaker|subwoofer/.test(t)) return "audio";
  if (/mouse|teclado|webcam|microfone|controle gamer|controle sem fio|joystick/.test(t)) return "perifericos";
  if (/smartwatch|relogio inteligente|smartband|pulseira inteligente/.test(t)) return "wearables";
  if (/tomada inteligente|lampada inteligente|lampada smart|smart plug|camera wifi|camera de seguranca|sensor de movimento/.test(t)) return "casa-inteligente";
  if (/notebook|laptop|macbook|computador|desktop|pc gamer/.test(t)) return "computadores";
  if (/celular|smartphone|iphone|galaxy|tablet|ipad/.test(t)) return "celulares-tablets";
  if (/smart tv|televisor|televisao/.test(t)) return "tv";
  if (/monitor/.test(t)) return "monitores";
  if (/roteador|repetidor|mesh|wi.fi 6/.test(t)) return "rede";
  if (/ssd|memoria ram|processador|placa de video|pendrive|power bank/.test(t)) return "informatica";
  if (/air fryer|fritadeira eletrica|cafeteira|aspirador|liquidificador|batedeira|ventilador|ferro de passar|barbeador|secador/.test(t)) return "eletroportateis";
  if (/geladeira|refrigerador|freezer|maquina de lavar|lava e seca|microondas|micro.ondas|fogao|cooktop|ar condicionado/.test(t)) return "eletrodomesticos";
  if (/echo|fire tv|kindle/.test(t)) return "dispositivos-inteligentes";
  if (/playstation|xbox|nintendo|console/.test(t)) return "games";
  return "outros";
}

export interface PontuacaoDiversidade {
  oferta: Oferta;
  scoreOriginal: number;
  ajusteVariedade: number;
  scoreFinal: number;
  faixa: FaixaPrecoOferta;
  categoria: string;
}

/**
 * Metas flexíveis para as últimas cinco mensagens:
 * ~2 acessíveis (até R$249), ~2 intermediárias e ~1 de maior valor.
 * São preferências, não cotas obrigatórias: só consideramos boas ofertas
 * já aprovadas pelo filtro editorial.
 */
export function classificarOfertasPorVariedade(
  candidatas: Oferta[],
  historico: RegistroHistoricoOferta[],
  calcular = calcularScore
): PontuacaoDiversidade[] {
  const ultimas = historico
    .filter((registro) => Boolean(registro.enviadoEm))
    .sort((a, b) =>
      Date.parse(b.enviadoEm ?? "") - Date.parse(a.enviadoEm ?? "")
    )
    .slice(0, 5);

  const ultimasCategorias = ultimas.map((registro) => categoriaEditorial(registro.titulo));
  const ultimasFaixas = ultimas
    .filter((registro) => typeof registro.precoAtual === "number")
    .map((registro) => faixaPrecoOferta(registro.precoAtual!));
  const quantFaixa = (faixa: FaixaPrecoOferta) =>
    ultimasFaixas.filter((f) => f === faixa).length;

  const metas: Record<FaixaPrecoOferta, number> = {
    acessivel: 2,
    intermediaria: 2,
    maiorValor: 1
  };

  return candidatas.map((oferta) => {
    const faixa = faixaPrecoOferta(oferta.precoAtual);
    const categoria = categoriaEditorial(oferta.titulo);
    const quantidadeNaFaixa = quantFaixa(faixa);
    const falta = metas[faixa] - quantidadeNaFaixa;
    let ajusteVariedade =
      falta >= 2 ? 46 :
      falta === 1 ? 30 :
      falta === 0 ? (faixa === "maiorValor" ? -38 : -12) :
      -45;

    const quantidadeCategoria =
      ultimasCategorias.filter((c) => c === categoria).length;
    if (categoria !== "outros") {
      ajusteVariedade += quantidadeCategoria === 0 ? 12 : -(quantidadeCategoria * 12);
      if (ultimasCategorias[0] === categoria) ajusteVariedade -= 28;
    }

    // Conter a dominância das ofertas caras quando as duas últimas já
    // foram dessa faixa; não impedir a publicação quando só houver elas.
    if (
      faixa === "maiorValor" &&
      ultimasFaixas[0] === "maiorValor" &&
      ultimasFaixas[1] === "maiorValor"
    ) {
      ajusteVariedade -= 20;
    }

    const scoreOriginal = calcular(oferta);
    return {
      oferta,
      scoreOriginal,
      ajusteVariedade,
      scoreFinal: scoreOriginal + ajusteVariedade,
      faixa,
      categoria
    };
  }).sort((a, b) =>
    b.scoreFinal - a.scoreFinal ||
    b.scoreOriginal - a.scoreOriginal ||
    a.oferta.precoAtual - b.oferta.precoAtual
  );
}

export function escolherOfertaVariada(
  ofertas: Oferta[],
  historico: RegistroHistoricoOferta[]
): PontuacaoDiversidade | undefined {
  return classificarOfertasPorVariedade(ofertas, historico)[0];
}

/**
 * Mercado Livre pode pesquisar uma categoria extra quando sua participação
 * ficar abaixo de duas das últimas cinco ofertas confirmadas. Não obriga a
 * escolher um produto ruim só para completar uma proporção.
 */
export function planejarBuscasMercadoLivre(
  consultas: string[],
  indiceInicial: number,
  consultasBase: number,
  historico: RegistroHistoricoOferta[],
  permitirExtra = true
): { consultas: string[]; minimo: number; ofertaExtra: boolean } {
  if (consultas.length === 0) {
    return { consultas: [], minimo: 0, ofertaExtra: false };
  }
  const quantidadeNormalizada = Number.isFinite(consultasBase)
    ? Math.trunc(consultasBase)
    : 1;
  const limiteBase = Math.max(1, Math.min(consultas.length, quantidadeNormalizada));
  const indice = Number.isFinite(indiceInicial) ? Math.trunc(indiceInicial) : 0;
  const ultimas = [...historico]
    .filter((registro) => registro.enviadoEm)
    .sort((a, b) => Date.parse(b.enviadoEm!) - Date.parse(a.enviadoEm!))
    .slice(0, 5);
  const enviosMercadoLivre = ultimas.filter((registro) =>
    registro.plataforma === "mercado-livre"
  ).length;
  const ofertaExtra = permitirExtra && enviosMercadoLivre < 2;
  const limite = Math.min(consultas.length, limiteBase + (ofertaExtra ? 1 : 0));
  const lista = Array.from(
    { length: limite },
    (_, offset) =>
      consultas[((indice + offset) % consultas.length + consultas.length) % consultas.length]
  );
  return { consultas: lista, minimo: limiteBase, ofertaExtra };
}
