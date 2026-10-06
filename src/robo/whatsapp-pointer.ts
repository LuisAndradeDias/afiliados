import type { Locator, Page } from "playwright";

export async function clicarComPonteiro(
  page: Page,
  botao: Locator
): Promise<void> {
  await botao.waitFor({ state: "visible", timeout: 5_000 });
  await botao.scrollIntoViewIfNeeded();

  const desabilitado = await botao.isDisabled().catch(() => false);
  if (desabilitado) {
    throw new Error("O botão de envio está desabilitado.");
  }

  const caixa = await botao.boundingBox();
  if (!caixa || caixa.width < 2 || caixa.height < 2) {
    throw new Error("Não foi possível determinar a posição do botão de envio.");
  }

  const x = caixa.x + caixa.width / 2;
  const y = caixa.y + caixa.height / 2;

  await page.mouse.move(x, y, { steps: 12 });

  const ponteiroSobreBotao = await botao.evaluate(
    (elemento, ponto) => {
      const alvo = document.elementFromPoint(ponto.x, ponto.y);
      return alvo === elemento || (alvo instanceof Node && elemento.contains(alvo));
    },
    { x, y }
  );

  if (!ponteiroSobreBotao) {
    throw new Error(
      "O ponteiro não está sobre o botão de envio; clique cancelado por segurança."
    );
  }

  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.up();
}
