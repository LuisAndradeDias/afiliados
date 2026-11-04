import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  DESCONTO_MINIMO_PERCENTUAL, COOLDOWN_ENVIO_HORAS,
  COOLDOWN_PREVIA_MINUTOS
} from "../src/ofertas/regras-autorizadas.js";
import { lerConfigAutoEnvio, deveAutoEnviar } from "../src/robo/whatsapp-auto-send.js";

test("motor mantém regras expressamente autorizadas", () => {
  assert.equal(DESCONTO_MINIMO_PERCENTUAL, 20);
  assert.equal(COOLDOWN_ENVIO_HORAS, 24);
  assert.equal(COOLDOWN_PREVIA_MINUTOS, 120);
  const auto = lerConfigAutoEnvio({
    WHATSAPP_AUTO_SEND_ENABLED: "true", WHATSAPP_AUTO_SEND_DELAY_MS: "1500"
  } as NodeJS.ProcessEnv);
  assert.equal(auto.enabled, true);
  assert.equal(auto.delayMs, 1500);
  assert.equal(deveAutoEnviar(2500, 1000, auto, false), true);
  assert.equal(deveAutoEnviar(2500, 1000, auto, true), false);
});

test("camada recuperada não introduz Instagram ou políticas antigas", async () => {
  const files = [
    "src/painel/rotas-visuais.ts",
    "src/painel/revisao-http.ts",
    "src/painel/public/central.html",
    "src/painel/public/central.js",
    "src/painel/public/unified-nav.js",
    "src/painel/public/ofertas-cockpit.js",
    "src/painel/public/revisao.js"
  ];
  for (const file of files) {
    const text = (await readFile(file, "utf8")).toLowerCase();
    assert.doesNotMatch(text, /instagram|story\/reel|tempomediobutton|tempocurtobutton|promo_interval_mode|4 por hora|168h|homologa[cç][aã]o obrigat[oó]ria/,
      "Política antiga na camada visual: " + file);
  }
  const server = await readFile("src/painel/server.ts", "utf8");
  assert.match(server, /whatsappAutoEnvioAtivo/);
  assert.match(server, /whatsappAutoEnvioDelayMs/);
  assert.match(server, /whatsapp-auto-send-set/);
  assert.doesNotMatch(server, /consultarElegibilidadeCanalWhatsapp|intervalos-envio|instagram/);
});
