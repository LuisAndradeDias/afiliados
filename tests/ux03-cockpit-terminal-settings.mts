/**
 * UX-03 — validação do cockpit, terminal e configurações.
 * HTTP GET com estados sintéticos; NÃO aciona nenhuma ação operacional.
 * Screenshots de revisão desktop/mobile, inclusive drawer.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { responderRotaVisual } from "../src/painel/rotas-visuais.js";

const root = process.cwd();
const screenshots = join(root, "test-results", "ux03");
await mkdir(screenshots, { recursive: true });

const status: Record<string, unknown> = {
  operacaoEstado: "paused", monitorAlternadoAtivo: false,
  monitorAlternadoProximaPlataforma: "amazon", monitorAlternadoSlotSegundos: 135,
  operacaoPlataforma: null, ofertaPlataformaAtual: null, plataformaAtual: "",
  whatsappAutoEnvioAtivo: true, whatsappAutoEnvioDelayMs: 1500,
  ofertaPreparada: false, whatsappEnvioPendente: false, whatsappRevisaoPronta: false,
  grupoConfigurado: true, grupo: "GRUPO FICTÍCIO", sessaoWhatsapp: true,
  executando: [], logs: [
    "[10:01:02] [amazon] Buscando Amazon: item de teste",
    "[10:01:03] [mercadolivre-buscar] Buscando Mercado Livre: item fictício",
    "[10:01:04] [painel] Pausado: acesso_token=SEGREDO_FICTICIO"
  ],
  afiliadoConfigurado: true, afiliadoTag: "teste-20",
  mercadoLivreApiConfigurada: true, mercadoLivreExtensionConectada: true,
  mercadoLivreCuponsTotal: 7, mercadoLivreCuponsAtivos: 0,
  descontoMinimo: 20, cooldownHoras: 24, previewCooldownMinutos: 120,
  mercadoLivreFluxoEtapa: "idle", mercadoLivreFluxoMensagem: "",
  ultimoEnvioConcluidoEm: null, consultaAmazon: 0,
  mercadoLivreOferta: {}, mensagem: ""
};
let writes = 0;
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    if (req.method !== "GET") {
      writes++;
      res.writeHead(405);res.end();return;
    }
    if (path === "/api/status") {
      res.writeHead(200, {"content-type":"application/json","cache-control":"no-store"});
      res.end(JSON.stringify(status));return;
    }
    if (await responderRotaVisual({ method:req.method, pathname:path,res,raiz:root })) return;
    res.writeHead(404);res.end();
  } catch(error) { res.writeHead(500);res.end(String(error)); }
});
await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
const addr=server.address();
assert.ok(addr && typeof addr!=="string");
const base="http://127.0.0.1:"+addr.port;
let browser:Awaited<ReturnType<typeof chromium.launch>>|null=null;
try{
  browser=await chromium.launch({channel:"chrome",headless:true});
  for(const width of [1595,1280,768,390]){
    const ctx=await browser.newContext({
      viewport:{width,height:900},deviceScaleFactor:1,locale:"pt-BR",reducedMotion:"reduce"
    });
    // Intercept ALL writes; future changes must never send in a visual test.
    await ctx.route("**/*",async route=>{
      if(route.request().method()!=="GET"){
        writes++;await route.abort();
      }else await route.continue();
    });
    const page=await ctx.newPage(),errors:string[]=[];
    page.on("pageerror",e=>errors.push(e.message));
    const r=await page.goto(base+"/ofertas",{waitUntil:"networkidle"});
    assert.equal(r?.status(),200);
    await page.evaluate(()=>document.fonts.ready);
    await page.locator("#cpvLiveTitle").getByText("Automação pausada").waitFor();
    assert.equal(await page.locator("#cpvOpsPanel").count(),1);
    assert.equal(await page.locator("#cpvTerminal").count(),1);
    assert.equal(await page.locator("#cpvHistory").count(),1);
    assert.equal(await page.locator("#cpvSettingsDialog").count(),1);
    assert.equal(await page.locator("#cpvOpsWhatsapp").innerText(),"Autoenvio ativo");
    assert.equal(await page.locator("#autoEnvioButton").count(),1);
    assert.equal(await page.locator("#cycleToggleButton").count(),1);
    assert.equal(await page.locator("#amazonTag").count(),1);
    assert.equal(await page.locator("#mlClientId").count(),1);
    assert.equal(await page.locator("#mlClientSecret").count(),1);
    assert.equal(await page.locator("#mlAffiliateLink").count(),1);
    assert.equal(await page.locator("#logs").count(),1);
    assert.equal(await page.locator('button[data-action="historico-clear"]').count(),1);
    assert.equal(await page.locator('button[data-action="limpar-logs"]').count(),1);

    const measures=await page.evaluate(()=>{
      const banner=document.getElementById("cpvOpsPanel")!.getBoundingClientRect();
      const terminal=document.getElementById("cpvTerminal")!.getBoundingClientRect();
      const launch=document.getElementById("launchCard")!.getBoundingClientRect();
      const hero=document.querySelector(".hero")!.getBoundingClientRect();
      return {
        banner:{x:banner.x,y:banner.y,width:banner.width},
        terminal:{x:terminal.x,y:terminal.y,width:terminal.width},
        launch:{x:launch.x,y:launch.y,width:launch.width},
        heroY:hero.y,
        overflow:document.documentElement.scrollWidth-innerWidth
      };
    });
    assert.ok(measures.overflow<=1,"Rolagem horizontal "+width+": "+JSON.stringify(measures));
    assert.ok(measures.banner.y>=measures.heroY,"Status deve vir após o cabeçalho");
    assert.ok(measures.banner.y<measures.launch.y,"Status deve vir antes do ciclo");
    if(width>=1370){
      assert.ok(measures.terminal.x>=measures.launch.x+measures.launch.width-1,
        "Console deve ficar À DIREITA do ciclo em desktop");
      assert.ok(measures.terminal.y<=measures.launch.y+2,"Terminal deve alinhar no topo do ciclo");
    }

    assert.match(await page.locator("#cpvTerminalOutput").innerText(),/Buscando Amazon/);
    assert.doesNotMatch(await page.locator("#cpvTerminalOutput").innerText(),/SEGREDO_FICTICIO/);
    assert.match(await page.locator("#cpvTerminalOutput").innerText(),/\[REDACTED\]/);

    await page.locator("#cpvTerminalFilter").selectOption("meli");
    assert.match(await page.locator("#cpvTerminalOutput").innerText(),/Buscando Mercado Livre/);
    assert.doesNotMatch(await page.locator("#cpvTerminalOutput").innerText(),/Buscando Amazon/);
    await page.locator("#cpvTerminalFilter").selectOption("all");
    const captured=await page.locator("#cpvTerminalOutput").innerText();
    await page.locator("#cpvTerminalPause").click();
    assert.equal(await page.locator("#cpvTerminalPause").getAttribute("aria-pressed"),"true");
    status.logs=[
      "[10:02:00] [mercadolivre-buscar] Buscando Mercado Livre: TESTE_NOVO"
    ];
    status.operacaoEstado="searching";
    status.operacaoPlataforma="mercado-livre";
    status.executando=["mercadolivre-buscar"];
    await page.locator("#cpvLiveTitle").getByText("Buscando ofertas · Mercado Livre").waitFor({
      timeout:5000
    });
    assert.equal(await page.locator("#cpvTerminalOutput").innerText(),captured,
      "Pausar deve congelar a visualização, não a leitura de status");
    await page.locator("#cpvTerminalPause").click();
    assert.match(await page.locator("#cpvTerminalOutput").innerText(),/TESTE_NOVO/);
    status.operacaoEstado="offer-pending";
    status.ofertaPreparada=true;
    status.mensagem="Mensagem sintética sem imagem";
    status.executando=[];
    await page.locator("#cpvLiveTitle").getByText("Oferta preparada · revisão pendente").waitFor({
      timeout:5000
    });
    assert.equal(await page.locator("#reviewCard.cpv-without-image").count(),1);
    const reviewBox=await page.locator("#reviewCard").boundingBox();
    assert.ok(reviewBox && reviewBox.height<550,
      "Oferta sem imagem deixou um bloco branco excessivo: "+reviewBox?.height);
    if(width===1595 || width===390) await page.screenshot({
      path:join(screenshots,"oferta-pendente-"+width+".png"),
      fullPage:true,animations:"disabled"
    });
    status.operacaoEstado="sending";
    status.whatsappEnvioPendente=true;
    await page.locator("#cpvLiveTitle").getByText("Aguardando confirmação do WhatsApp").waitFor({
      timeout:5000
    });
    status.whatsappEnvioPendente=false;
    status.operacaoEstado="error";
    status.ofertaPreparada=false;
    status.mensagem="";
    status.mercadoLivreFluxoMensagem="Nenhuma oferta Mercado Livre atingiu os filtros.";
    await page.locator("#cpvLiveTitle").getByText("Última busca sem ofertas elegíveis").waitFor({
      timeout:5000
    });

    // Screenshots com dados falsos, sem perfis ou sessão reais.
    status.operacaoEstado="paused";
    status.mercadoLivreFluxoMensagem="";
    status.logs=[
      "[10:11:12] [amazon] Buscando ofertas da Amazon",
      "[10:11:13] [mercadolivre-buscar] Consultando Mercado Livre",
      "[10:11:15] [painel] Monitor pausado",
      "[10:11:17] [whatsapp] Oferta preparada para revisão"
    ];
    await page.locator("#cpvLiveTitle").getByText("Automação pausada").waitFor({timeout:5000});
    await page.screenshot({
      path:join(screenshots,"ofertas-console-"+width+".png"),
      fullPage:true,animations:"disabled"
    });

    await page.locator("#cpvSettingsButton").click();
    await page.locator("#cpvSettingsDialog").waitFor({state:"visible"});
    assert.equal(await page.locator("#cpvSettingsDialog").getAttribute("aria-modal"),"true");
    assert.equal(await page.locator("#cpvSettingsTab-contas").getAttribute("aria-selected"),"true");
    await page.locator("#cpvSettingsTab-contas").focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator("#cpvSettingsTab-monitor").getAttribute("aria-selected"),"true");
    await page.keyboard.press("ArrowLeft");
    assert.equal(await page.locator("#cpvSettingsTab-contas").getAttribute("aria-selected"),"true");
    assert.equal(await page.locator("#cpvSettingsPage-contas #amazonTag").count(),1);
    assert.equal(await page.locator("#cpvSettingsPage-contas #mlClientSecret").count(),1);
    await page.locator("#amazonTag").fill("digitando-20");
    await page.waitForTimeout(1800);
    assert.equal(await page.locator("#amazonTag").inputValue(),"digitando-20",
      "Atualização não pode roubar texto sendo editado");
    if(width===1595 || width===390) await page.screenshot({
      path:join(screenshots,"config-contas-"+width+".png"),
      animations:"disabled"
    });
    await page.locator("#cpvSettingsTab-monitor").click();
    assert.equal(await page.locator("#cpvSettingsPage-monitor #cpvRuleDiscount").innerText(),"20%");
    assert.equal(await page.locator("#cpvSettingsPage-monitor #cpvRuleCooldown").innerText(),"24 h");
    assert.equal(await page.locator("#cpvSettingsPage-monitor #cpvRulePreview").innerText(),"120 min");
    assert.equal(await page.locator("#cpvSettingsPage-monitor #cpvRuleCadence").innerText(),
      "135 s por slot");
    await page.waitForTimeout(1700);
    await page.locator("#cpvSettingsTab-contas").click();
    assert.equal(await page.locator("#amazonTag").inputValue(), "digitando-20",
      "Alternar abas não pode apagar o Tracking ID digitado e ainda não salvo");
    await page.locator("#cpvSettingsTab-monitor").click();
    if(width===1595 || width===390) await page.screenshot({
      path:join(screenshots,"config-monitor-"+width+".png"),
      animations:"disabled"
    });
    await page.locator("#cpvSettingsTab-ferramentas").click();
    assert.equal(await page.locator('#cpvSettingsPage-ferramentas button[data-action="mercadolivre-buscar"]').count(),1);
    await page.locator("#mlAffiliateLink").fill("https://meli.la/LINK_FICTICIO");
    await page.locator("#cpvSettingsTab-contas").click();
    await page.waitForTimeout(1700);
    await page.locator("#cpvSettingsTab-ferramentas").click();
    assert.equal(await page.locator("#mlAffiliateLink").inputValue(),
      "https://meli.la/LINK_FICTICIO",
      "O link digitado e ainda não salvo não pode sumir ao trocar abas");

    await page.screenshot({
      path:join(screenshots,"configuracoes-"+width+".png"),
      fullPage:false,animations:"disabled"
    });
    await page.keyboard.press("Escape");
    await page.locator("#cpvSettingsDialog").waitFor({state:"hidden"});
    assert.equal(await page.locator("#cpvSettingsButton").evaluate(el=>el===document.activeElement),
      true,"Fechamento deve devolver foco ao botão original");
    await page.locator("#cpvSettingsButton").click();
    if(width >= 768) {
      await page.locator("#cpvSettingsBackdrop").click({position:{x:15,y:100}});
    } else {
      // No celular o drawer cobre 100vw, sem área externa clicável.
      await page.locator("#cpvSettingsClose").click();
    }
    await page.locator("#cpvSettingsDialog").waitFor({state:"hidden"});

    assert.deepEqual(errors,[],"Erro JS em "+width+"px");
    await ctx.close();
    // Voltar aos dados sintéticos iniciais para não contaminar a próxima viewport.
    status.operacaoEstado="paused";
    status.ofertaPreparada=false;
    status.mensagem="";
    status.executando=[];
    status.operacaoPlataforma=null;
    status.mercadoLivreFluxoMensagem="";
    status.logs=[
      "[10:01:02] [amazon] Buscando Amazon: item de teste",
      "[10:01:03] [mercadolivre-buscar] Buscando Mercado Livre: item fictício",
      "[10:01:04] [painel] Pausado: acesso_token=SEGREDO_FICTICIO"
    ];
  }
  assert.equal(writes,0,"UX-03 não pode executar requisições de gravação");
  console.log("UX03_COCKPIT_OK: 4 larguras, status realista, terminal com pausa/filtro, configurações 3 abas, foco, 8 capturas, 0 escritas.");
}finally{
  await browser?.close();
  server.closeAllConnections();
  await new Promise<void>(resolve=>server.close(()=>resolve()));
}
