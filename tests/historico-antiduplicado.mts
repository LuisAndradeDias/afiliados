import { strict as assert } from "node:assert";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  chavesBloqueadas,
  cooldownHoras,
  filtroHistoricoOfertas,
  limparHistoricoOfertas,
  mesmoProdutoHistorico,
  normalizarTituloProduto,
  ofertaJaEnviadaRecentemente,
  registrarOfertaEnviada,
  registrarOfertaVista
} from "../src/ofertas/historico.js";

const anteriorCwd = process.cwd();
const originalCooldown = process.env.OFFER_COOLDOWN_HOURS;
const pastaTeste = await mkdtemp(join(tmpdir(), "afiliados-antiduplicado-"));

const twibi = {
  plataforma: "Amazon Brasil",
  produtoId: "B0C6TY3PCK",
  titulo: "Conjunto de Roteador Sem Fio WI-FI 6 Twibi Force AX Branco Intelbras",
  precoAtual: 341.20,
  descontoPercentual: 59
};
const twibiOutroAnuncio = {
  ...twibi,
  produtoId: "B0OUTROAXX",
  titulo: "Kit roteador Wi-Fi 6 Twibi Force AX Branco Intelbras"
};
const twibiMercadoLivre = {
  ...twibi,
  plataforma: "Mercado Livre",
  produtoId: "MLB91234567",
  titulo: "Roteador Intelbras Twibi Force AX WiFi 6 Branco"
};

try {
  process.chdir(pastaTeste);
  process.env.OFFER_COOLDOWN_HOURS = "168";
  assert.equal(cooldownHoras(), 168);
  assert.equal(normalizarTituloProduto("Roteador  Wi-Fí 6"), "roteador wi fi 6");

  assert.ok(mesmoProdutoHistorico(twibi, twibi));
  assert.ok(mesmoProdutoHistorico(twibi, twibiOutroAnuncio), "Mesmo roteador, ASIN diferente");
  assert.ok(mesmoProdutoHistorico(twibi, twibiMercadoLivre), "Mesmo produto no Mercado Livre");
  assert.equal(mesmoProdutoHistorico(
    twibi, { ...twibi, produtoId: "OUTRO", titulo: "Twibi Force AX WiFi 5 Branco Intelbras" }
  ), false, "Modelo Wi-Fi 5 não é Wi-Fi 6");
  assert.equal(mesmoProdutoHistorico(
    { ...twibi, produtoId: "ONE", titulo: "Smartphone Samsung Galaxy A56 128GB" },
    { ...twibi, produtoId: "TWO", titulo: "Smartphone Samsung Galaxy A56 256GB" }
  ), false, "Capacidades diferentes não podem ser confundidas");

  await registrarOfertaVista(twibi);
  assert.equal(await ofertaJaEnviadaRecentemente(twibi), false,
    "Visualização da própria oferta não pode bloquear o envio legítimo");
  const filtroVisto = await filtroHistoricoOfertas();
  assert.equal(filtroVisto(twibiOutroAnuncio), true, "Oferta vista recentemente já bloqueia prévia duplicada");

  await registrarOfertaEnviada(twibi);
  assert.equal(await ofertaJaEnviadaRecentemente(twibi), true);
  assert.equal(await ofertaJaEnviadaRecentemente(twibiOutroAnuncio), true);
  assert.equal(await ofertaJaEnviadaRecentemente(twibiMercadoLivre), true);
  assert.ok((await chavesBloqueadas()).has("amazon:b0c6ty3pck"));

  // Mesmo depois de 72 horas, não permitir duplicação durante a semana.
  const historico = JSON.parse(await readFile("data/historico-ofertas.json", "utf8"));
  historico[0].enviadoEm = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  historico[0].vistoEm = historico[0].enviadoEm;
  await writeFile("data/historico-ofertas.json", JSON.stringify(historico), "utf8");
  assert.equal(await ofertaJaEnviadaRecentemente(twibiOutroAnuncio), true);
  historico[0].enviadoEm = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  historico[0].vistoEm = historico[0].enviadoEm;
  await writeFile("data/historico-ofertas.json", JSON.stringify(historico), "utf8");
  assert.equal(await ofertaJaEnviadaRecentemente(twibiOutroAnuncio), false,
    "Depois do prazo, o item volta a ser elegível");

  await limparHistoricoOfertas();
  const novas = Array.from({ length: 12 }, (_, index) => ({
    ...twibi,
    produtoId: "B0ID" + String(index).padStart(7, "0"),
    titulo: "Produto de teste " + index
  }));
  await Promise.all(novas.map((oferta) => registrarOfertaVista(oferta)));
  const resultado = JSON.parse(await readFile("data/historico-ofertas.json", "utf8"));
  assert.equal(resultado.length, 12, "Gravações simultâneas não podem perder registros");
  assert.equal(await ofertaJaEnviadaRecentemente(novas[0]), false);

  // O histórico inválido deve bloquear o robô, nunca liberar todos os IDs.
  await writeFile("data/historico-ofertas.json", "{INVALID JSON", "utf8");
  await assert.rejects(filtroHistoricoOfertas(), /Histórico de ofertas inválido/);
  await assert.rejects(ofertaJaEnviadaRecentemente(twibi), /Histórico de ofertas inválido/);

  // Teste isolado do preparador: duplicado precisa sair ANTES de abrir Chrome.
  await limparHistoricoOfertas();
  await registrarOfertaEnviada(twibi);
  await mkdir("data", { recursive: true });
  await writeFile("data/ultima-mensagem-whatsapp.txt", "Oferta de teste, não enviar", "utf8");
  await writeFile("data/ultima-oferta-whatsapp.json", JSON.stringify(twibiOutroAnuncio), "utf8");

  const preparador = fileURLToPath(new URL("../src/robo/whatsapp-preparar.ts", import.meta.url));
  const tsxCli = fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url));
  const child = spawnSync(process.execPath, [tsxCli, preparador], {
    cwd: pastaTeste,
    encoding: "utf8",
    timeout: 20_000,
    env: {
      ...process.env,
      WHATSAPP_PREPARE_TEST: "false",
      WHATSAPP_BROWSER_CHANNEL: "__impossivel_abrir_browser__",
      WHATSAPP_AUTO_SEND_ENABLED: "true",
      WHATSAPP_GROUP_NAME: "Caça Promos Vip👑"
    }
  });
  assert.equal(child.status, 4,
    "O preparador deve bloquear o repetido antes de abrir Chrome: " +
    (child.stderr || "").slice(0, 250));
  assert.match(child.stdout, /DUPLICADO_BLOQUEADO/);

  const painel = await readFile(fileURLToPath(new URL("../src/painel/server.ts", import.meta.url)), "utf8");
  assert.ok(painel.includes("if (codigo === 4)"),
    "Painel deve tratar bloqueio sem registrar como enviado");

  console.log(
    "historico-antiduplicado: OK (ASIN alternativo, marketplaces, variantes, " +
    "cooldown de 7 dias, concorrência, histórico inválido e bloqueio antes do clique)"
  );
} finally {
  process.chdir(anteriorCwd);
  if (originalCooldown === undefined) delete process.env.OFFER_COOLDOWN_HOURS;
  else process.env.OFFER_COOLDOWN_HOURS = originalCooldown;
  await rm(pastaTeste, { recursive: true, force: true });
}
