import { readFile } from "node:fs/promises";
import { calcularCentroNaTela } from "../src/robo/whatsapp-pointer.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ponto = calcularCentroNaTela(
  { x: 620, y: 420, width: 120, height: 56 },
  {
    screenX: 0,
    screenY: 0,
    outerWidth: 1936,
    outerHeight: 1048,
    innerWidth: 1920,
    innerHeight: 961
  }
);

assert(
  ponto.x === 688,
  `Centro X esperado 688, recebido ${ponto.x}.`
);
assert(
  ponto.y === 527,
  `Centro Y esperado 527, recebido ${ponto.y}.`
);

const fonte = await readFile("src/robo/whatsapp-pointer.ts", "utf8");
assert(
  fonte.includes("SetCursorPos"),
  "O módulo precisa mover o cursor físico do Windows."
);
assert(
  fonte.includes("mouse_event"),
  "O módulo precisa executar o clique físico do Windows."
);
assert(
  fonte.includes('matches(":hover")'),
  "O clique precisa validar que o cursor físico está sobre o botão."
);

console.log("whatsapp-pointer: OK");
