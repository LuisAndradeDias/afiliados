import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = "src/painel/public/";
const html = await readFile(base + "index.html", "utf8");
const actions: string[] = [];
let state: Record<string, unknown> = {
  grupo: "Caça Promos VIP 👑", grupoConfigurado: true,
  canalElegibilidade: {
    codigo: "CANAL_NAO_HOMOLOGADO",
    motivo: "Canal sem cadastro comercial homologado.", podePublicar: false
  },
  elegibilidadePorPlataforma: {
    amazon: {codigo:"CANAL_NAO_HOMOLOGADO", motivo:"Amazon sem homologação comercial.", podePublicar:false},
    "mercado-livre": {codigo:"REGRA_INCONCLUSIVA", motivo:"Mercado Livre com regras divergentes.", podePublicar:false},
    shopee: {codigo:"CANAL_NAO_HOMOLOGADO", motivo:"Shopee não configurada.", podePublicar:false}
  },
  afiliadoConfigurado:true, afiliadoTag: "afiliado-teste-20",
  sessaoWhatsapp:true, mercadoLivreApiConfigurada:true,
  mercadoLivreExtensionConectada:true, mercadoLivreAppConfigurada:true,
  mercadoLivreOauthPronto:true, mercadoLivreRedirectUri:"",
  mercadoLivreClientId:"", mercadoLivreOferta:{}, mercadoLivreLinkJob:null,
  mercadoLivreFluxoAutomatico:false, mercadoLivreFluxoEtapa:"idle",
  mercadoLivreFluxoMensagem:"", mercadoLivreCuponsAtivos:0, descontoMinimo:25,
  consultas:"3", previewCooldownMinutos:120, cooldownHoras:24,
  ofertasBloqueadas:1, linkAfiliadoAtual:"",
  logs: [
    "[10:01:10] [amazon-buscar] Amazon consultada; sem ofertas elegíveis.",
    "[10:02:11] [mercadolivre-buscar] Mercado Livre: aguardando vencedores.",
    "[10:03:12] [painel] Oferta bloqueada por canal não homologado."
  ],
  executando:[], mensagem:"Oferta fictícia para teste; nunca enviar",
  imagemUrl:"", categoriaAtual:"air fryer", comissaoAtual:0,
  scoreAtual:100, cupomAtual:"", precoComCupomEstimado:0,
  whatsappEnvioPendente:false, ultimoEnvioConcluidoEm:0,
  ultimoEnvioComProxima:false, ofertaPreparada:true,
  ofertaPlataformaAtual:"amazon", whatsappRevisaoPronta:false,
  operacaoEstado:"offer-pending", operacaoPlataforma:"amazon",
  monitorAlternadoAtivo:false, monitorAlternadoProximaPlataforma:"mercado-livre",
  monitorAlternadoProximaBuscaEm:0, amazonMonitorUltimaBuscaEm:0,
  mercadoLivreMonitorUltimaBuscaEm:0
};
const server = createServer(async(req,res)=>{
  const route = (req.url??"").split("?")[0];
  if(route==="/api/status"){
    res.writeHead(200,{"content-type":"application/json; charset=utf-8"});
    res.end(JSON.stringify(state)); return;
  }
  if(route==="/api/action"){
    let data="";
    for await(const chunk of req) data+=chunk.toString();
    const payload=JSON.parse(data);
    actions.push(payload.action);
    res.writeHead(200,{"content-type":"application/json"});
    res.end(JSON.stringify({ok:true,mensagem:"Simulação sem efeito"}));return;
  }
  if(route==="/"||route==="/ofertas"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8"});
    res.end(html);return;
  }
  if(route.startsWith("/central/assets/")){
    const name=route.split("/").pop()??"";
    if(!/^[a-z0-9.-]+$/i.test(name)){res.writeHead(400);res.end();return;}
    try{
      const body=await readFile(base + name);
      res.writeHead(200,{"content-type":name.endsWith(".js")
        ?"application/javascript": "text/css"});
      res.end(body);
    }catch{res.writeHead(404);res.end();}
    return;
  }
  res.writeHead(404);res.end();
});
await new Promise<void>(ok=>server.listen(0,"127.0.0.1",()=>ok()));
const addr=server.address();
if(!addr || typeof addr==="string")throw Error("porta indisponível");
const browser=await chromium.launch({channel:"chrome",headless:true});
try{
  const page=await browser.newPage({viewport:{width:1500,height:950}});
  const errors:string[]=[];
  page.on("pageerror",err=>errors.push(String(err)));
  await page.goto("http://127.0.0.1:"+addr.port+"/ofertas",{waitUntil:"networkidle"});
  await page.locator("#opsNowTitle").waitFor({timeout:4500});
  assert.match(await page.locator("#opsNowTitle").innerText(),/oferta salva|abrir no WhatsApp/i);
  assert.match(await page.locator("#opsNowDetail").innerText(),/homologa|canal|prepara/i);
  assert.equal(await page.locator("#reopenWhatsappButton").isEnabled(),true,
    "Revisar uma oferta no WhatsApp nao deve depender da homologacao comercial.");
  assert.equal(await page.locator("#sendNowButton").isVisible(),false,
    "Envio pelo painel continua indisponivel sem homologacao.");
  assert.match(await page.locator("#opsConsole").innerText(),/Mercado Livre:/);
  assert.equal(await page.locator(".health-item").count(),4,"manter quatro status");
  assert.equal(await page.locator("#cycleToggleButton").count(),1);
  assert.equal(await page.locator("#amazonTag").count(),1);
  assert.equal(await page.locator("#mlClientId").count(),1);
  assert.equal(await page.locator("#whatsappGroupInput").count(),1);
  assert.equal(await page.locator("#opsHistoryList li").count()>0,true);
  assert.equal(await page.locator("#opsPublishSetupButton").isVisible(),true,
    "Canal pendente precisa de caminho visível até autorização comercial.");
  await page.locator("#opsPublishSetupButton").click();
  assert.equal(await page.locator('[data-ops-settings-tab="publicacao"]').getAttribute("aria-selected"),"true");
  assert.equal(await page.locator("#opsChannelChecklist").count(),0,
    "Não incluir checklist comercial extenso nas configurações.");
  assert.equal(await page.locator("#opsPolicySummary").count(),0,
    "Não exibir múltiplos cartões comerciais no painel operacional.");
  assert.equal(await page.locator("#opsGroupConfigHost").isVisible(),true,
    "Preservar configuração do grupo original.");
  assert.match(await page.locator("#opsChannelState").innerText(),/pendente|bloqueado/i,
    "Não declarar liberado um canal ainda bloqueado no backend.");
  assert.equal(await page.locator("#opsWhatsappGroup").innerText(),"Caça Promos VIP 👑");
  assert.match(await page.locator("#opsWhatsappMode").innerText(),/revisão.*clique.*WhatsApp/i);
  assert.equal(await page.locator("#opsWhatsappConnection").innerText(),"Sessão conectada");
  assert.equal(await page.locator("#whatsappGroupInput").isVisible(),false,
    "A troca de grupo deve permanecer recolhida por padrão.");
  await page.locator("#opsGroupConfigHost .group-advanced summary").click();
  assert.equal(await page.locator("#whatsappGroupInput").isVisible(),true);
  assert.equal(await page.locator("#opsChannelDetail").count(),0,
    "Remover parágrafos jurídicos extensos da interface.");
  assert.equal(await page.locator("#opsPublishSetupButton").innerText(),"Configurar destino");
  await page.keyboard.press("Escape");
  const previewWidth=await page.locator("#mensagem").evaluate(el=>el.getBoundingClientRect().width);
  assert.ok(previewWidth>250,"A mensagem sem imagem não pode ficar em uma coluna estreita: "+previewWidth);
  if (process.env.CPV_COCKPIT_SCREENSHOT_DIR) {
    await page.screenshot({
      path:process.env.CPV_COCKPIT_SCREENSHOT_DIR+"/cockpit-desktop.png",
      fullPage:true
    });
  }

  await page.locator("#opsLogFilter").selectOption("mercadolivre");
  assert.match(await page.locator("#logs").innerText(),/Mercado Livre/);
  assert.doesNotMatch(await page.locator("#logs").innerText(),/Amazon consultada/);

  await page.locator("#opsLogPause").click();
  state={...state,logs:[...(state.logs as string[]),
    "[10:05:30] [mercadolivre-buscar] Novo dado de teste"]};
  await page.waitForTimeout(1900);
  assert.doesNotMatch(await page.locator("#logs").innerText(),/Novo dado/);
  await page.locator("#opsLogPause").click();
  assert.match(await page.locator("#logs").innerText(),/Novo dado/);

  await page.locator("#opsSettingsOpen").click();
  await page.locator("#opsSettingsDialog").waitFor({state:"visible"});
  assert.equal(await page.locator("#amazonTag").isVisible(),true);
  await page.locator('[data-ops-settings-tab="diagnostico"]').click();
  assert.equal(await page.locator("#mlAffiliateLink").isVisible(),true);
  await page.locator('[data-ops-settings-tab="publicacao"]').click();
  assert.equal(await page.locator("#whatsappGroupInput").isVisible(),true);
  if (process.env.CPV_COCKPIT_SCREENSHOT_DIR) {
    await page.screenshot({path:process.env.CPV_COCKPIT_SCREENSHOT_DIR+"/cockpit-settings.png",fullPage:false});
  }
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#opsSettingsDialog").isVisible(),false);
  assert.equal(await page.evaluate(() => document.activeElement?.id === "opsSettingsOpen"),true);

  state={...state, mensagem:"", ofertaPreparada:false,
    operacaoEstado:"searching", operacaoPlataforma:"mercado-livre",
    executando:["mercadolivre-buscar"], monitorAlternadoAtivo:true};
  await page.waitForTimeout(1800);
  assert.match(await page.locator("#opsNowTitle").innerText(),/Buscando ofertas no Mercado Livre/);
  state={...state,executando:[],operacaoEstado:"paused",monitorAlternadoAtivo:false};
  await page.waitForTimeout(1800);
  assert.match(await page.locator("#opsNowTitle").innerText(),/Ciclo pausado/);
  state={...state,operacaoEstado:"searching",operacaoPlataforma:"shopee",
    executando:[],monitorAlternadoAtivo:true};
  await page.waitForTimeout(1700);
  assert.match(await page.locator("#opsNowTitle").innerText(),/Buscando ofertas na Shopee/);
  assert.deepEqual(actions,[],"visualização não deve disparar POST");

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(250);
  const dimensions=await page.evaluate(()=>({
    scroll:document.documentElement.scrollWidth,
    width:document.documentElement.clientWidth
  }));
  assert.ok(dimensions.scroll<=dimensions.width+2,
    "layout móvel não deve produzir rolagem horizontal: "+JSON.stringify(dimensions));
  if (process.env.CPV_COCKPIT_SCREENSHOT_DIR) {
    await page.screenshot({
      path:process.env.CPV_COCKPIT_SCREENSHOT_DIR+"/cockpit-mobile.png",
      fullPage:true
    });
  }
  await page.locator("#opsSettingsOpen").click();
  assert.equal(await page.locator("#opsSettingsDialog").isVisible(),true);
  if (process.env.CPV_COCKPIT_SCREENSHOT_DIR) {
    await page.screenshot({path:process.env.CPV_COCKPIT_SCREENSHOT_DIR+"/cockpit-settings-mobile.png",fullPage:false});
  }
  await page.locator("#amazonTag").fill("teste-seguro-20");
  await page.locator('[data-action="afiliado-save"]').click();
  await page.waitForTimeout(150);
  assert.deepEqual(actions,["afiliado-save"],
    "A ação antiga de salvar Amazon deve funcionar sem duplicação");
  assert.deepEqual(errors,[],"sem exceções no navegador");
  console.log("COCKPIT_TEST_OK: status, console, filtros, pausa, histórico, drawer, mobile, sem POST");
}finally{
 await browser.close();
 await new Promise<void>(ok=>server.close(()=>ok()));
}
