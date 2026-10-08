import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import type { Oferta } from "../src/fontes/types.js";
import type { RegistroHistoricoOferta } from "../src/ofertas/historico.js";
import { avaliarQualidadeOferta, faixaPrecoOferta } from "../src/ofertas/qualidade.js";
import {
  categoriaEditorial,
  classificarOfertasPorVariedade,
  escolherOfertaVariada,
  planejarBuscasMercadoLivre
} from "../src/ofertas/diversidade.js";

const config = {
  MIN_DISCOUNT_PERCENT: "25",
  MIN_OFFER_PRICE_BRL: "49",
  MIN_OFFER_SAVINGS_BRL: "20"
} as NodeJS.ProcessEnv;

function oferta(titulo: string, precoAtual: number, precoAnterior: number): Oferta {
  const desconto = Math.floor((1 - precoAtual / precoAnterior) * 100);
  return {
    titulo,
    precoAtual,
    precoAnterior,
    plataforma: "Amazon Brasil",
    produtoId: titulo.slice(0, 10),
    descontoPercentual: desconto,
    urlProduto: "https://www.amazon.com.br/dp/EXEMPLO",
    encontradoEm: new Date()
  };
}
function registro(
  titulo: string,
  precoAtual: number,
  indice: number,
  plataforma = "amazon"
): RegistroHistoricoOferta {
  return {
    chave: plataforma + ":item-" + indice,
    produtoId: "item-" + indice,
    plataforma,
    titulo,
    precoAtual,
    enviadoEm: new Date(Date.now() - (indice + 1) * 60_000).toISOString()
  };
}

assert.equal(faixaPrecoOferta(59), "acessivel");
assert.equal(faixaPrecoOferta(249.99), "acessivel");
assert.equal(faixaPrecoOferta(250), "intermediaria");
assert.equal(faixaPrecoOferta(1199.99), "intermediaria");
assert.equal(faixaPrecoOferta(1200), "maiorValor");

const bonsAcessiveis = [
  oferta("Fone de ouvido Bluetooth JBL Tune 510BT", 89.9, 129.9),
  oferta("Mouse sem fio Logitech M170", 59.9, 89.9),
  oferta("Teclado mecânico Redragon Kumara", 149.9, 229.9),
  oferta("Caixa de som Bluetooth JBL Go", 199.9, 299.9),
  oferta("Power Bank 10000mAh Baseus", 79.9, 119.9),
  oferta("Smartwatch Amazfit Bip", 219.9, 309.9),
  oferta("Webcam Logitech C270", 119.9, 189.9)
];
for (const item of bonsAcessiveis) {
  assert.equal(avaliarQualidadeOferta(item, config).elegivel, true,
    "Deve aceitar oferta acessível útil: " + item.titulo);
}
assert.equal(categoriaEditorial("Fone de ouvido sem fio JBL"), "fones");
assert.equal(categoriaEditorial("Headset Gamer HyperX"), "fones");
assert.equal(categoriaEditorial("Caixa de Som Bluetooth JBL"), "audio");
assert.equal(categoriaEditorial("Notebook Samsung Galaxy Book"), "computadores");
assert.equal(categoriaEditorial("Air Fryer Mondial 4L"), "eletroportateis");

const fracos = [
  oferta("NIVEA Hidratante Labial Amora Shine", 49.9, 89.9),
  oferta("Película para Smartphone Samsung Galaxy", 79.9, 199.9),
  oferta("Fone Bluetooth Genérico", 55, 65),
  oferta("Fone Bluetooth Genérico", 39.9, 99.9),
  oferta("Carregador de celular capa protetora", 59.9, 99.9)
];
for (const item of fracos) {
  assert.equal(avaliarQualidadeOferta(item, config).elegivel, false,
    "Não liberar item fora do foco ou desconto falso/baixo: " + item.titulo);
}
const notebook = oferta("Notebook Lenovo Ideapad Ryzen 5", 2099, 2899);
const geladeira = oferta("Geladeira Electrolux Frost Free 380L", 2399, 3599);
const aspirador = oferta("Aspirador de pó WAP 1000W", 279.9, 399.9);
const fone = bonsAcessiveis[0];
const mouse = bonsAcessiveis[1];
const historicoComCaros = [
  registro("Notebook Samsung Galaxy Book", 2300, 0),
  registro("Geladeira Electrolux 380L", 2200, 1),
  registro("Cafeteira Oster inox", 340, 2),
  registro("Aspirador vertical Electrolux", 290, 3),
  registro("Roteador Intelbras Twibi AX", 450, 4)
];
const escolhido = escolherOfertaVariada([notebook, geladeira, fone, mouse, aspirador], historicoComCaros);
assert.ok(escolhido, "Deve escolher produto elegível");
assert.equal(escolhido.faixa, "acessivel",
  "Depois de dois itens caros, deve favorecer oferta acessível de qualidade");

const historicoMuitosFones = [
  registro("Headset HyperX Cloud Stinger", 130, 0),
  registro("Fone Bluetooth JBL", 120, 1),
  registro("Notebook Samsung Galaxy Book", 2300, 2),
  registro("Geladeira Electrolux 380L", 2200, 3),
  registro("Roteador Intelbras Twibi AX", 450, 4)
];
const alternativas = classificarOfertasPorVariedade([fone, mouse], historicoMuitosFones);
assert.equal(alternativas[0].categoria, "perifericos",
  "Evitar repetir fones em sequência quando há mouse elegível");

const soCaros = escolherOfertaVariada([notebook, geladeira], historicoComCaros);
assert.ok(soCaros, "Sem alternativa válida, ainda pode publicar oferta cara boa");
assert.equal(soCaros.faixa, "maiorValor");

const ultimasComPoucoMeli = [
  registro("Fone Bluetooth JBL", 95, 0, "amazon"),
  registro("Geladeira Electrolux 380L", 2200, 1, "amazon"),
  registro("Air Fryer Mondial", 290, 2, "mercado-livre"),
  registro("Notebook Acer", 2399, 3, "amazon"),
  registro("Cafeteira Oster", 259, 4, "amazon")
];
const consultas = ["fone bluetooth", "mouse sem fio", "caixa de som", "air fryer", "smartphone"];
const planoComDeficit = planejarBuscasMercadoLivre(consultas, 4, 2, ultimasComPoucoMeli);
assert.deepEqual(planoComDeficit.consultas, ["smartphone", "fone bluetooth", "mouse sem fio"]);
assert.equal(planoComDeficit.minimo, 2);
assert.equal(planoComDeficit.ofertaExtra, true);
assert.deepEqual(planejarBuscasMercadoLivre([], 0, 2, []), {
  consultas: [], minimo: 0, ofertaExtra: false
});

const comMaisMeli = ultimasComPoucoMeli.map((r) => ({ ...r }));
comMaisMeli[1].plataforma = "mercado-livre";
assert.deepEqual(
  planejarBuscasMercadoLivre(consultas, 0, 2, comMaisMeli).consultas,
  ["fone bluetooth", "mouse sem fio"],
  "Com duas ofertas ML recentes não exceder duas buscas"
);
assert.equal(
  planejarBuscasMercadoLivre(consultas, 0, 2, ultimasComPoucoMeli, false).consultas.length,
  2,
  "Permitir desligar a terceira busca"
);

const template = await readFile(".env.example", "utf8");
assert.match(template, /^MIN_OFFER_PRICE_BRL=49$/m);
assert.match(template, /^MIN_OFFER_SAVINGS_BRL=20$/m);
assert.match(template, /^MERCADOLIVRE_QUERIES_PER_RUN=2$/m);
assert.match(template, /^MERCADOLIVRE_EXTRA_IF_LOW_SHARE=true$/m);
for (const palavra of ["fone bluetooth", "headset gamer", "mouse sem fio", "caixa de som bluetooth", "smartwatch"]) {
  assert.ok(template.includes(palavra), "Busca ausente: " + palavra);
}
console.log(
  "variedade-ofertas: OK (fones baratos e eletrônicos úteis, 3 faixas, " +
  "diversidade de categorias, alta economia sem domínio dos caros, buscas ML adaptativas)"
);
