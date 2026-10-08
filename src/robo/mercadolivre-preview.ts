import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { MercadoLivreApiFonte } from "../fontes/mercadolivre/api.js";
import { MercadoLivreReautorizacaoNecessaria } from "../afiliados/mercadolivre-token.js";
import type { Oferta } from "../fontes/types.js";
import { calcularScore } from "../ofertas/score.js";
import { avaliarQualidadeOferta, economiaRealOferta } from "../ofertas/qualidade.js";
import { chaveOferta, chavesBloqueadas } from "../ofertas/historico.js";
import {
  aplicarMelhorCupomMercadoLivre,
  obterCuponsMercadoLivre
} from "../afiliados/mercadolivre-cupons.js";

const consultas = (
  process.env.MERCADOLIVRE_QUERIES ??
  process.env.MERCADOLIVRE_QUERY ??
  "smartphone"
)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const limite = Number(process.env.MERCADOLIVRE_LIMIT ?? 10);
const minimo = Number(process.env.MIN_DISCOUNT_PERCENT ?? 20);
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
const consultasUsadas = Array.from(
  { length: consultasPorRodada },
  (_, offset) =>
    consultas[(indiceRotacao + offset) % consultas.length]
);
const bloqueadas = await chavesBloqueadas();
const cupons = await obterCuponsMercadoLivre().catch((error) => {
  const mensagem = error instanceof Error ? error.message : String(error);
  console.warn(`Mercado Livre: catálogo de cupons indisponível: ${mensagem}`);
  return [];
});
const porProduto = new Map<string, Oferta>();

for (const consulta of consultasUsadas) {
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

  for (const ofertaBase of ofertas) {
    const oferta = aplicarMelhorCupomMercadoLivre(
      ofertaBase,
      cupons
    );
    oferta.scoreOferta = calcularScore(oferta);

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
      (indiceRotacao + consultasPorRodada) % consultas.length
  }, null, 2),
  "utf8"
);

const todas = [...porProduto.values()];
const elegiveis = todas
  .filter((oferta) => avaliarQualidadeOferta(oferta).elegivel)
  .filter((oferta) => !bloqueadas.has(chaveOferta(oferta)))
  .sort((a, b) =>
    (b.scoreOferta ?? 0) - (a.scoreOferta ?? 0) ||
    economiaRealOferta(b) - economiaRealOferta(a)
  );

const melhor = elegiveis[0];

console.log(
  `Mercado Livre: ${todas.length} ofertas encontradas, ` +
  `${elegiveis.length} elegiveis com minimo de ${minimo}% ` +
  `(cupons ativos considerados: ${cupons.length}).`
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
