import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  avaliarElegibilidadeCanal,
  consultarElegibilidadeCanalWhatsapp,
  identificarPlataformaCanal
} from "../src/canais/elegibilidade.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const now = new Date("2026-10-29T12:00:00.000Z");
const nomeFicticio = "Grupo EXCLUSIVAMENTE FICTICIO";
const urlOficial = "https://www.mercadolivre.com.br/l/afiliados-compartilhamento-de-publicacao";
function aprovacao() {
  return {
    destino: nomeFicticio,
    plataforma: "mercado-livre",
    tipo: "whatsapp-grupo",
    visibilidade: "publico",
    autorizadoPeloResponsavel: true,
    declaradoNoPrograma: true,
    homologacao: {
      estado: "homologado",
      responsavel: "revisor-ficticio",
      aprovadaEm: "2026-10-29T10:00:00.000Z"
    },
    regraOficial: {
      url: urlOficial,
      verificadaEm: "2026-10-29T10:00:00.000Z",
      permiteDivulgacao: true,
      conflitoEsclarecido: true
    }
  };
}
function avaliar(registro: unknown, plataforma = "Mercado Livre") {
  return avaliarElegibilidadeCanal(
    { versao: 1, registros: [registro] },
    { grupo: nomeFicticio, plataforma, agora: now }
  );
}

test("plataformas sao especificas e desconhecidas nunca sao elegiveis", () => {
  assert.equal(identificarPlataformaCanal("Mercado Livre"), "mercado-livre");
  assert.equal(identificarPlataformaCanal("Amazon Brasil"), "amazon");
  assert.equal(identificarPlataformaCanal("Shopee"), "shopee");
  assert.equal(identificarPlataformaCanal("Outra loja"), null);
  assert.equal(avaliar(aprovacao(), "Outra loja").podePublicar, false);
  assert.equal(avaliar(aprovacao(), "Shopee").codigo, "CANAL_NAO_HOMOLOGADO");
});

test("somente o cadastro exato e completo pode permitir publicacao", () => {
  const valido = avaliar(aprovacao());
  assert.equal(valido.estado, "elegivel");
  assert.equal(valido.podePublicar, true);
  const outro = avaliarElegibilidadeCanal(
    { versao: 1, registros: [aprovacao()] },
    { grupo: "Grupo ficticio diferente", plataforma: "Mercado Livre", agora: now }
  );
  assert.equal(outro.estado, "pendente-verificacao");
  assert.equal(outro.podePublicar, false);
  const duplicado = avaliarElegibilidadeCanal(
    { versao: 1, registros: [aprovacao(), aprovacao()] },
    { grupo: nomeFicticio, plataforma: "Mercado Livre", agora: now }
  );
  assert.equal(duplicado.codigo, "REGISTROS_DUPLICADOS");
});

test("grupo privado prevalece sobre qualquer aprovacao manual ou pontuacao", () => {
  const privado = { ...aprovacao(), visibilidade: "privado" };
  assert.equal(avaliar(privado).codigo, "CANAL_PRIVADO_NAO_PERMITIDO");
  assert.equal(avaliar(privado).podePublicar, false);
  assert.equal(avaliar({ ...aprovacao(), visibilidade: "desconhecido" }).estado,
    "pendente-verificacao");
  assert.equal(avaliar({ ...aprovacao(), tipo: "whatsapp-contato" }).podePublicar, false);
});

test("suspensao e proibicao explicita impedem envio", () => {
  const suspenso = { ...aprovacao(), homologacao: {
    ...aprovacao().homologacao, estado: "suspenso"
  } };
  assert.equal(avaliar(suspenso).estado, "suspenso");
  const proibido = { ...aprovacao(), regraOficial: {
    ...aprovacao().regraOficial, permiteDivulgacao: false
  } };
  assert.equal(avaliar(proibido).estado, "nao-elegivel");
});

test("autorizacao, cadastro e homologacao nao podem ser presumidos", () => {
  assert.equal(avaliar({ ...aprovacao(), autorizadoPeloResponsavel: false }).codigo,
    "AUTORIZACAO_INCOMPLETA");
  assert.equal(avaliar({ ...aprovacao(), declaradoNoPrograma: false }).codigo,
    "AUTORIZACAO_INCOMPLETA");
  assert.equal(avaliar({ ...aprovacao(), homologacao: {
    ...aprovacao().homologacao, estado: "pendente"
  } }).codigo, "HOMOLOGACAO_PENDENTE");
  assert.equal(avaliar({ ...aprovacao(), regraOficial: {
    ...aprovacao().regraOficial, conflitoEsclarecido: false
  } }).codigo, "REGRA_INCONCLUSIVA");
});

test("fonte deve ser https oficial e verificacao recente", () => {
  for (const url of [
    "http://www.mercadolivre.com.br/l/checklist",
    "https://mercadolivre.com.br.evil.example/l/checklist",
    "https://example.com/",
    "https://usuario:senha@mercadolivre.com.br/l/checklist"
  ]) {
    const res = avaliar({ ...aprovacao(), regraOficial: {
      ...aprovacao().regraOficial, url
    } });
    assert.equal(res.codigo, "FONTE_OFICIAL_NAO_VALIDADA");
  }
  const vencido = { ...aprovacao(), regraOficial: {
    ...aprovacao().regraOficial, verificadaEm: "2026-09-01T10:00:00.000Z"
  } };
  assert.equal(avaliar(vencido).codigo, "HOMOLOGACAO_DESATUALIZADA");
  const futuro = { ...aprovacao(), homologacao: {
    ...aprovacao().homologacao, aprovadaEm: "2026-10-30T10:00:00.000Z"
  } };
  assert.equal(avaliar(futuro).codigo, "HOMOLOGACAO_DESATUALIZADA");
});

test("cadastro ausente ou invalido falha fechado", async () => {
  const dir = await mkdtemp(join(tmpdir(), "etapa57-regra-"));
  try {
    const arquivo = join(dir, "canais.json");
    const consulta = { grupo: nomeFicticio, plataforma: "Mercado Livre" };
    assert.equal((await consultarElegibilidadeCanalWhatsapp(consulta, arquivo)).codigo,
      "CANAL_NAO_HOMOLOGADO");
    await writeFile(arquivo, "{json-quebrado", "utf8");
    assert.equal((await consultarElegibilidadeCanalWhatsapp(consulta, arquivo)).codigo,
      "CADASTRO_CANAIS_INVALIDO");
    await writeFile(arquivo, JSON.stringify({ versao: 2, registros: [aprovacao()] }), "utf8");
    assert.equal((await consultarElegibilidadeCanalWhatsapp(consulta, arquivo)).podePublicar,
      false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("preparador nao abre Chrome nem apaga a mensagem em canal nao homologado", async () => {
  const dir = await mkdtemp(join(tmpdir(), "etapa57-sem-envio-"));
  try {
    await mkdir(join(dir, "data"));
    const mensagem = "TESTE ISOLADO: NAO ENVIAR";
    await writeFile(join(dir, "data", "ultima-mensagem-whatsapp.txt"), mensagem, "utf8");
    await writeFile(join(dir, "data", "ultima-oferta-whatsapp.json"), JSON.stringify({
      plataforma: "Amazon Brasil",
      produtoId: "B000000001",
      titulo: "Produto FICTICIO de teste",
      precoAtual: 19.9
    }), "utf8");
    const loader = pathToFileURL(join(root, "node_modules", "tsx", "dist", "loader.mjs")).href;
    const entry = join(root, "src", "robo", "whatsapp-preparar.ts");
    const child = spawnSync(process.execPath, ["--import", loader, entry], {
      cwd: dir, encoding: "utf8", timeout: 20_000,
      env: {
        ...process.env,
        WHATSAPP_GROUP_NAME: nomeFicticio,
        WHATSAPP_PREPARE_TEST: "false",
        WHATSAPP_BROWSER_CHANNEL: "__browser_inexistente__",
        WHATSAPP_AUTO_SEND_ENABLED: "true",
        NODE_ENV: "test"
      }
    });
    assert.equal(child.status, 8, child.stderr?.slice(0, 600));
    assert.match(child.stderr + child.stdout, /CANAL_NAO_HOMOLOGADO/);
    assert.doesNotMatch(child.stderr + child.stdout, /browser_inexistente/);
    assert.equal(await readFile(join(dir, "data", "ultima-mensagem-whatsapp.txt"), "utf8"), mensagem);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("codigo da ultima checagem precede o clique de envio", async () => {
  const entry = await readFile(join(root, "src", "robo", "whatsapp-preparar.ts"), "utf8");
  const lateGuard = entry.indexOf("process.exitCode = 8;");
  const click = entry.indexOf("await enviarOfertaNoWhatsapp(");
  assert.ok(lateGuard > 0 && click > lateGuard);
  assert.match(entry, /await rm\(enviarSignalPath, \{ force: true \}\)/);
});
