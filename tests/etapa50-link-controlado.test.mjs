import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(project, "scripts", "etapa50", "teste-link-controlado.ps1");

test("probe de link recusa execucao sem confirmacao manual", {
  skip: process.platform !== "win32",
}, () => {
  const r = spawnSync("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
    "-File", script,
  ], { encoding: "utf8", timeout: 10000 });
  assert.equal(r.status, 3, r.stderr || r.stdout);
  assert.match(r.stdout, /EXECUTION_REFUSED/);
  assert.doesNotMatch(r.stdout + r.stderr, /Bearer |access_token|refresh_token|PREFLIGHT=PASS/i);
});

test("probe exige estado pausado e remove oferta temporaria", () => {
  const text = readFileSync(script, "utf8");
  assert.match(text, /param\(\[switch\]\$ConfirmarTesteManual\)/);
  assert.match(text, /Test-Path -LiteralPath \$offerFile/);
  assert.match(text, /Test-Path \$whatsMsg/);
  assert.match(text, /Test-Path \$whatsOffer/);
  assert.match(text, /function Validate-Paused/);
  assert.match(text, /FileMode\]::CreateNew/);
  assert.match(text, /products\/search\?/);
  assert.match(text, /products\/.+\/items/);
  assert.match(text, /No purchasable catalog with confirmed winning item and stock/);
  assert.match(text, /buy_box_winner/);
  assert.match(text, /available_quantity -le 0/);
  assert.match(text, /disponibilidadeConfirmada=\$true/);
  assert.match(text, /anuncioId=\[string\]\$winningItem\.item_id/);
  assert.match(text, /etapa50TesteControlado/);
  assert.match(text, /Remove-Item -LiteralPath \$offerFile/);
  assert.match(text, /OFFICIAL_HTTPS_DOMAIN=VERIFIED/);
  assert.match(text, /UNFINISHED_JOB=MARKED_ERROR/);
});

test("PowerShell do probe tem sintaxe valida", {
  skip: process.platform !== "win32",
}, () => {
  const r = spawnSync("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-Command",
    "$t=$null;$e=$null;[System.Management.Automation.Language.Parser]::ParseFile(" +
      JSON.stringify(script) + ",[ref]$t,[ref]$e)|Out-Null;if(@($e).Count){exit 2}",
  ], { encoding: "utf8", timeout: 10000 });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});
