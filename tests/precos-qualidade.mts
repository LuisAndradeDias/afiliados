import { strict as assert } from "node:assert";
import { calcularDesconto, parsePrecoBR } from "../src/fontes/amazon/preco.js";
import { extrairPrecosAnuncioAmazon } from "../src/fontes/amazon/preco-anuncio.js";
import {
  avaliarQualidadeOferta,
  economiaRealOferta,
  produtoPrioritario
} from "../src/ofertas/qualidade.js";
import { calcularScore } from "../src/ofertas/score.js";
import type { Oferta } from "../src/fontes/types.js";

const cfg = {
  MIN_DISCOUNT_PERCENT: "25",
  MIN_OFFER_PRICE_BRL: "79",
  MIN_OFFER_SAVINGS_BRL: "35"
} as NodeJS.ProcessEnv;

function criarOferta(parcial: Partial<Oferta>): Oferta {
  return {
    plataforma: "Amazon Brasil",
    produtoId: "TESTE",
    titulo: "Smartphone Samsung Galaxy A56 128GB",
    precoAtual: 1199,
    precoAnterior: 1599,
    descontoPercentual: 25,
    urlProduto: "https://www.amazon.com.br/dp/TESTE",
    encontradoEm: new Date(),
    ...parcial
  };
}

assert.equal(parsePrecoBR("R$ 3.539,58"), 3539.58);
assert.equal(parsePrecoBR("R$ 16,99"), 16.99);
assert.equal(parsePrecoBR(""), undefined);
assert.equal(parsePrecoBR("Preço indisponível"), undefined);
assert.equal(calcularDesconto(16.99, 3539.58), undefined, "Preço por kg não pode virar 100% OFF");
assert.equal(calcularDesconto(16.99, 24.10), 29, "Desconto real sem arredondar para cima");
assert.equal(calcularDesconto(500, 5000), 90, "90% confirmado pode ser válido");
assert.equal(calcularDesconto(499, 5000), undefined, "Acima de 90% exige revisão");

const atual = [{ texto: "R$ 16,99", contexto: "R$ 16,99" }];
const anteriorPorKg = [{
  texto: "R$ 3.539,58",
  contexto: "R$ 3.539,58 / kg",
  riscado: false
}];
const anteriorNivea = [{
  texto: "R$ 24,10",
  contexto: "De: R$ 24,10",
  riscado: true
}];

const nivea = extrairPrecosAnuncioAmazon(
  atual,
  [...anteriorPorKg, ...anteriorNivea]
);
assert.equal(nivea.precoAtual, 16.99);
assert.equal(nivea.precoAnterior, 24.10);
assert.equal(nivea.descontoPercentual, 29, "Não pode divulgar 100% OFF");
assert.deepEqual(
  extrairPrecosAnuncioAmazon(atual, anteriorPorKg),
  { precoAtual: 16.99 },
  "Sem preço anterior confirmado não deve calcular desconto"
);

const falsoRiscado = extrairPrecosAnuncioAmazon(atual, [{
  texto: "R$ 3.539,58",
  contexto: "R$ 3.539,58",
  riscado: true
}]);
assert.deepEqual(falsoRiscado, { precoAtual: 16.99 });
assert.deepEqual(
  extrairPrecosAnuncioAmazon([
    { texto: "R$ 2.500,00/kg", contexto: "R$ 2.500,00/kg" },
    { texto: "R$ 1.499,90" }
  ], [
    { texto: "R$ 1.999,90", contexto: "De: R$ 1.999,90" }
  ]),
  { precoAtual: 1499.90, precoAnterior: 1999.90, descontoPercentual: 25 }
);

const niveaComPrecoReal = criarOferta({
  titulo: "NIVEA Hidratante Labial Amora Shine 4,8g",
  precoAtual: 16.99,
  precoAnterior: 24.10,
  descontoPercentual: 30
});
assert.equal(avaliarQualidadeOferta(niveaComPrecoReal, cfg).elegivel, false);

const fraudeQuilo = criarOferta({
  titulo: "NIVEA Hidratante Labial Amora Shine 4,8g",
  precoAtual: 16.99,
  precoAnterior: 3539.58,
  descontoPercentual: 100
});
assert.equal(avaliarQualidadeOferta(fraudeQuilo, cfg).elegivel, false);
assert.equal(economiaRealOferta(fraudeQuilo), 0, "Não aceitar economia pelo kg");

const smartphone = criarOferta({});
assert.equal(avaliarQualidadeOferta(smartphone, cfg).elegivel, true);
assert.equal(avaliarQualidadeOferta(smartphone, cfg).prioritario, true);
assert.equal(economiaRealOferta(smartphone), 400);

const boas = [
  ["Smart TV Samsung 50 polegadas", 1899, 2499, 24],
  ["Fone Bluetooth JBL Tune 520BT", 99, 149, 34],
  ["Air Fryer Mondial 4 litros", 269, 399, 33],
  ["Notebook Lenovo IdeaPad 8GB", 1999, 2799, 29],
  ["Cafeteira Nespresso Essenza Mini", 369, 499, 26],
  ["Aspirador de po WAP vertical", 229, 349, 34],
  ["SSD Kingston NV3 1TB", 299, 399, 25]
] as const;

for (const [titulo, precoAtual, precoAnterior, descontoPercentual] of boas) {
  const oferta = criarOferta({ titulo, precoAtual, precoAnterior, descontoPercentual });
  assert.equal(produtoPrioritario(oferta), true, "Categoria inválida: " + titulo);
  if (descontoPercentual >= 25) {
    assert.equal(
      avaliarQualidadeOferta(oferta, cfg).elegivel,
      true,
      "Oferta importante rejeitada: " + titulo
    );
  }
}

const baixoValor = criarOferta({
  titulo: "Película para Samsung Galaxy A56",
  precoAtual: 89, precoAnterior: 159, descontoPercentual: 44
});
assert.equal(avaliarQualidadeOferta(baixoValor, cfg).elegivel, false);
const suporteTV = criarOferta({
  titulo: "Suporte para Smart TV 50 polegadas",
  precoAtual: 149, precoAnterior: 299, descontoPercentual: 50
});
assert.equal(avaliarQualidadeOferta(suporteTV, cfg).elegivel, false);

const cupomConfirmado = criarOferta({
  titulo: "Fone Bluetooth Sony",
  plataforma: "Mercado Livre",
  precoAtual: 150,
  precoAnterior: undefined,
  precoComCupomEstimado: 95,
  descontoEfetivoPercentual: 37,
  descontoPercentual: undefined,
  cupomValidacao: "produto-confirmado"
});
assert.equal(avaliarQualidadeOferta(cupomConfirmado, cfg).elegivel, true);
assert.equal(
  avaliarQualidadeOferta({ ...cupomConfirmado, cupomValidacao: "catalogo-oficial-estimado" }, cfg).elegivel,
  false,
  "Cupom não confirmado não prova economia sem referência"
);

const grandeEconomia = criarOferta({
  titulo: "Notebook ASUS Vivobook",
  precoAtual: 2699,
  precoAnterior: 3299,
  descontoPercentual: 18
});
assert.equal(avaliarQualidadeOferta(grandeEconomia, cfg).elegivel, false, "Desconto insuficiente");

const custoRelevante = criarOferta({
  titulo: "Smart TV TCL",
  precoAtual: 1999,
  precoAnterior: 2799,
  descontoPercentual: 29
});
const baratoMenorGanho = criarOferta({
  titulo: "Fone Bluetooth QCY",
  precoAtual: 100,
  precoAnterior: 225,
  descontoPercentual: 56
});
assert.ok(calcularScore(custoRelevante) > calcularScore(baratoMenorGanho),
  "Economia relevante precisa vencer só a porcentagem grande");

console.log("precos-qualidade: OK (NIVEA por kg, ofertas prioritarias, acessorios, cupons e ranking)");
