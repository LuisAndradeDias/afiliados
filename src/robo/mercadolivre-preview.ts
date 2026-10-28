import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  MercadoLivreApiFonte,
  MercadoLivreLimiteRequisicoes
} from "../fontes/mercadolivre/api.js";
import { MercadoLivreReautorizacaoNecessaria } from "../afiliados/mercadolivre-token.js";
import type { Oferta } from "../fontes/types.js";
import { calcularScore } from "../ofertas/score.js";
import { avaliarCupomParaDivulgacao } from "../ofertas/cupons-politica.js";
import { avaliarQualidadeOferta, descontoMinimoOferta } from "../ofertas/qualidade.js";
import { consultasMercadoLivre } from "../fontes/mercadolivre/busca-config.js";
import { filtroHistoricoOfertas, ultimasOfertasEnviadas } from "../ofertas/historico.js";
import { escolherOfertaVariada, planejarBuscasMercadoLivre } from "../ofertas/diversidade.js";
import {
  aplicarMelhorCupomMercadoLivre,
  obterCuponsMercadoLivre
} from "../afiliados/mercadolivre-cupons.js";

const consultas = consultasMercadoLivre();

const limite = Number(process.env.MERCADOLIVRE_LIMIT ?? 10);
const minimo = descontoMinimoOferta();
const consultasPorRodada = Math.max(
  1,
  Math.min(
    consultas.length,
    Number(process.env.MERCADOLIVRE_QUERIES_PER_RUN ?? 3)
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
const recentes = await ultimasOfertasEnviadas(5);
const plano = planejarBuscasMercadoLivre(
  consultas,
  indiceRotacao,
  consultasPorRodada,
  recentes,
  process.env.MERCADOLIVRE_EXTRA_IF_LOW_SHARE !== "false"
);
const consultasUsadas = plano.consultas;
console.log(
  "Mercado Livre: busca rotativa de " + consultasUsadas.length +
  " categorias entre " + consultas.length + " dispon�veis. " +
  "Filtro editorial real: desconto m�nimo " + minimo + "%, economia em reais e vendedor verde."
);
const bloqueadoPorHistorico = await filtroHistoricoOfertas();
let consultasRealizadas = 0;
const cupons = await obterCuponsMercadoLivre().catch(() => {
  console.warn("Mercado Livre: sem cupons oficiais verific�veis nesta rodada; buscando descontos dos pr�prios an�ncios.");
  return [];
});
const porProduto = new Map<string, Oferta>();

for (const consulta of consultasUsadas) {
  if (consultasRealizadas >= plano.minimo) {
    const elegivelJaEncontrada = [...porProduto.values()].some((oferta) =>
      avaliarQualidadeOferta(oferta).elegivel &&
      !bloqueadoPorHistorico(oferta)
    );
    if (elegivelJaEncontrada) break;
    console.log(
      "Mercado Livre: procurando mais uma categoria para ampliar a variedade."
    );
  }
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
    if (error instanceof MercadoLivreLimiteRequisicoes) {
      console.error("MERCADOLIVRE_RATE_LIMIT: HTTP 429 limite de requisicoes; rodada interrompida sem novos acessos.");
      process.exit(5);
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
      (avaliarCupomParaDivulgacao(oferta).podeAnunciar
        ? (oferta.descontoEfetivoPercentual ?? oferta.descontoPercentual ?? 0)
        : (oferta.descontoPercentual ?? 0)) >
        (avaliarCupomParaDivulgacao(atual).podeAnunciar
          ? (atual.descontoEfetivoPercentual ?? atual.descontoPercentual ?? 0)
          : (atual.descontoPercentual ?? 0))
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
const motivos = new Map<string, number>();
for (const oferta of todas) {
  const avaliacao = avaliarQualidadeOferta(oferta);
  const motivo = !avaliacao.elegivel
    ? avaliacao.motivo
    : bloqueadoPorHistorico(oferta) ? "ja enviada ou vista" : "elegivel";
  motivos.set(motivo, (motivos.get(motivo) ?? 0) + 1);
}
if (motivos.size) {
  console.log(
    "Mercado Livre: diagn�stico dos filtros: " +
    [...motivos].map(([motivo, total]) => `${motivo}=${total}`).join(", ")
  );
}

const elegiveis = todas
  .filter((oferta) => avaliarQualidadeOferta(oferta).elegivel)
  .filter((oferta) => !bloqueadoPorHistorico(oferta));
const escolhida = escolherOfertaVariada(elegiveis, recentes);
const melhor = escolhida?.oferta;
if (escolhida) {
  console.log(
    `Variedade Mercado Livre: faixa=${escolhida.faixa}, categoria=${escolhida.categoria}, ` +
    `pontuacao ajustada=${escolhida.scoreFinal}.`
  );
}

console.log(
  `Mercado Livre: ${todas.length} candidatos com vendedor verificado, ` +
  `${elegiveis.length} elegiveis com minimo real de ${minimo}% ` +
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
