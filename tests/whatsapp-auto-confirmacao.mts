import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import {
  captureSendBaseline, aguardarConfirmacaoRealWhatsapp
} from "../src/robo/whatsapp-envio-observer.js";

test("campo que esvazia sem mensagem de saida NAO comprova envio",async()=>{
  const browser=await chromium.launch({channel:"chrome",headless:true});
  try{
    const page=await browser.newPage();
    await page.setContent('<main id="main"><div class="message-out" data-id="true_old">Oferta anterior</div><footer><div role="textbox" contenteditable="true"></div></footer></main>');
    const baseline=await captureSendBaseline(
      page,"OFERTA EXCLUSIVA\nhttps://example.com/produto/B000000001",
      "Produto FICTICIO", "B000000001"
    );
    assert.equal(await aguardarConfirmacaoRealWhatsapp(page,baseline,{timeoutMs:250,intervalMs:40}),false);
  }finally{await browser.close();}
});
test("confirmacao so ocorre depois de nova mensagem enviada no chat",async()=>{
  const browser=await chromium.launch({channel:"chrome",headless:true});
  try{
    const page=await browser.newPage();
    await page.setContent('<main id="main"><div class="message-out" data-id="true_old">Oferta anterior</div></main>');
    const baseline=await captureSendBaseline(page,
      "Oferta de Notebook\nhttps://example.com/produto/B000000001",
      "Notebook Premium","B000000001"
    );
    const teste=aguardarConfirmacaoRealWhatsapp(page,baseline,{timeoutMs:1500,intervalMs:50});
    await page.waitForTimeout(160);
    await page.locator("#main").evaluate(root=>{
      const e=document.createElement("div");
      e.className="message-out";e.setAttribute("data-id","true_new");
      e.textContent="Notebook Premium. https://example.com/produto/B000000001";
      root.appendChild(e);
    });
    assert.equal(await teste,true);
  }finally{await browser.close();}
});
test("mensagem nova sem referencia da oferta nao confirma envio",async()=>{
  const browser=await chromium.launch({channel:"chrome",headless:true});
  try{
    const page=await browser.newPage();
    await page.setContent('<main id="main"></main>');
    const baseline=await captureSendBaseline(page,
      "Oferta de Fone Bluetooth\nhttps://example.com/B000000001",
      "Fone Bluetooth","B000000001"
    );
    await page.locator("#main").evaluate(root=>{
      const e=document.createElement("div");
      e.className="message-out";e.setAttribute("data-id","true_other");
      e.textContent="Mensagem diferente sem oferta";
      root.appendChild(e);
    });
    assert.equal(await aguardarConfirmacaoRealWhatsapp(page,baseline,{timeoutMs:250,intervalMs:40}),false);
  }finally{await browser.close();}
});
