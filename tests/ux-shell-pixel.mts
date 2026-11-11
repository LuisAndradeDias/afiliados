/**
 * UX-02 — precisão da estrutura compartilhada.
 *
 * Posições e tamanhos CSS precisam coincidir EXATAMENTE, sem tolerância de 1px.
 * Propriedades CSS do menu precisam ser idênticas em todas as cinco páginas.
 * Imagens PNG do Chrome são comparadas com 5% de tolerância APENAS para
 * rasterização de texto entre documentos; não se tolera desvio geométrico.
 * Uma simulação de deslocamento de 1px precisa ser detectada.
 *
 * Tudo com dados sintéticos, sem POST/DELETE, WhatsApp ou acesso a contas.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { responderRotaVisual } from "../src/painel/rotas-visuais.js";
import { responderRotaShopee } from "../src/painel/shopee-http.js";
import { responderRotaRevisao } from "../src/painel/revisao-http.js";

const root = process.cwd(), data = await mkdtemp(join(tmpdir(), "cpv-ux-shell-"));
await mkdir(join(data, "data"));
const status = {
  operacaoEstado: "paused", monitorAlternadoAtivo: false, monitorAlternadoProximaPlataforma: "amazon",
  whatsappAutoEnvioAtivo: true, whatsappAutoEnvioDelayMs: 1500,
  grupoConfigurado: true, sessaoWhatsapp: true, afiliadoConfigurado: true, afiliadoTag: "teste-20",
  mercadoLivreApiConfigurada: true, mercadoLivreExtensionConectada: true,
  mercadoLivreCuponsTotal: 7, mercadoLivreCuponsAtivos: 0,
  ofertaPreparada: false, whatsappEnvioPendente: false, whatsappRevisaoPronta: false,
  descontoMinimo: 20, cooldownHoras: 24, previewCooldownMinutos: 120, executando: [], logs: []
};
let writes = 0;
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    if (req.method !== "GET") { writes++; res.writeHead(405); res.end(); return; }
    if (pathname === "/api/status") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(status)); return;
    }
    if (await responderRotaVisual({ method: req.method, pathname, res, raiz: root })) return;
    if (await responderRotaShopee({ req, res, pathname, raiz: data })) return;
    if (await responderRotaRevisao({ method: req.method, pathname, res, raiz: data })) return;
    res.writeHead(404); res.end();
  } catch (error) { res.writeHead(500); res.end(String(error)); }
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const base = "http://127.0.0.1:" + address.port;
const routes = ["/central", "/ofertas", "/shopee", "/revisao", "/historico-precos"];
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const width of [1595, 1280, 768, 390]) {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 }, deviceScaleFactor: 1,
      reducedMotion: "reduce", locale: "pt-BR"
    });
    const page = await ctx.newPage();
    let baseline: Buffer | null = null;
    let baselineStyles: Record<string, Record<string, string>> | null = null;
    let baselineGeometry: Array<{ x:number;y:number;width:number;height:number }> | null = null;
    for (const route of routes) {
      const response = await page.goto(base + route + (route === "/historico-precos" ? "?demo=1" : ""), { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200, route + " HTTP");
      // CSS externo e fontes precisam estar concluídos antes de comparar pixels;
      // DOM pronto sozinho não garante estilos prontos em todos os runners.
      await page.evaluate(() => document.fonts.ready);
      await page.locator("#cpvUnifiedNav .cpv-nav-link").first().waitFor();
      assert.equal(await page.locator("#cpvUnifiedNav").count(), 1);
      assert.equal(await page.locator("#cpvUnifiedNav a").count(), 5);
      const mobile = width <= 860;
      // Mesmo trilho de fundo em todas as telas de desktop; nenhum trilho
      // escondido no celular. Protege a faixa alem do primeiro viewport.
      const fundoDocumento = await page.evaluate(() =>
        getComputedStyle(document.body).backgroundImage);
      if (mobile) assert.equal(fundoDocumento, "none",
        route + " manteve trilho escuro oculto na tela movel");
      else assert.match(fundoDocumento, /linear-gradient/i,
        route + " perdeu o fundo da barra lateral ao longo do documento");
      if (mobile) {
        await page.locator("#menuBtn").click();
        await page.locator("#sidebar.open").waitFor();
        // A classe open existe antes do fim da animação; aguardar posição efetiva.
        await page.waitForTimeout(260);
        assert.equal(await page.locator("#menuBtn").getAttribute("aria-expanded"), "true");
      }
      const measure = await page.evaluate(() => {
        const sidebar = document.getElementById("sidebar")!.getBoundingClientRect();
        const top = document.querySelector(".cpv-global-top")!.getBoundingClientRect();
        const links = [...document.querySelectorAll("#cpvUnifiedNav a")].map(node => {
          const rect = node.getBoundingClientRect();
          return { x:rect.x,y:rect.y,width:rect.width,height:rect.height };
        });
        return {
          sidebar:{x:sidebar.x,y:sidebar.y,width:sidebar.width},
          top:{x:top.x,y:top.y,width:top.width,height:top.height},
          links, overflow:document.documentElement.scrollWidth-innerWidth
        };
      });
      assert.deepEqual(measure.sidebar,{x:0,y:0,width:252},route+" sidebar deve ocupar x=0 width=252px");
      assert.deepEqual(measure.top,{
        x:mobile?0:252,y:0,width:mobile?width:width-252,height:mobile?70:78
      },route+" barra de contexto está desalinhada");
      assert.ok(measure.overflow<=1,route+" tem overflow em "+width+"px");
      if(baselineGeometry) assert.deepEqual(measure.links,baselineGeometry,
        route+" links fora de posição, mesmo que seja 1px");
      else baselineGeometry=measure.links;

      // Normalizar apenas o realce da página ativa. Nenhuma ação operacional é executada.
      await page.evaluate(()=>{
        for(const link of document.querySelectorAll("#cpvUnifiedNav a")) link.removeAttribute("aria-current");
        document.querySelector('#cpvUnifiedNav a[href="/central"]')!.setAttribute("aria-current","page");
        if(document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.waitForTimeout(260);
      const styles = await page.evaluate(() => {
        const selectors = [
          "#sidebar",".cpv-nav-brand",".cpv-nav-logo",
          ".cpv-nav-brand-text strong",".cpv-nav-label",
          ".cpv-nav-link",".cpv-nav-link-label",".cpv-nav-foot"
        ];
        const result:Record<string,Record<string,string>>={};
        for(const selector of selectors){
          const css=getComputedStyle(document.querySelector(selector)!);
          const props:Record<string,string>={};
          for(let i=0;i<css.length;i++){
            const name=css.item(i);
            if(!name.startsWith("--"))props[name]=css.getPropertyValue(name);
          }
          result[selector]=props;
        }
        return result;
      });
      if(baselineStyles) assert.deepEqual(styles,baselineStyles,
        "CSS computado da sidebar difere entre /central e "+route+" "+width);
      else baselineStyles=styles;

      const current=await page.screenshot({
        clip:{x:0,y:0,width:252,height:900},animations:"disabled"
      });
      if(baseline && !current.equals(baseline)){
        // Chrome pode rasterizar fontes de forma levemente diferente entre documentos;
        // analisar cores de pixels sem tolerar diferença nas coordenadas CSS.
        const diag=await ctx.newPage();
        const diff=await diag.evaluate(async ({a,b})=>{
          const first=new Image(), second=new Image();
          first.src="data:image/png;base64,"+a;
          second.src="data:image/png;base64,"+b;
          await first.decode();await second.decode();
          const c1=document.createElement("canvas"),c2=document.createElement("canvas");
          c1.width=first.naturalWidth;c1.height=first.naturalHeight;
          c2.width=second.naturalWidth;c2.height=second.naturalHeight;
          const x1=c1.getContext("2d")!,x2=c2.getContext("2d")!;
          x1.drawImage(first,0,0);x2.drawImage(second,0,0);
          const a1=x1.getImageData(0,0,c1.width,c1.height).data;
          const a2=x2.getImageData(0,0,c2.width,c2.height).data;
          let pixels=0;
          for(let i=0;i<a1.length;i+=4){
            if(a1[i]!==a2[i]||a1[i+1]!==a2[i+1]||
               a1[i+2]!==a2[i+2]||a1[i+3]!==a2[i+3])pixels++;
          }
          return pixels/(c1.width*c1.height);
        },{a:baseline.toString("base64"),b:current.toString("base64")});
        await diag.close();
        assert.ok(diff<=0.05,"Raster da sidebar variou "+(diff*100).toFixed(2)+
          "% entre /central e "+route+" "+width+"px (>5%).");
      }
      if(!baseline){
        baseline=current;
        // Alteração inline com prioridade máxima: determinística no Windows e no Linux.
        // Evita falsa falha por estilos de página/frames não estabilizados.
        await page.locator("#sidebar").evaluate(node => {
          (node as HTMLElement).style.setProperty("left", "1px", "important");
        });
        await page.waitForTimeout(80);
        const wrongX=await page.locator("#sidebar").evaluate(node=>node.getBoundingClientRect().x);
        assert.equal(wrongX,1,"Controle negativo deve deslocar exatamente 1px");
        const shifted=await page.screenshot({clip:{x:0,y:0,width:252,height:900},animations:"disabled"});
        assert.ok(!shifted.equals(current),"Teste de pixels NÃO detectou deslocamento de 1px");
        await page.locator("#sidebar").evaluate(node => {
          (node as HTMLElement).style.removeProperty("left");
        });
      }
      if(mobile){
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("#menuBtn").getAttribute("aria-expanded"),"false");
        assert.equal(await page.locator("#sidebar.open").count(),0);
      }
    }
    await ctx.close();
  }
  assert.equal(writes,0,"Auditoria de UX não deve enviar formulários ou mensagens");
  console.log("UX_SHELL_OK: 5 telas x 4 larguras; alinhamento CSS exato, mesmos estilos; diferença de 1px detectada; 0 escritas.");
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  await rm(data,{recursive:true,force:true});
}
