import { chromium } from "playwright";
import { clicarComPonteiro } from "../src/robo/whatsapp-pointer.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true
});

try {
  const page = await browser.newPage({
    viewport: { width: 900, height: 600 }
  });

  await page.setContent(`
    <style>
      body { margin: 0; }
      #send {
        position: absolute;
        left: 620px;
        top: 420px;
        width: 120px;
        height: 56px;
      }
    </style>
    <button id="send" aria-label="Enviar">Enviar</button>
    <div id="resultado"></div>
    <script>
      window.movimentos = 0;
      document.addEventListener("mousemove", () => window.movimentos++);
      document.querySelector("#send").addEventListener("click", () => {
        document.querySelector("#resultado").textContent = "clicado";
      });
    </script>
  `);

  const botao = page.getByRole("button", { name: "Enviar" });
  await clicarComPonteiro(page, botao);

  assert(
    (await page.locator("#resultado").textContent()) === "clicado",
    "O clique com ponteiro não acionou o botão."
  );

  const movimentos = await page.evaluate(() => (window as any).movimentos as number);
  assert(
    movimentos >= 2,
    `Esperava movimento gradual do ponteiro, recebeu ${movimentos} evento(s).`
  );

  console.log("whatsapp-pointer: OK");
} finally {
  await browser.close();
}
