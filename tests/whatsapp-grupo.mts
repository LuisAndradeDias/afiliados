import { strict as assert } from "node:assert";
import { termoBuscaGrupoWhatsapp } from "../src/robo/whatsapp-grupo.js";

const exemplos = [
  ["Caça Promos Vip👑", "Caça Promos Vip"],
  ["Caça Promos Vip 👑", "Caça Promos Vip"],
  ["👑 Caça Promos Vip", "Caça Promos Vip"],
  ["Caça Promos Vip", "Caça Promos Vip"],
  ["  Caça   Promos  Vip  👑 ", "Caça Promos Vip"],
  ["Promoções 👩🏽‍💻 VIP", "Promoções VIP"],
  ["Ofertas 🇧🇷 VIP", "Ofertas VIP"],
  ["👑", "👑"]
] as const;

for (const [completo, esperado] of exemplos) {
  assert.equal(
    termoBuscaGrupoWhatsapp(completo),
    esperado,
    "Termo de busca incorreto para " + completo
  );
}

console.log("whatsapp-grupo: OK (8 casos, busca sem emoji)");
