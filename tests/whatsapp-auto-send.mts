import {
  deveAutoEnviar,
  lerConfigAutoEnvio
} from "../src/robo/whatsapp-auto-send.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ligado = lerConfigAutoEnvio({
  WHATSAPP_AUTO_SEND_ENABLED: "true",
  WHATSAPP_AUTO_SEND_DELAY_MS: "2000"
} as NodeJS.ProcessEnv);

assert(ligado.enabled, "Autoenvio deveria estar habilitado.");
assert(ligado.delayMs === 2000, "Delay configurado não foi respeitado.");
assert(
  !deveAutoEnviar(2_999, 1_000, ligado, false),
  "Autoenvio disparou antes do delay."
);
assert(
  deveAutoEnviar(3_000, 1_000, ligado, false),
  "Autoenvio deveria disparar ao atingir o delay."
);
assert(
  !deveAutoEnviar(4_000, 1_000, ligado, true),
  "Autoenvio não pode repetir depois da primeira tentativa."
);

const desligado = lerConfigAutoEnvio({} as NodeJS.ProcessEnv);
assert(!desligado.enabled, "Autoenvio deve ser opt-in.");
assert(
  !deveAutoEnviar(10_000, 0, desligado, false),
  "Autoenvio desligado não pode disparar."
);

console.log("whatsapp-auto-send: OK");
