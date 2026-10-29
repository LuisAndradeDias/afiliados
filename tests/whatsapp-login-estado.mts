import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { detectarEstadoVisualWhatsapp }
  from "../src/robo/whatsapp-conexao.js";

test("nao presume autenticacao apenas porque a pagina abriu", async () => {
  const browser = await chromium.launch({channel:"chrome",headless:true});
  try {
    const page = await browser.newPage();
    await page.setContent("<html><title>WhatsApp</title><div>Carregando...</div></html>");
    assert.equal(await detectarEstadoVisualWhatsapp(page),"aguardando");
    await page.setContent('<canvas aria-label="Scan me!"></canvas>');
    assert.equal(await detectarEstadoVisualWhatsapp(page),"qr");
    await page.setContent('<div id="pane-side"><div>Lista ficticia sem dados pessoais</div></div>');
    assert.equal(await detectarEstadoVisualWhatsapp(page),"conectado");
    await page.setContent('<div id="side">Painel lateral do WhatsApp autenticado</div>');
    assert.equal(await detectarEstadoVisualWhatsapp(page),"conectado");
    await page.close();
    assert.equal(await detectarEstadoVisualWhatsapp(page),"fechada");
  } finally {
    await browser.close();
  }
});
