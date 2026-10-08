import { strict as assert } from "node:assert";
import { chromium } from "playwright";
import { extrairPrecosCardAmazon } from "../src/fontes/amazon/browser.js";

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ locale: "pt-BR" });
  await page.setContent([
    '<div id="nivea" data-component-type="s-search-result">',
    '<h2><span>NIVEA Hidratante Labial Amora Shine</span></h2>',
    '<div class="a-price"><span class="a-offscreen">R$ 16,99</span></div>',
    '<div class="a-price-per-unit">',
    '<span class="a-price a-text-price">',
    '<span class="a-offscreen">R$ 3.539,58</span></span> / kg</div>',
    '<div>De: <span class="a-price a-text-price" data-a-strike="true">',
    '<span class="a-offscreen">R$ 24,10</span></span></div>',
    '</div>',
    '<div id="nivea-sem-referencia">',
    '<div class="a-price"><span class="a-offscreen">R$ 16,99</span></div>',
    '<div class="a-price-per-unit"><span class="a-price a-text-price">',
    '<span class="a-offscreen">R$ 3.539,58</span></span> / kg</div>',
    '</div>',
    '<div id="tv">',
    '<div class="a-price"><span class="a-offscreen">R$ 1.499,90</span></div>',
    '<div>De: <span class="a-price a-text-price" data-a-strike="true">',
    '<span class="a-offscreen">R$ 1.999,90</span></span></div>',
    '</div>',
    '<div id="tv-sem-de">',
    '<div class="a-price"><span class="a-offscreen">R$ 1.499,90</span></div>',
    '<span class="a-price a-text-price">',
    '<span class="a-offscreen">R$ 1.999,90</span></span>',
    '</div>'
  ].join(""));

  assert.deepEqual(await extrairPrecosCardAmazon(page.locator("#nivea")), {
    precoAtual: 16.99, precoAnterior: 24.10, descontoPercentual: 29
  });
  assert.deepEqual(await extrairPrecosCardAmazon(page.locator("#nivea-sem-referencia")), {
    precoAtual: 16.99
  });
  assert.deepEqual(await extrairPrecosCardAmazon(page.locator("#tv")), {
    precoAtual: 1499.90, precoAnterior: 1999.90, descontoPercentual: 25
  });
  assert.deepEqual(await extrairPrecosCardAmazon(page.locator("#tv-sem-de")), {
    precoAtual: 1499.90
  });

  console.log("amazon-preco-dom: OK (NIVEA por kg, preco anterior real, TV e desconto nao confirmado)");
} finally {
  await browser.close();
}
