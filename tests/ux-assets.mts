/**
 * UX-01: verificação estática da cadeia HTML -> CSS/JS -> imports CSS.
 * Deve falhar se um arquivo é importado no navegador, mas não está exposto
 * pela allowlist de rotas visuais.
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = join(process.cwd(), "src", "painel");
const publicDir = join(root, "public");
const source = await readFile(join(root, "rotas-visuais.ts"), "utf8");
const allowed = new Map<string, string>();
const regex = /"(\/central\/assets\/[a-zA-Z0-9.-]+)"\s*:\s*"([a-zA-Z0-9.-]+)"/g;
for (const match of source.matchAll(regex)) {
  allowed.set(match[1], match[2]);
}
assert.ok(allowed.size >= 9, "A lista de recursos visuais pode ter sido removida");

const files = await readdir(publicDir);
const expected = new Set<string>();
for (const file of files) {
  if (!file.endsWith(".html") && !file.endsWith(".css")) continue;
  const contents = await readFile(join(publicDir, file), "utf8");

  if (file.endsWith(".html")) {
    // Arquivos de CSS/JS carregados de rotas explícitas.
    for (const match of contents.matchAll(/(?:href|src)\s*=\s*["'](\/central\/assets\/[^"'?]+)(?:\?[^"']*)?["']/g)) {
      expected.add(match[1]);
    }
  }
  if (file.endsWith(".css")) {
    // Imports relativos como "./central.tokens.css?v=..." também usam a allowlist.
    for (const match of contents.matchAll(/@import\s+(?:url\()?["']?\.\/([^"'?)\s]+)(?:\?[^"'?)\s]*)?["']?\)?/g)) {
      expected.add("/central/assets/" + match[1]);
    }
  }
}

const missing = (references: ReadonlySet<string>, allowlist: ReadonlyMap<string, string>) =>
  [...references].filter(path => !allowlist.has(path));

assert.deepEqual(missing(expected, allowed), [],
  "Existem estilos/scripts referenciados mas indisponíveis no roteamento");

for (const [url, file] of allowed) {
  assert.ok(files.includes(file), "Asset allowlisted mas inexistente no disco: " + url);
  assert.ok(file.endsWith(".css") || file.endsWith(".js"),
    "Allowlist não deve publicar tipo arbitrário: " + file);
}
assert.ok(expected.has("/central/assets/central.tokens.css"),
  "O import do tema foi removido da cadeia visual");
assert.ok(allowed.has("/central/assets/central.tokens.css"),
  "central.tokens.css não está publicado e repetiria o bug histórico");

// Teste negativo: uma allowlist sem o token deve ser reprovada pelo verificador.
const semTokens = new Map(allowed);
semTokens.delete("/central/assets/central.tokens.css");
assert.ok(missing(expected, semTokens).includes("/central/assets/central.tokens.css"),
  "O teste precisa detectar o bug real de 04/11/2026");

console.log("UX_ASSETS_OK: " + expected.size + " referências, " + allowed.size +
  " recursos permitidos, import do tema protegido, cenário negativo detectado.");
