import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  calcularProximaPublicacao,
  intervaloFaixas,
  modoIntervaloValido,
  normalizarModoIntervalo
} from "../src/ofertas/intervalos-envio.js";

const minutos = (valor: number) => valor * 60_000;
const referencia = Date.parse("2026-10-13T12:00:00.000Z");
const registro = (deslocamentoMin: number, nome: string) => ({
  chave: "amazon:" + nome,
  enviadoEm: new Date(referencia + minutos(deslocamentoMin)).toISOString()
});

test("opções e limites exatos", () => {
  assert.deepEqual(intervaloFaixas("medio"), {
    normal: [minutos(10), minutos(25)],
    prolongado: [minutos(30), minutos(45)]
  });
  assert.deepEqual(intervaloFaixas("curto"), {
    normal: [minutos(5), minutos(12.5)],
    prolongado: [minutos(15), minutos(22.5)]
  });
  assert.equal(modoIntervaloValido("medio"), true);
  assert.equal(modoIntervaloValido("curto"), true);
  assert.equal(modoIntervaloValido("qualquer"), false);
  assert.equal(normalizarModoIntervalo("qualquer"), "medio");
});

test("o intervalo só considera mensagens realmente enviadas", () => {
  const dados = [
    { chave: "amazon:nao-enviado", enviadoEm: undefined },
    registro(0, "primeiro")
  ];
  const plano = calcularProximaPublicacao(dados, "medio");
  assert.equal(plano.publicacoesNoDia, 1);
  assert.equal(plano.pausaLonga, false);
  assert.ok(plano.esperaSorteadaMs >= minutos(10));
  assert.ok(plano.esperaSorteadaMs <= minutos(25));
  assert.equal(plano.proximaLiberacaoEm, referencia + plano.esperaSorteadaMs);
  assert.equal(calcularProximaPublicacao([], "medio").proximaLiberacaoEm, 0);
});

test("o tempo curto é metade exata do médio para a mesma oferta", () => {
  const dados = [registro(0, "fone")];
  const medio = calcularProximaPublicacao(dados, "medio");
  const curto = calcularProximaPublicacao(dados, "curto");
  assert.equal(curto.esperaSorteadaMs * 2, medio.esperaSorteadaMs);
  assert.ok(curto.esperaSorteadaMs >= minutos(5));
  assert.ok(curto.esperaSorteadaMs <= minutos(12.5));
});

test("depois da quarta publicação a espera é prolongada", () => {
  const dados = [
    registro(-52, "primeiro"),
    registro(-39, "segundo"),
    registro(-25, "terceiro"),
    registro(0, "quarto")
  ];
  const medio = calcularProximaPublicacao(dados, "medio");
  const curto = calcularProximaPublicacao(dados, "curto");
  assert.equal(medio.publicacoesNoDia, 4);
  assert.equal(medio.pausaLonga, true);
  assert.ok(medio.esperaSorteadaMs >= minutos(30));
  assert.ok(medio.esperaSorteadaMs <= minutos(45));
  assert.ok(curto.esperaSorteadaMs >= minutos(15));
  assert.ok(curto.esperaSorteadaMs <= minutos(22.5));
  assert.equal(curto.esperaSorteadaMs * 2, medio.esperaSorteadaMs);
});

test("em ambos os modos o limite é de quatro envios por hora", () => {
  const dados = [
    registro(-14, "primeiro"),
    registro(-9, "segundo"),
    registro(-4, "terceiro"),
    registro(0, "quarto")
  ];
  const curto = calcularProximaPublicacao(dados, "curto");
  assert.equal(curto.limitadoPorHora, true);
  assert.equal(curto.proximaLiberacaoEm, referencia - minutos(14) + minutos(60) + 1_000);
});

test("reabrir o painel preserva o sorteio, e o quinto envio retoma intervalo normal", () => {
  const dados = [
    registro(-50, "primeiro"),
    registro(-40, "segundo"),
    registro(-30, "terceiro"),
    registro(-24, "quarto"),
    registro(0, "quinto")
  ];
  const direto = calcularProximaPublicacao(dados, "medio");
  const reiniciado = calcularProximaPublicacao([...dados].reverse(), "medio");
  assert.deepEqual(reiniciado, direto);
  assert.equal(direto.pausaLonga, false);
  assert.ok(direto.esperaSorteadaMs >= minutos(10));
  assert.ok(direto.esperaSorteadaMs <= minutos(25));
});

console.log("intervalos-envio: OK (médio, curto, pausa após 4, máximo 4/h e reinício)");
