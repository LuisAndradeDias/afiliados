import { chromium } from "playwright";
import {
  captureSendBaseline,
  detectManualSend
} from "../src/robo/whatsapp-envio-observer.js";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true
});

try {
  const page = await browser.newPage();

  await page.setContent(`
    <div id="main">
      <div class="message-out" data-id="true_old">Oferta antiga</div>
      <div class="message-in" data-id="false_1">Mensagem recebida</div>
    </div>
  `);

  const baseline = await captureSendBaseline(
    page,
    "*Escumadeira Kit Cozinha*\nhttps://meli.la/1LDnxVi",
    "Escumadeira Kit Cozinha",
    "MLB45737791"
  );

  await page.locator("#main").evaluate((root) => {
    const incoming = document.createElement("div");
    incoming.className = "message-in";
    incoming.setAttribute("data-id", "false_2");
    incoming.textContent = "Outra mensagem recebida";
    root.appendChild(incoming);
  });

  assert(
    !(await detectManualSend(page, baseline)),
    "Mensagem recebida não pode ser interpretada como envio."
  );

  await page.locator("#main").evaluate((root) => {
    const outgoing = document.createElement("div");
    outgoing.className = "message-out";
    outgoing.setAttribute("data-id", "true_new");
    outgoing.textContent =
      "Escumadeira Kit Cozinha 30% OFF https://meli.la/1LDnxVi";
    root.appendChild(outgoing);
  });

  assert(
    await detectManualSend(page, baseline),
    "Nova mensagem enviada com título/link deveria ser reconhecida."
  );

  const pageAmazon = await browser.newPage();
  await pageAmazon.setContent(`
    <div id="main">
      <div class="message-out" data-id="true_old_amazon">Oferta anterior</div>
    </div>
  `);

  const amazonBaseline = await captureSendBaseline(
    pageAmazon,
    "*Echo Dot*\nhttps://www.amazon.com.br/dp/B09B8QFYZ2?tag=topoutlet05-20",
    "Echo Dot",
    "B09B8QFYZ2"
  );

  // Simula o caso real mais crítico: o usuário clica em Enviar imediatamente,
  // antes mesmo da primeira rodada do polling do observador.
  await pageAmazon.locator("#main").evaluate((root) => {
    const outgoing = document.createElement("div");
    outgoing.className = "message-out";
    outgoing.setAttribute("data-id", "true_fast_amazon");
    outgoing.textContent =
      "Echo Dot 49% OFF https://www.amazon.com.br/dp/B09B8QFYZ2";
    root.appendChild(outgoing);
  });

  assert(
    await detectManualSend(pageAmazon, amazonBaseline),
    "Envio rápido Amazon deveria ser reconhecido mesmo sem o parâmetro ?tag."
  );

  console.log("whatsapp-envio-observer: OK");
} finally {
  await browser.close();
}
