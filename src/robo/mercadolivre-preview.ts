import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { MercadoLivreApiFonte } from "../fontes/mercadolivre/api.js";
import { MercadoLivreReautorizacaoNecessaria } from "../afiliados/mercadolivre-token.js";
import type { Oferta } from "../fontes/types.js";
import { calcularScorePromocao } from "../ofertas/score.js";
import { filtroHistoricoOfertas } from "../ofertas/historico.js";
import {
  aplicarMelhorCupomMercadoLivre,
  obterCuponsMercadoLivre
} from "../afiliados/mercadolivre-cupons.js";
import {
  CONSULTAS_MERCADOLIVRE_AUTORIZADAS,
  DESCONTO_MINIMO_PERCENTUAL
} from "../ofertas/regras-autorizadas.js";

const consultas = [...CONSULTAS_MERCADOLIVRE_AUTORIZADAS];

const limite = Number(process.env.MERCADOLIVRE_LIMIT ?? 10);
const minimo = DESCONTO_MINIMO_PERCENTUAL;
const consultasPorRodada = Math.max(
  1,
  Math.min(
    consultas.length,
    Number(process.env.MERCADOLIVRE_QUERIES_PER_RUN ?? 1)
  )
);
const rotacaoPath = "data/rotacao-mercadolivre.json";
const indiceRotacao = await readFile(rotacaoPath, "utf8")
  .then((texto) => {
    const dados = JSON.parse(texto.replace(/^\uFEFF/, "")) as {
      indice?: number;
    };
    return Number(dados.indice ?? 0);
  })
  .catch(() => 0);
// Expandir até duas categorias AUTORIZADAS adicionais somente se as
// consultas normais não fornecerem oferta elegível, sem alterar cadence.
const extrasSemElegivel = Math.max(0, Math.min(2,
  Number(process.env.MERCADOLIVRE_EXTRA_QUERIES_ON_EMPTY ?? 2) || 0
));
const maxConsultas = Math.min(
  consultas.length, consultasPorRodada + extrasSemElegivel
);
let consultasRealizadas = 0;
let ofertasEncontradasApi = 0;
const bloqueadoPorHistorico = await filtroHistoricoOfertas();
const cupons = await obterCuponsMercadoLivre().catch((error) => {
  const mensagem = error instanceof Error ? error.message : String(error);
  console.warn(`Mercado Livre: catálogo de cupons indisponível: ${mensagem}`);
  return [];
});
const porProduto = new Map<string, Oferta>();

for (let indice = 0; indice < maxConsultas; indice += 1) {
  if (indice >= consultasPorRodada) {
    const elegivelAtual = [...porProduto.values()].some(oferta =>
      (oferta.descontoEfetivoPercentual ??
       oferta.descontoPercentual ?? 0) >= minimo &&
      !bloqueadoPorHistorico(oferta)
    );
    if (elegivelAtual) break;
    console.log(
      "Mercado Livre: categorias iniciais sem oferta elegivel; " +
      "ampliando a busca somente nas categorias aprovadas."
    );
  }
  const consulta = consultas[(indiceRotacao + indice) % consultas.length];
  consultasRealizadas += 1;
  console.log(`Buscando Mercado Livre: "${consulta}"`);
  let ofertas: Oferta[];
  try {
    ofertas = await new MercadoLivreApiFonte(
      consulta,
      limite
    ).buscar();
  } catch (error) {
    if (error instanceof MercadoLivreReautorizacaoNecessaria) {
      console.error("MERCADOLIVRE_RECONNECT_REQUIRED: " + error.message);
      process.exit(3);
    }
    throw error;
  }

  ofertasEncontradasApi += ofertas.length;
  for (const ofertaBase of ofertas) {
    const oferta = aplicarMelhorCupomMercadoLivre(
      ofertaBase,
      cupons
    );
    oferta.scoreOferta = calcularScorePromocao(oferta);

    const atual = porProduto.get(oferta.produtoId);
    if (
      !atual ||
      (oferta.descontoEfetivoPercentual ??
        oferta.descontoPercentual ??
        0) >
        (atual.descontoEfetivoPercentual ??
          atual.descontoPercentual ??
          0)
    ) {
      porProduto.set(oferta.produtoId, oferta);
    }
  }
}

await mkdir("data", { recursive: true });
await writeFile(
  rotacaoPath,
  JSON.stringify({
    indice:
      (indiceRotacao + consultasRealizadas) % consultas.length
  }, null, 2),
  "utf8"
);

const todas = [...porProduto.values()];
const elegiveis = todas
  .filter(
    (oferta) =>
      (oferta.descontoEfetivoPercentual ??
        oferta.descontoPercentual ??
        0) >= minimo
  )
  .filter((oferta) => !bloqueadoPorHistorico(oferta))
  .sort((a, b) => {
    const descontoA =
      a.descontoEfetivoPercentual ?? a.descontoPercentual ?? 0;
    const descontoB =
      b.descontoEfetivoPercentual ?? b.descontoPercentual ?? 0;
    return descontoB - descontoA ||
      (b.scoreOferta ?? 0) - (a.scoreOferta ?? 0);
  });

const melhor = elegiveis[0];

console.log(
  `Mercado Livre: ${consultasRealizadas} consultas autorizadas, ` +
  `${ofertasEncontradasApi} anuncios confirmados na API, ` +
  `${todas.length} produtos distintos, ` +
  `${elegiveis.length} elegiveis com minimo de ${minimo}% ` +
  `(cupons observados no catalogo: ${cupons.length}).`
);
if (!melhor) {
  console.log(
    "Nenhuma oferta do Mercado Livre atingiu o filtro atual."
  );
  process.exit(2);
}

const caminho = "data/ultima-oferta-mercadolivre.json";
await mkdir(dirname(caminho), { recursive: true });
await writeFile(
  caminho,
  JSON.stringify(melhor, null, 2),
  "utf8"
);

console.log("");
console.log("--- MELHOR OFERTA MERCADO LIVRE ---");
console.log(melhor.titulo);
console.log(
  `Preco: R$ ${melhor.precoAtual.toFixed(2)} | ` +
  `Desconto base: ${melhor.descontoPercentual ?? 0}% | ` +
  `Beneficio efetivo: ${melhor.descontoEfetivoPercentual ?? melhor.descontoPercentual ?? 0}%`
);
if (melhor.cupomCodigo) {
  console.log(
    `Cupom candidato: ${melhor.cupomCodigo} | ` +
    `Preco estimado com cupom: R$ ${melhor.precoComCupomEstimado?.toFixed(2) ?? "-"}`
  );
}
console.log(`Categoria de busca: ${melhor.categoria ?? "-"}`);
console.log(`Produto: ${melhor.urlProduto}`);
console.log("-----------------------------------");
