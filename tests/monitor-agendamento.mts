import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularAtrasoMonitor, criarTemporizadorExclusivo
} from "../src/painel/dominios/monitor-agendamento.js";

test("agendamento mantém intervalo confirmado, atraso mínimo e solicitado", () => {
  assert.deepEqual(calcularAtrasoMonitor({
    agoraEm: 10_000, atrasoSolicitadoMs: 100, proximaLiberacaoEm: 10_000
  }), { esperaRestanteMs: 0, atrasoMs: 500, proximaBuscaEm: 10_500 });

  assert.deepEqual(calcularAtrasoMonitor({
    agoraEm: 10_000, atrasoSolicitadoMs: 8_000, proximaLiberacaoEm: 24_000
  }), { esperaRestanteMs: 14_000, atrasoMs: 14_000, proximaBuscaEm: 24_000 });

  assert.deepEqual(calcularAtrasoMonitor({
    agoraEm: 10_000, atrasoSolicitadoMs: 12_000, proximaLiberacaoEm: 12_000
  }), { esperaRestanteMs: 2_000, atrasoMs: 12_000, proximaBuscaEm: 22_000 });

  assert.equal(calcularAtrasoMonitor({
    agoraEm: 10_000, atrasoSolicitadoMs: -100, proximaLiberacaoEm: 0
  }).atrasoMs, 500);
});

test("timer desarmado não executa callback antiga, mesmo já enfileirada", () => {
  let nextId = 0;
  const jobs = new Map();
  const cancelled = [];
  const clock = criarTemporizadorExclusivo({
    agendar: (fn, delayMs) => {
      const id = ++nextId;
      jobs.set(id, { fn, delayMs });
      return id;
    },
    cancelar: id => { cancelled.push(id); }
  });
  let calls = 0;
  clock.armar(() => calls++, 6_000);
  assert.equal(clock.temPendente(), true);
  assert.equal(jobs.get(1).delayMs, 6_000);
  clock.desarmar();
  assert.equal(clock.temPendente(), false);
  jobs.get(1).fn(); // simula callback já enfileirada no event loop
  assert.equal(calls, 0);
  assert.deepEqual(cancelled, [1]);
});

test("reagendar invalida turno anterior, mesmo se o callback cancelado disparar", () => {
  let n = 0;
  const jobs = new Map();
  const clock = criarTemporizadorExclusivo({
    agendar: fn => {
      const id = ++n;
      jobs.set(id, fn);
      return id;
    },
    cancelar: () => {}
  });
  const events = [];
  clock.armar(() => events.push("amazon"), 1_000);
  clock.armar(() => events.push("mercado-livre"), 2_000);
  jobs.get(1)();
  assert.deepEqual(events, []);
  assert.equal(clock.temPendente(), true);
  jobs.get(2)();
  assert.deepEqual(events, ["mercado-livre"]);
  assert.equal(clock.temPendente(), false);
  jobs.get(2)(); // event loop nunca deve entregar duas vezes o mesmo turno
  assert.deepEqual(events, ["mercado-livre"]);
});

test("desarmar após execução não ressuscita timers", () => {
  let callback;
  const clock = criarTemporizadorExclusivo({
    agendar: fn => { callback = fn; return "token"; },
    cancelar: () => { throw Error("não cancelar timer já concluído"); }
  });
  let calls = 0;
  clock.armar(() => calls++, 500);
  callback();
  assert.equal(calls, 1);
  clock.desarmar();
  assert.equal(clock.temPendente(), false);
});
