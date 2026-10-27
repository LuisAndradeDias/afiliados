import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync,
  rmSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(project, "scripts", "windows", "auditar-consolidacao-etapa49.ps1");
const isWindows = process.platform === "win32";
const marker = "SYNTHETIC-DO-NOT-REVEAL-ETAPA49";

function runAudit({ root, installed, backup, legacy, extraArgs = [] }) {
  const processResult = spawnSync("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
    "-File", script, "-CodeDir", root,
    "-OperationalDir", installed, "-BackupDir", backup, "-LegacyDir", legacy,
    "-Json", "-SkipComparison", ...extraArgs,
  ], { encoding: "utf8", timeout: 30_000 });
  assert.equal(processResult.status, 0, processResult.stderr || processResult.stdout);
  assert.doesNotMatch(processResult.stdout, /SYNTHETIC-DO-NOT-REVEAL-ETAPA49/);
  return JSON.parse(processResult.stdout.trim());
}

function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), "afiliados-etapa49-"));
  const installed = join(dir, "installed");
  const legacy = join(dir, "legacy");
  const backup = join(dir, "backups");
  try {
    for (const path of [installed, legacy, backup]) mkdirSync(path);
    mkdirSync(join(installed, "data", "whatsapp-profile"), { recursive: true });
    return run({ root: project, installed, backup, legacy });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const flags = [
  "ALTERNATING_MONITOR_ENABLED=false",
  "MERCADOLIVRE_MONITOR_ENABLED=false",
  "WHATSAPP_AUTO_SEND_ENABLED=false",
].join("\n");

test("audit is strictly read-only and never prints synthetic secret content", {
  skip: !isWindows,
}, () => fixture((ctx) => {
  const path = join(ctx.installed, ".env");
  const contents = flags + "\nEXAMPLE_PRIVATE_VALUE=" + marker + "\n";
  writeFileSync(path, contents, "utf8");
  const before = readdirSync(ctx.installed).sort();
  const report = runAudit(ctx);
  assert.equal(report.audit, "etapa49-v1");
  assert.equal(report.readOnly, true);
  assert.equal(report.doesNotApproveActivation, true);
  assert.equal(report.safeConfiguration.automationFlagsAllDisabled, true);
  assert.equal(report.paths.installed.exists, true);
  assert.equal(report.paths.configuration.exists, true);
  assert.equal(report.paths.backupDirectories, 0);
  assert.deepEqual(report.ports.map((p) => p.port), [3030, 3040, 3045]);
  assert.ok(report.ports.every((p) => typeof p.loopbackOnly === "boolean"));
  assert.deepEqual(readdirSync(ctx.installed).sort(), before);
  assert.equal(readFileSync(path, "utf8"), contents);
  assert.equal(report.source.trackedSensitivePathAlerts, 0);
}));

test("automation cannot be considered off with a true, absent or repeated flag", {
  skip: !isWindows,
}, () => fixture((ctx) => {
  const path = join(ctx.installed, ".env");
  for (const contents of [
    flags.replace("WHATSAPP_AUTO_SEND_ENABLED=false", "WHATSAPP_AUTO_SEND_ENABLED=true"),
    flags.replace("MERCADOLIVRE_MONITOR_ENABLED=false", ""),
    flags + "\nWHATSAPP_AUTO_SEND_ENABLED=false",
  ]) {
    writeFileSync(path, contents + "\nPRIVATE=" + marker + "\n", "utf8");
    assert.equal(runAudit(ctx).safeConfiguration.automationFlagsAllDisabled, false);
  }
}));

test("missing local configuration is never silently marked safe", {
  skip: !isWindows,
}, () => fixture((ctx) => {
  assert.equal(existsSync(join(ctx.installed, ".env")), false);
  const report = runAudit(ctx);
  assert.equal(report.safeConfiguration.automationFlagsAllDisabled, false);
  assert.equal(report.paths.configuration.exists, false);
  assert.equal(report.doesNotApproveActivation, true);
}));

test("gitignore rejects sensitive local artifacts but keeps public examples", () => {
  const blocked = [
    ".env.production",
    "src/robo/.env.local",
    "data/whatsapp-profile/sessao.json",
    "captacao/caca-promos-vip/dados/contatos.csv",
    "diagnosticos-local/resultado.txt",
    "certificados/segredo.pfx",
    "certificados/chave.pem",
    "data/registros.sqlite",
  ];
  for (const path of blocked) {
    const r = spawnSync("git", ["-C", project, "check-ignore", "--no-index", "-q", "--", path],
      { encoding: "utf8", timeout: 10_000 });
    assert.equal(r.status, 0, "private path must be ignored: " + path);
  }
  for (const path of [".env.example", "src/robo/.env.example"]) {
    const r = spawnSync("git", ["-C", project, "check-ignore", "--no-index", "-q", "--", path],
      { encoding: "utf8", timeout: 10_000 });
    assert.equal(r.status, 1, "safe template must remain tracked: " + path);
  }
});
