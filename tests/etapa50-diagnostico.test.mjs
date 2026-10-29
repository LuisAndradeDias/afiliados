import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("..", import.meta.url));
const checker = join(project, "scripts", "etapa50", "diagnostico-local.mjs");
const marker = "PRIVATE_SYNTHETIC_TOKEN_DO_NOT_PRINT";

async function run(extra) {
  const child = spawn(process.execPath, [checker, "--json", ...extra], {
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  let output = "", error = "";
  for await (const chunk of child.stdout) output += chunk;
  for await (const chunk of child.stderr) error += chunk;
  const code = await new Promise(resolve => child.once("close", resolve));
  assert.equal(code, 0, error);
  assert.doesNotMatch(output + error, new RegExp(marker));
  return JSON.parse(output.trim());
}

async function withFixtures(callback) {
  const base = await mkdtemp(join(tmpdir(), "projeto-etapa50-"));
  const root = join(base, "projeto02");
  const chrome = join(base, "chrome");
  const ext = join(root, "browser-extension", "mercadolivre-affiliate");
  try {
    await mkdir(ext, { recursive: true });
    await mkdir(join(chrome, "Profile 10"), { recursive: true });
    await mkdir(join(chrome, "Profile 11"), { recursive: true });
    await writeFile(join(root, "package.json"), '{"private":true}');
    await writeFile(join(ext, "manifest.json"), '{"manifest_version":3}');
    await writeFile(join(ext, "background.js"), "// test");
    await writeFile(join(chrome, "Profile 10", "Secure Preferences"), JSON.stringify({
      extensions: { settings: { legacy: {
        path: "C:\\projeto01\\browser-extension\\mercadolivre-affiliate",
        secret: marker,
      } } },
    }));
    await writeFile(join(chrome, "Profile 11", "Secure Preferences"), JSON.stringify({
      extensions: { settings: { current: { path: ext } } },
    }));
    return await callback({ base, root, chrome, ext });
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

test("diagnóstico offline identifica extensão antiga sem divulgar dados", () =>
  withFixtures(async ({ root, chrome }) => {
    const report = await run(["--no-http", "--root", root, "--chrome-data", chrome]);
    assert.equal(report.readOnly, true);
    assert.equal(report.didNotSendMessages, true);
    assert.equal(report.didNotRefreshTokens, true);
    assert.equal(report.activeRootPresent, true);
    assert.equal(report.extensionFilesPresent, true);
    assert.equal(report.staleExtensionRegistrations, 1);
    assert.equal(report.chrome.registrations.length, 2);
    assert.equal(report.chrome.registrations[0].profile, "Profile 10");
    assert.equal(report.chrome.registrations[0].registeredFolderExists, false);
    assert.equal(report.chrome.registrations[1].pointsToCurrent, true);
    assert.equal(report.runtime.dashboardReachable, false);
    assert.equal(report.runtime.automaticSendingAndMonitorsDisabled, false);
    assert.equal(report.conclusions.approvedForAutomaticSending, false);
    assert.ok(!JSON.stringify(report).includes(root));
    assert.ok(!JSON.stringify(report).includes(marker));
  })
);

test("diagnóstico online usa GET apenas e nunca libera envios", () =>
  withFixtures(async ({ root, chrome }) => {
    const requests = [];
    const server = createServer((req, res) => {
      requests.push(req.method + " " + req.url);
      res.setHeader("content-type", "application/json");
      if (req.url === "/api/status") {
        res.end(JSON.stringify({
          grupoConfigurado: true,
          afiliadoConfigurado: true,
          mercadoLivreOauthPronto: true,
          mercadoLivreApiConfigurada: true,
          mercadoLivreExtensionConectada: true,
          whatsappAutoEnvioAtivo: false,
          monitorAlternadoAtivo: false,
          mercadoLivreMonitorAtivo: false,
          whatsappEnvioPendente: false,
          operacaoEstado: "paused", executando: [],
          segredoQueNaoPodeSair: marker,
        }));
      } else if (req.url === "/saude") {
        res.setHeader("content-type", "text/plain");
        res.end("OK");
      }
      else { res.statusCode = 404; res.end("{}"); }
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      const base = "http://127.0.0.1:" + address.port;
      const report = await run([
        "--root", root, "--chrome-data", chrome,
        "--dashboard", base, "--capture", base,
      ]);
      assert.equal(report.runtime.dashboardReachable, true);
      assert.equal(report.runtime.campaignsReachable, true);
      assert.equal(report.runtime.meliExtensionHeartbeat, true);
      assert.equal(report.runtime.automaticSendingAndMonitorsDisabled, true);
      assert.equal(report.runtime.meliLinkGenerationVerified, null);
      assert.deepEqual(requests.sort(), ["GET /api/status", "GET /saude"].sort());
      assert.equal(report.conclusions.approvedForAutomaticSending, false);
    } finally { await new Promise(resolve => server.close(resolve)); }
  })
);
