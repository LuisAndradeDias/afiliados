import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { verificarDestinoWhatsapp } from "../src/robo/whatsapp-alvo.js";

const grupo = "Caça Promos VIP 👑";
async function paginaFicticia(opcoes: {
  buscar?: boolean; similar?: boolean; header?: string; composer?: boolean;
  nomeReal?: string;
} = {}) {
  const browser = await chromium.launch({channel:"chrome",headless:true});
  const page = await browser.newPage();
  const nome = opcoes.nomeReal ?? (opcoes.similar ? "Caça Promos VIP Fake" : grupo);
  const nomeHeader = opcoes.header ?? nome;
  await page.setContent(`
    <aside id="side">
      ${opcoes.buscar === false ? "" :
        '<div contenteditable="true" role="textbox" aria-label="Pesquisar ou começar uma nova conversa"></div>'}
      <div id="resultados"><div class="chat" role="button"><span title="${nome}">${nome}</span></div></div>
    </aside>
    <main id="main" style="display:none">
      <header><span title="${nomeHeader}">${nomeHeader}</span></header>
      ${opcoes.composer === false ? "" : '<footer><div role="textbox" contenteditable="true" aria-label="Digite uma mensagem"></div></footer>'}
    </main>
    <script>
      document.querySelector(".chat")?.addEventListener("click", () => {
        document.querySelector("#main").style.display="block";
      });
    </script>
  `);
  return {browser,page};
}

test("diagnostico reconhece somente grupo exato e compositor sem enviar mensagem",async()=>{
  const {browser,page}=await paginaFicticia();
  try {
    let posts = 0;
    page.on("request",r=>{if(r.method()==="POST")posts++;});
    const estado=await verificarDestinoWhatsapp(page,grupo);
    assert.equal(estado,"grupo-pronto");
    assert.equal(posts,0);
    assert.equal((await page.locator("#main footer").innerText()).trim(),"");
  } finally {await browser.close();}
});
test("unica variacao de maiusculas e espaco no emoji identifica o mesmo grupo",async()=>{
  const {browser,page}=await paginaFicticia({nomeReal:"CAÇA PROMOS vip👑"});
  try {
    assert.equal(await verificarDestinoWhatsapp(page,grupo),"grupo-pronto");
  } finally {await browser.close();}
});
test("grupo unico no fim de muitos titulos ainda pode ser validado",async()=>{
  const {browser,page}=await paginaFicticia();
  try {
    await page.locator("#resultados").evaluate(root=>{
      const fragment=document.createDocumentFragment();
      for(let i=0;i<175;i++){
        const span=document.createElement("span");
        span.setAttribute("title","Item de menu "+i);
        span.textContent="Item de menu "+i;
        fragment.appendChild(span);
      }
      root.prepend(fragment);
    });
    assert.equal(await verificarDestinoWhatsapp(page,grupo),"grupo-pronto");
  }finally{await browser.close();}
});
test("clique bloqueado pelo navegador retorna falha clara sem enviar",async()=>{
  const {browser,page}=await paginaFicticia();
  try {
    page.setDefaultTimeout(450);
    await page.addStyleTag({content:".chat {pointer-events:none !important;}"});
    assert.equal(
      await verificarDestinoWhatsapp(page,grupo),
      "interacao-falhou"
    );
  } finally {await browser.close();}
});
test("grupo com nome parecido nao e selecionado",async()=>{
  const {browser,page}=await paginaFicticia({similar:true});
  try {
    assert.equal(await verificarDestinoWhatsapp(page,grupo),"grupo-nao-localizado");
    assert.equal(await page.locator("#main").isVisible(),false);
  } finally {await browser.close();}
});
test("nome do cabecalho diferente bloqueia confirmacao do destino",async()=>{
  const {browser,page}=await paginaFicticia({header:"Grupo completamente diferente"});
  try {
    assert.equal(await verificarDestinoWhatsapp(page,grupo),"identidade-divergente");
  } finally {await browser.close();}
});
test("sem compositor nao ha confirmacao pronta",async()=>{
  const {browser,page}=await paginaFicticia({composer:false});
  try {
    assert.equal(await verificarDestinoWhatsapp(page,grupo),"compositor-ausente");
  } finally {await browser.close();}
});
test("busca que aparece apos painel lateral deve ser aguardada",async()=>{
  const {browser,page}=await paginaFicticia({buscar:false});
  try {
    const aguardando=verificarDestinoWhatsapp(page,grupo);
    await page.waitForTimeout(350);
    await page.locator("#side").evaluate(root=>{
      const input=document.createElement("div");
      input.setAttribute("role","textbox");
      input.setAttribute("contenteditable","true");
      input.setAttribute("aria-label","Pesquisar");
      root.prepend(input);
    });
    assert.equal(await aguardando,"grupo-pronto");
  }finally{await browser.close();}
});
test("sem caixa de busca nao deve clicar em grupo",async()=>{
  const {browser,page}=await paginaFicticia({buscar:false});
  try {
    assert.equal(await verificarDestinoWhatsapp(page,grupo),"busca-ausente");
    assert.equal(await page.locator("#main").isVisible(),false);
  } finally {await browser.close();}
});
