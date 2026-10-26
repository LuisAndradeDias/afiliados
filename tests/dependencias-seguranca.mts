import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));

test("security: zod must not be declared as an unused direct dependency", () => {
  assert.equal(Object.hasOwn(manifest.dependencies ?? {}, "zod"), false,
    "zod has no application imports and exposes an unnecessary HIGH vulnerability");
  assert.equal(Object.hasOwn(manifest.devDependencies ?? {}, "zod"), false);
});

test("security: lockfile must match the removal of zod", () => {
  const rootPackage = lock.packages?.[""] ?? {};
  assert.equal(Object.hasOwn(rootPackage.dependencies ?? {}, "zod"), false);
  assert.equal(Object.hasOwn(lock.packages ?? {}, "node_modules/zod"), false);
});

test("security: first-party entrypoints must not import removed zod", () => {
  const roots = ["src", "scripts", "tests", "browser-extension",
    "captacao/caca-promos-vip/src", "captacao/caca-promos-vip/tests",
    "captacao/caca-promos-vip/extensao-lateral"];
  const ext = new Set([".ts", ".mts", ".cts", ".js", ".mjs", ".cjs", ".tsx", ".jsx"]);
  const skipped = new Set([".git", "node_modules", "ocr", "dist", "build", ".worktrees"]);
  const illegal = [];
  let filesChecked = 0;
  function scan(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (skipped.has(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(path);
      } else if (entry.isFile() && ext.has(extname(entry.name))) {
        // Ignore generated third-party bundles (the OCR .wasm.js contains incidental text).
        if (entry.name.endsWith(".wasm.js") || entry.name.endsWith(".min.js")) continue;
        if (statSync(path).size > 2_000_000) continue;
        const code = readFileSync(path, "utf8");
        filesChecked++;
        if (/(?:from\s*|import\s*\(\s*|require\s*\(\s*)["']zod(?:\/[^"']*)?["']/.test(code)) {
          illegal.push(path.slice(root.length));
        }
      }
    }
  }
  for (const name of roots) scan(resolve(root, name));
  assert.ok(filesChecked > 100, "scan must inspect actual first-party files");
  assert.deepEqual(illegal, [], "a newly imported Zod requires its own migration and audit");
});
