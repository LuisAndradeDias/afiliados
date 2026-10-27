import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const bat = join(repo, "Abrir Painel.bat");
const preflight = join(repo, "scripts", "windows", "preflight-afiliados.ps1");
const staging = join(repo, "scripts", "windows", "preparar-homologacao.ps1");
const onWindows = process.platform === "win32";

function powershell(file, args = []) {
  return spawnSync("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", file, ...args
  ], { cwd: tmpdir(), encoding: "utf8", timeout: 80_000 });
}

test("launcher uses its own directory and --verificar never starts robots", { skip: !onWindows }, () => {
  const code = readFileSync(bat, "utf8");
  assert.doesNotMatch(code, /C:\\PromocoesAfiliados/i);
  assert.match(code, /%~dp0/);
  assert.match(code, /--verificar/i);
  assert.match(code, /scripts\\launcher\\iniciar-painel.cmd/i);
  // Never execute legacy launcher without a verified harmless check mode.
  const checked = spawnSync("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-Command",
    `& cmd.exe /d /c 'call "${bat}" --verificar'`
  ], { cwd: tmpdir(), encoding: "utf8", timeout: 10_000 });
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  assert.match(checked.stdout, /PAINEL_VERIFICADO/);
});

test("preflight returns safe read-only JSON without credentials", { skip: !onWindows }, () => {
  assert.ok(existsSync(preflight), "PowerShell preflight must exist");
  const response = powershell(preflight, ["-ProjectDir", repo, "-Json"]);
  assert.equal(response.status, 0, response.stderr || response.stdout);
  const data = JSON.parse(response.stdout.trim());
  assert.equal(data.readOnly, true);
  assert.equal(data.projectLooksValid, true);
  assert.equal(typeof data.tools.node, "string");
  assert.equal(typeof data.tools.npm, "string");
  assert.equal(typeof data.tools.git, "string");
  assert.ok(Array.isArray(data.ports));
  assert.deepEqual(data.ports.map(p => p.port), [3030, 3040, 3045]);
  assert.equal(data.readyForActivation,
    data.readyForStaging && data.ports.every(p => p.checked && !p.listening),
    "never claim activation readiness if a port cannot be inspected");
  assert.doesNotMatch(response.stdout, /access_token|refresh_token|client_secret|password|chave.admin|[.]env[=]/i);
});

test("staging defaults to dry run and refuses to create a folder", { skip: !onWindows }, () => {
  assert.ok(existsSync(staging), "Safe staging PowerShell script must exist");
  const temp = mkdtempSync(join(tmpdir(), "cpv-stage-dry-"));
  const dest = join(temp, "projeto05-homologacao-teste");
  try {
    const r = powershell(staging, ["-SourceDir", repo, "-DestinationDir", dest]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /DRY_RUN/);
    assert.equal(existsSync(dest), false, "dry-run must not write any files");
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("explicit stage exports only Git-tracked files, never local profiles or secrets", {
  skip: !onWindows
}, () => {
  assert.ok(existsSync(staging));
  const tmp = mkdtempSync(join(tmpdir(), "cpv-stage-real-"));
  const dest = join(tmp, "projeto05-homologacao-teste");
  try {
    const result = powershell(staging, ["-SourceDir", repo, "-DestinationDir", dest, "-Execute"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.ok(existsSync(join(dest, "package.json")));
    assert.ok(existsSync(join(dest, "package-lock.json")));
    for (const name of [".env", "data", "dados", ".git", "node_modules",
      join("captacao", "caca-promos-vip", "dados")]) {
      assert.equal(existsSync(join(dest, name)), false, name + " must not be copied");
    }
    // No overwrites or hidden re-use on repeated executions.
    const again = powershell(staging, ["-SourceDir", repo, "-DestinationDir", dest, "-Execute"]);
    assert.notEqual(again.status, 0, "existing destination must be refused");

    const unsafe = powershell(staging, [
      "-SourceDir", repo, "-DestinationDir", join(repo, "homologacao-interna"), "-Execute"
    ]);
    assert.notEqual(unsafe.status, 0, "never stage inside the source checkout");
    assert.equal(existsSync(join(repo, "homologacao-interna")), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("future staging uses neutral directories and protects current installations", {
  skip: !onWindows,
}, () => {
  const source = readFileSync(staging, "utf8");
  assert.ok(source.includes("DestinationDir = 'C:\\projeto05'"));
  for (const path of ["C:\\projeto01", "C:\\projeto02", "C:\\projeto03", "C:\\projeto04"]) {
    assert.ok(source.includes("'" + path + "'"), "must protect " + path);
  }
});
