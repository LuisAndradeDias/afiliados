import test from "node:test";
import assert from "node:assert/strict";
import { proximoStatusTentativaWeb } from "../src/estados/tentativa-web.mjs";

test("reserva só avança conversa aberta, nunca libera tentativa incerta ou confirmada", () => {
  assert.equal(proximoStatusTentativaWeb("aberto", "reservar"), "incerto");
  assert.equal(proximoStatusTentativaWeb("incerto", "reservar"), "incerto");
  assert.equal(proximoStatusTentativaWeb("enviado-manualmente", "reservar"), "enviado-manualmente");
  assert.equal(proximoStatusTentativaWeb("pendente", "reservar"), "pendente");
  assert.equal(proximoStatusTentativaWeb("ignorado", "reservar"), "ignorado");
});

test("confirmar envio exige reserva incerta já feita, sem duplicidade", () => {
  assert.equal(proximoStatusTentativaWeb("incerto", "confirmar"), "enviado-manualmente");
  for (const status of ["aberto", "pendente", "enviado-manualmente", "cancelado", "ignorado"]) {
    assert.throws(() => proximoStatusTentativaWeb(status, "confirmar"), /incerta/);
  }
});

test("conciliação só libera reenvio após decisão humana e nunca relança sozinha", () => {
  assert.equal(proximoStatusTentativaWeb("incerto", "conciliar-enviado"), "enviado-manualmente");
  assert.equal(proximoStatusTentativaWeb("incerto", "conciliar-nao-enviado"), "pendente");
  assert.equal(proximoStatusTentativaWeb("incerto", "conciliar-nao-enviado",
    { invalidada: true }), "ignorado");
  for (const status of ["pendente", "aberto", "enviado-manualmente"]) {
    assert.throws(() => proximoStatusTentativaWeb(status, "conciliar-enviado"), /incerta/);
    assert.throws(() => proximoStatusTentativaWeb(status, "conciliar-nao-enviado"), /incerta/);
  }
});

test("evento desconhecido é rejeitado sem alterar fila", () => {
  assert.throws(() => proximoStatusTentativaWeb("incerto", "auto-enviar"), /Evento desconhecido/);
  assert.throws(() => proximoStatusTentativaWeb("pendente", undefined), /Evento desconhecido/);
});
