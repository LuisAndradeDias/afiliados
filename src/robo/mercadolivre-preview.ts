import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { MercadoLivreApiFonte } from "../fontes/mercadolivre/api.js";
import type { Oferta } from "../fontes/types.js";
import { calcularScorePromocao } from "../ofertas/score.js";
import { chaveOferta, chavesBloqueadas } from "../ofertas/historico.js";

const consultas = (
  process.env.MERCADOLIVRE_QUERIES ??
  process.env.MERCADOLIVRE_QUERY ??
  "perfume"
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
const porProduto = new Map<string, Oferta>();

for (const consulta of consultasUsadas) {
  console.log(`Buscando Mercado Livre: "${consulta}"`);
  const ofertas = await new MercadoLivreApiFonte(
    consulta,
    limite
  ).buscar();

  for (const oferta of ofertas) {
    oferta.scoreOferta = calcularScorePromocao(oferta);
    const atual = porProduto.get(oferta.produtoId);
    if (
      !atual ||
      (oferta.descontoPercentual ?? 0) >
        (atual.descontoPercentual ?? 0)
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
  .filter((oferta) => (oferta.descontoPercentual ?? 0) >= minimo)
  .filter((oferta) => !bloqueadas.has(chaveOferta(oferta)))
  .sort((a, b) => {
    const descontoA = a.descontoPercentual ?? 0;
    const descontoB = b.descontoPercentual ?? 0;
    return descontoB - descontoA ||
      (b.scoreOferta ?? 0) - (a.scoreOferta ?? 0);
  });

const melhor = elegiveis[0];

console.log(
  `Mercado Livre: ${todas.length} ofertas encontradas, ` +
  `${elegiveis.length} elegiveis com minimo de ${minimo}%.`
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
  `Desconto: ${melhor.descontoPercentual ?? 0}%`
);
console.log(`Categoria de busca: ${melhor.categoria ?? "-"}`);
console.log(`Produto: ${melhor.urlProduto}`);
console.log("-----------------------------------");
