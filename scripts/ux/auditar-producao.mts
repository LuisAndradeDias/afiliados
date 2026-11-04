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
        const sidebar = document.querySelector(".sidebar");
        return {
          tema: sidebar ? getComputedStyle(sidebar).backgroundColor : "navegacao-superior",
          overflow: document.documentElement.scrollWidth - innerWidth
        };
      });
      assert.ok(measurements.overflow <= 2, "Rolagem horizontal: " + rota + " " + width);
      if (rota === "/central" || rota === "/shopee") {
        assert.equal(measurements.tema, "rgb(23, 35, 51)", "Tema perdido: " + rota);
      }
      if (rota === "/ofertas") {
        assert.equal(await page.locator("#autoEnvioButton").count(), 1);
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
    versao: "UX-01", ambiente: "local", modo: "GET-only",
    status, rotas: resultados
  }, null, 2), "utf8");
  console.log("UX_LIVE_AUDIT_OK: " + resultados.length + " capturas locais, sem escrita ou recursos quebrados.");
  console.log("RELATORIO=" + report);
  console.log("STATUS_RESUMIDO=" + JSON.stringify(status));
} finally {
  await browser?.close();
}
