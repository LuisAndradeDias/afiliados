/**
 * UX-01: diagnóstico local pós-deploy, ESTRITAMENTE LEITURA.
 * Não autentica contas, não inicia monitor, não envia mensagens nem faz POST.
 * Capturas de produção ficam APENAS no perfil local do usuário; nunca no Git.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const base = new URL(process.env.UX_LOCAL_URL ?? "http://127.0.0.1:3030");
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname),
  "Auditoria deve acessar somente o computador local");
assert.equal(base.protocol, "http:");
assert.ok(base.port === "3030", "Porta inesperada. UX-01 não audita serviços externos.");
const directory = join(
  process.env.LOCALAPPDATA ?? process.cwd(), "Projeto04", "previews", "ux-live-readonly"
);
await mkdir(directory, { recursive: true });
const rotas = ["/central", "/ofertas", "/shopee", "/revisao"] as const;
const widths = [1595, 390] as const;
const statusResponse = await fetch(new URL("/api/status", base), { cache: "no-store" });
assert.equal(statusResponse.status, 200);
const current = await statusResponse.json() as Record<string, unknown>;
const status = {
  consultadoEm: new Date().toISOString(),
  autoenvioAtivo: current.whatsappAutoEnvioAtivo,
  atrasoAutoenvioMs: current.whatsappAutoEnvioDelayMs,
  monitorAtivo: current.monitorAlternadoAtivo,
  operacao: current.operacaoEstado,
  ofertaPreparada: current.ofertaPreparada,
  envioPendente: current.whatsappEnvioPendente,
  descontoMinimo: current.descontoMinimo,
  cooldownHoras: current.cooldownHoras,
  previewCooldownMinutos: current.previewCooldownMinutos
};
const resultados: {
  rota: string; largura: number; http: number;
  tema: string; erros: string[]; resources: string[]; overflow: number;
  screenshot: string;
}[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
let tentativasEscrita = 0;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const width of widths) {
    let navBaseline: Array<{x:number;y:number;width:number;height:number}> | null = null;
    const context = await browser.newContext({
      viewport: { width, height: 900 }, deviceScaleFactor: 1
    });
    await context.route("**/*", async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (req.method() !== "GET" || url.origin !== base.origin) {
        tentativasEscrita += req.method() !== "GET" ? 1 : 0;
        await route.abort();
      } else {
        await route.continue();
      }
    });
    const page = await context.newPage();
    const errors: string[] = [];
    const resources: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("response", res => {
      const path = new URL(res.url()).pathname;
      if (path.startsWith("/central/assets/") && res.status() >= 400) {
        resources.push(path + ": " + res.status());
      }
    });
    for (const rota of rotas) {
      const response = await page.goto(new URL(rota, base).href, { waitUntil: "domcontentloaded" });
      assert.equal(response?.status(), 200, "Rota quebrada: " + rota);
      await page.waitForTimeout(900);
      const measurements = await page.evaluate(() => {
        const sidebar = document.querySelector("#sidebar")!;
        const nav = document.querySelector("#cpvUnifiedNav")!;
        const top = document.querySelector(".cpv-global-top")!;
        const aside = sidebar.getBoundingClientRect();
        const context = top.getBoundingClientRect();
        const links = [...nav.querySelectorAll("a")].map(item => {
          const r = item.getBoundingClientRect();
          return {x:r.x,y:r.y,width:r.width,height:r.height};
        });
        return {
          tema: getComputedStyle(sidebar).backgroundColor,
          sidebarX: aside.x, sidebarWidth: aside.width,
          topX: context.x, topWidth: context.width, topHeight: context.height,
          links,
          overflow: document.documentElement.scrollWidth - innerWidth
        };
      });
      assert.ok(measurements.overflow <= 1, "Rolagem horizontal: " + rota + " " + width);
      assert.equal(measurements.tema, "rgb(23, 35, 51)", "Tema do menu perdido: " + rota);
      assert.equal(measurements.sidebarWidth, 252, "Menu com largura diferente: "+rota);
      assert.equal(measurements.links.length, 4, "Navegação incompleta: "+rota);
      if (width > 860) {
        assert.equal(measurements.sidebarX, 0, "Menu deslocado 1px ou mais: "+rota);
        assert.deepEqual(
          {x:measurements.topX,width:measurements.topWidth,height:measurements.topHeight},
          {x:252,width:width-252,height:78},
          "Barra de contexto fora da posição: "+rota
        );
      } else {
        assert.deepEqual(
          {x:measurements.topX,width:measurements.topWidth,height:measurements.topHeight},
          {x:0,width,height:70},
          "Barra móvel fora da posição: "+rota
        );
        await page.locator("#menuBtn").click();
        await page.waitForTimeout(270);
        const abertoX=await page.locator("#sidebar").evaluate(node=>node.getBoundingClientRect().x);
        assert.equal(abertoX,0,"Menu móvel não chegou à coordenada zero em "+rota);
        await page.keyboard.press("Escape");
      }
      if(navBaseline) assert.deepEqual(measurements.links,navBaseline,
        "Links desalinhados entre telas (incluindo 1px): "+rota);
      else navBaseline=measurements.links;
      if (rota === "/ofertas") {
        assert.equal(await page.locator("#autoEnvioButton").count(), 1);
        assert.equal(await page.locator("#cpvOpsPanel").count(), 1,
          "Status da operação sumiu da Central");
        assert.equal(await page.locator("#cpvTerminal").count(), 1,
          "Console de logs sumiu da Central");
        assert.equal(await page.locator("#cpvHistory").count(), 1,
          "Linha do tempo sumiu da Central");
        assert.equal(await page.locator("#cpvSettingsButton").count(), 1);
        assert.equal(await page.locator("#amazonTag").count(), 1);
        assert.equal(await page.locator("#mlClientSecret").count(), 1);
        assert.equal(await page.locator("#logs").count(), 1);
        const layout = await page.evaluate(() => {
          const banner = document.getElementById("cpvOpsPanel")!.getBoundingClientRect();
          const launch = document.getElementById("launchCard")!.getBoundingClientRect();
          const terminal = document.getElementById("cpvTerminal")!.getBoundingClientRect();
          return {before:banner.y<launch.y,side:terminal.x>=launch.x+launch.width-1};
        });
        assert.ok(layout.before,"Status não está acima do controle principal");
        if(width>=1370) assert.ok(layout.side,"Console não está do lado do ciclo");
        await page.locator("#cpvSettingsButton").click();
        await page.locator("#cpvSettingsDialog").waitFor({state:"visible"});
        await page.locator("#cpvSettingsTab-monitor").click();
        assert.ok((await page.locator("#cpvRuleDiscount").innerText()).includes("%"),
          "Regras reais não são exibidas no drawer");
        await page.locator("#cpvSettingsTab-contas").click();
        await page.screenshot({
          path:join(directory,"ofertas-config-"+width+".png"),
          animations:"disabled",
          mask:[page.locator("#cpvSettingsDialog input")],
          maskColor:"#dce5ec"
        });
        await page.keyboard.press("Escape");
        await page.locator("#cpvSettingsDialog").waitFor({state:"hidden"});
      }
      const screenshot = join(directory, rota.slice(1) + "-" + width + ".png");
      await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
      resultados.push({
        rota, largura: width, http: response!.status(),
        tema: measurements.tema, overflow: measurements.overflow,
        erros: [...errors], resources: [...resources], screenshot
      });
      assert.deepEqual(errors, [], "Erro JavaScript: " + rota);
      assert.deepEqual(resources, [], "Asset 404: " + rota);
    }
    await context.close();
  }
  assert.equal(tentativasEscrita, 0, "A página tentou gravar dados durante auditoria");
  const report = join(directory, "relatorio-readonly.json");
  await writeFile(report, JSON.stringify({
    versao: "UX-02", ambiente: "local", modo: "GET-only",
    status, rotas: resultados
  }, null, 2), "utf8");
  console.log("UX_LIVE_AUDIT_OK: " + resultados.length + " capturas locais, sem escrita ou recursos quebrados.");
  console.log("RELATORIO=" + report);
  console.log("STATUS_RESUMIDO=" + JSON.stringify(status));
} finally {
  await browser?.close();
}
