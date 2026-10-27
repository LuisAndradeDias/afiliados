#!/usr/bin/env node
/**
 * Diagnóstico read-only da Etapa 50.
 * Não acessa tokens, cookies, contatos ou logs; nunca envia mensagens.
 * Requisições: somente GET em serviços no loopback.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, win32 } from "node:path";

const options = {
  root: "C:\\projeto02",
  chrome: join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "User Data"),
  dashboard: "http://127.0.0.1:3030",
  capture: "http://127.0.0.1:3040",
  noHttp: false,
  json: false,
};
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const key = args[i];
  if (key === "--no-http") options.noHttp = true;
  else if (key === "--json") options.json = true;
  else if (["--root", "--chrome-data", "--dashboard", "--capture"].includes(key)) {
    const value = args[++i];
    if (!value) throw new Error("Missing argument");
    const field = ({
      "--root": "root", "--chrome-data": "chrome",
      "--dashboard": "dashboard", "--capture": "capture",
    })[key];
    options[field] = value;
  } else throw new Error("Unknown option");
}
function localOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Only local HTTP services are permitted");
  }
  return url.origin;
}
if (!options.noHttp) {
  options.dashboard = localOrigin(options.dashboard);
  options.capture = localOrigin(options.capture);
}
async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}
const extensionRoot = win32.normalize(win32.join(
  options.root, "browser-extension", "mercadolivre-affiliate"
));
function isMeliExtensionPath(path) {
  return /(?:^|[\\/])browser-extension[\\/]mercadolivre-affiliate[\\/]?$/i.test(path);
}
function samePath(a, b) {
  return win32.normalize(a).replace(/[\\/]+$/, "").toLowerCase() ===
    win32.normalize(b).replace(/[\\/]+$/, "").toLowerCase();
}
async function chromeRegistrations(root) {
  const result = { profilesInspected: 0, unreadableProfiles: 0, registrations: [] };
  let dirs;
  try { dirs = await readdir(root, { withFileTypes: true }); }
  catch { return result; }
  for (const entry of dirs) {
    if (!entry.isDirectory() || !/^(Default|Profile \d+)$/.test(entry.name)) continue;
    const prefs = join(root, entry.name, "Secure Preferences");
    if (!(await exists(prefs))) continue;
    result.profilesInspected++;
    try {
      const json = JSON.parse(await readFile(prefs, "utf8"));
      const settings = json?.extensions?.settings;
      if (!settings || typeof settings !== "object") continue;
      for (const ext of Object.values(settings)) {
        const path = ext && typeof ext === "object" ? ext.path : null;
        if (typeof path !== "string" || !isMeliExtensionPath(path)) continue;
        result.registrations.push({
          profile: entry.name,
          pointsToCurrent: samePath(path, extensionRoot),
          registeredFolderExists: await exists(path),
        });
      }
    } catch { result.unreadableProfiles++; }
  }
  return result;
}
async function safeGet(base, path, expectJson = true) {
  try {
    const resp = await fetch(base + path, {
      method: "GET", redirect: "manual", cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });
    if (resp.status !== 200) return { ok: false, value: null };
    if (!expectJson) return { ok: true, value: null };
    const value = await resp.json();
    return value && typeof value === "object"
      ? { ok: true, value } : { ok: false, value: null };
  } catch { return { ok: false, value: null }; }
}
const chrome = await chromeRegistrations(options.chrome);
const status = options.noHttp ? { ok: false, value: null } :
  await safeGet(options.dashboard, "/api/status");
const campaigns = options.noHttp ? { ok: false, value: null } :
  await safeGet(options.capture, "/saude", false);
const s = status.value || {};
const safeFlags = status.ok &&
  s.whatsappAutoEnvioAtivo === false &&
  s.monitorAlternadoAtivo === false &&
  s.mercadoLivreMonitorAtivo === false &&
  s.whatsappEnvioPendente === false &&
  s.operacaoEstado === "paused" &&
  Array.isArray(s.executando) && s.executando.length === 0;
const stale = chrome.registrations.filter(r =>
  !r.pointsToCurrent || !r.registeredFolderExists
).length;
const report = {
  audit: "etapa50-local-v1",
  readOnly: true,
  didNotSendMessages: true,
  didNotRefreshTokens: true,
  activeRootPresent: await exists(join(options.root, "package.json")),
  extensionFilesPresent: await exists(join(extensionRoot, "manifest.json")) &&
    await exists(join(extensionRoot, "background.js")),
  chrome,
  staleExtensionRegistrations: stale,
  runtime: {
    dashboardReachable: status.ok,
    campaignsReachable: campaigns.ok,
    automaticSendingAndMonitorsDisabled: safeFlags,
    groupConfigured: status.ok ? s.grupoConfigurado === true : null,
    whatsappProfileFolderPresent: await exists(
      join(options.root, "data", "whatsapp-profile")),
    amazonTagConfigured: status.ok ? s.afiliadoConfigurado === true : null,
    meliOauthSettingsConfigured: status.ok ? s.mercadoLivreOauthPronto === true : null,
    meliAccessTokenConfigured: status.ok ? s.mercadoLivreApiConfigurada === true : null,
    meliExtensionHeartbeat: status.ok ? s.mercadoLivreExtensionConectada === true : null,
    meliLinkGenerationVerified: null,
    amazonRealOffersVerified: null,
    whatsappRealSendVerified: null,
  },
  conclusions: {
    repairChromeExtensionPath: stale > 0,
    approvedForAutomaticSending: false,
    requiresSupervisedFunctionalValidation: true,
  },
};
if (options.json) console.log(JSON.stringify(report));
else {
  console.log("Etapa 50 - diagnóstico somente leitura");
  console.log("Painel:", status.ok ? "acessível" : "indisponível");
  console.log("Campanhas:", campaigns.ok ? "acessível" : "indisponível");
  console.log("Registro antigo da extensão Meli:", stale > 0 ? "detectado" : "não detectado");
  console.log("Monitores e envios pausados:", safeFlags ? "confirmado" : "não confirmado");
  console.log("Publicação e link real ainda dependem de homologação supervisionada.");
}
