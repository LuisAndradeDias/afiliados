import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import {
  localizarBuscaWhatsapp,
  localizarGrupoWhatsapp,
  confirmarGrupoAbertoWhatsapp
} from "../src/robo/whatsapp-busca.js";

const browser=await chromium.launch({channel:"chrome",headless:true});
try{
 await test("encontra entrada real de pesquisa adicionada após carregamento tardio",async()=>{
  const page=await browser.newPage();
  try{
   await page.setContent('<div id="side"><div data-testid="chat-list-search-container"></div></div>');
   await page.evaluate(()=>{setTimeout(()=>{
    const root=document.querySelector('[data-testid="chat-list-search-container"]');
    if(root)root.innerHTML='<input role="textbox" data-tab="3" placeholder="Pesquisar ou começar uma nova conversa" aria-label="Pesquisar ou começar uma nova conversa">';
   },160)});
   const campo=await localizarBuscaWhatsapp(page,700);
   assert.equal(await campo.getAttribute("data-tab"),"3");
   await campo.fill("GRUPO-FICTICIO-SEM-ENVIO");
   assert.equal(await campo.inputValue(),"GRUPO-FICTICIO-SEM-ENVIO");
  }finally{await page.close();}
 });
 await test("funciona no campo antigo contenteditable dentro da lista",async()=>{
  const page=await browser.newPage();
  try{
   await page.setContent('<div id="side"><div contenteditable="true" role="textbox" data-tab="3" aria-label="Pesquisar"></div></div>');
   const campo=await localizarBuscaWhatsapp(page,500);
   await campo.fill("TESTE-SEM-ENVIO");
   assert.equal(await campo.textContent(),"TESTE-SEM-ENVIO");
  }finally{await page.close();}
 });
 await test("não confunde campo da conversa com campo da pesquisa",async()=>{
  const page=await browser.newPage();
  try{
   await page.setContent('<footer><div role="textbox" contenteditable="true" aria-label="Digite uma mensagem"></div></footer>');
   await assert.rejects(localizarBuscaWhatsapp(page,220),/pesquisa|WhatsApp|conversa/i);
   assert.equal((await page.locator("footer [contenteditable]").innerText()).trim(),"");
  }finally{await page.close();}
 });
 await test("quando o WhatsApp não carrega a busca, falha em um único prazo",async()=>{
  const page=await browser.newPage();
  try{
   await page.setContent('<div id="side"><div aria-label="Carregando..."></div></div>');
   const inicio=Date.now();
   await assert.rejects(localizarBuscaWhatsapp(page,240),/pesquisa|WhatsApp|conversa/i);
   assert.ok(Date.now()-inicio<1_200,"Não multiplicar o limite por seletor");
  }finally{await page.close();}
 });
 await test("encontra o grupo atual pelo nome exato, mesmo sem atributo title",async()=>{
  const page=await browser.newPage();
  try{
   await page.setContent('<div id="side"><div class="chat-result"><span dir="auto">Ofertas VIP 🛒</span></div></div>');
   const grupo=await localizarGrupoWhatsapp(page,"Ofertas VIP 🛒",400);
   assert.equal(await grupo.innerText(),"Ofertas VIP 🛒");
  }finally{await page.close();}
 });
 await test("aceita o atributo title usado pelo layout antigo",async()=>{
  const page=await browser.newPage();
  try{
   await page.setContent('<div id="side"><span title="Ofertas VIP 🛒">Ofertas VIP 🛒</span></div>');
   const grupo=await localizarGrupoWhatsapp(page,"Ofertas VIP 🛒",400);
   assert.equal(await grupo.getAttribute("title"),"Ofertas VIP 🛒");
  }finally{await page.close();}
 });
 await test("não escolhe conversa parecida ou texto fora da lista de chats",async()=>{
  const page=await browser.newPage();
  try{
   await page.setContent('<div id="side"><span>Ofertas VIP 🛒 2</span></div><main><span>Ofertas VIP 🛒</span></main>');
   await assert.rejects(localizarGrupoWhatsapp(page,"Ofertas VIP 🛒",220),/grupo|WhatsApp|destino/i);
  }finally{await page.close();}
 });
 await test("confere grupo exato no cabeçalho antes de permitir composição",async()=>{
  const page=await browser.newPage();
  try{
   await page.setContent('<div id="main"><header><span>Outro Grupo</span></header></div>');
   await assert.rejects(confirmarGrupoAbertoWhatsapp(page,"Ofertas VIP 🛒",220),/grupo|WhatsApp|destino/i);
   await page.setContent('<div id="main"><header><span>Ofertas VIP 🛒</span></header></div>');
   await confirmarGrupoAbertoWhatsapp(page,"Ofertas VIP 🛒",400);
  }finally{await page.close();}
 });
 console.log("WHATSAPP_BUSCA_RESILIENTE_OK: busca, grupo exato, cabeçalho e timeout.");
}finally{await browser.close();}
