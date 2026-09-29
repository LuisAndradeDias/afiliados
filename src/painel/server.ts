import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  cooldownHoras,
  contarBloqueadas,
  limparHistoricoOfertas,
  previewCooldownMinutos
} from "../ofertas/historico.js";

const raiz = process.cwd();
const paginaPath = resolve(raiz, "src", "painel", "public", "index.html");
const mensagemPath = resolve(raiz, "data", "ultima-mensagem-whatsapp.txt");
const pacotePath = resolve(raiz, "data", "ultima-oferta-whatsapp.json");
const perfilPath = resolve(raiz, "data", "whatsapp-profile");
const fecharWhatsappPath = resolve(raiz, "data", "fechar-whatsapp.signal");
const enviarWhatsappPath = resolve(raiz, "data", "enviar-whatsapp.signal");
const tsxCli = resolve(raiz, "node_modules", "tsx", "dist", "cli.mjs");
const porta = Number(process.env.PAINEL_PORT ?? 3030);

const processos = new Map<string, ChildProcess>();
const logs: string[] = [];
let carregarProximaAposEnvio = false;

function registrar(origem: string, texto: string): void {
  for (const linha of texto.split(/\r?\n/)) {
    if (!linha.trim()) continue;
    const horario = new Date().toLocaleTimeString("pt-BR");
    logs.push(`[${horario}] [${origem}] ${linha}`);
  }
  if (logs.length > 300) logs.splice(0, logs.length - 300);
}


function normalizarTagAmazon(valor: string): string {
  const recebido = valor.trim();
  if (!recebido) return "";

  try {
    const url = new URL(recebido);
    const tag = url.searchParams.get("tag");
    if (tag) return tag.trim();
  } catch {
    // O usuário informou somente a tag.
  }

  return recebido;
}

function validarTagAmazon(tag: string): boolean {
  return /^[A-Za-z0-9_-]{3,64}$/.test(tag);
}

async function salvarVariavelEnv(nome: string, valor: string): Promise<void> {
  const envPath = resolve(raiz, ".env");
  const atual = await readFile(envPath, "utf8").catch(() => "");
  const linhas = atual.split(/\r?\n/);
  const prefixo = `${nome}=`;
  const indice = linhas.findIndex((linha) => linha.startsWith(prefixo));
  const novaLinha = `${nome}=${valor}`;

  if (indice >= 0) {
    linhas[indice] = novaLinha;
  } else {
    linhas.push(novaLinha);
  }

  const conteudo = linhas.filter((linha, i, arr) =>
    linha.length > 0 || i < arr.length - 1
  ).join("\n");

  await writeFile(envPath, `${conteudo.trimEnd()}\n`, "utf8");
  process.env[nome] = valor;
}

interface PacotePainel {
  mensagem?: string;
  urlProduto?: string;
  urlAfiliado?: string;
  imagemUrl?: string;
}

async function atualizarOfertaAtualComTag(tag: string): Promise<void> {
  const pacote = await readFile(pacotePath, "utf8")
    .then((texto) => JSON.parse(texto) as PacotePainel)
    .catch(() => null);

  if (!pacote?.urlProduto) return;

  const url = new URL(pacote.urlProduto);
  if (tag) url.searchParams.set("tag", tag);
  else url.searchParams.delete("tag");

  const novoLink = tag ? url.toString() : pacote.urlProduto;
  const anterior = pacote.urlAfiliado || pacote.urlProduto;
  const mensagemAtual = pacote.mensagem || "";
  const novaMensagem = mensagemAtual.replace(anterior, novoLink);

  pacote.urlAfiliado = tag ? novoLink : undefined;
  pacote.mensagem = novaMensagem;

  await writeFile(pacotePath, JSON.stringify(pacote, null, 2), "utf8");
  if (novaMensagem) await writeFile(mensagemPath, novaMensagem, "utf8");
}

function arquivoDo(script: string): string {
  const mapa: Record<string, string> = {
    buscar: "src/robo/whatsapp-preview.ts",
    login: "src/robo/whatsapp-login.ts",
    preparar: "src/robo/whatsapp-preparar.ts",    automatico: "src/robo/automatico.ts"
  };
  const arquivo = mapa[script];
  if (!arquivo) throw new Error(`Ação desconhecida: ${script}`);
  return arquivo;
}

function iniciar(
  nome: string,
  script: string,
  envExtra: Record<string, string> = {},
  aoFinal?: (codigo: number | null) => void
): boolean {
  if (processos.has(nome)) return false;

  const child = spawn(
    process.execPath,
    [tsxCli, arquivoDo(script)],
    {
      cwd: raiz,
      env: { ...process.env, ...envExtra },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  processos.set(nome, child);
  registrar(nome, "Iniciado.");
  child.stdout?.on("data", (d) => registrar(nome, String(d)));
  child.stderr?.on("data", (d) => registrar(nome, String(d)));  child.on("error", (erro) => {
    registrar(nome, `Erro ao iniciar: ${erro.message}`);
    processos.delete(nome);
  });

  child.on("close", (codigo) => {
    registrar(nome, `Finalizado com código ${codigo ?? "?"}.`);
    processos.delete(nome);
    aoFinal?.(codigo);

    if (nome === "preparar" && carregarProximaAposEnvio) {
      carregarProximaAposEnvio = false;

      if (codigo === 0) {
        registrar("fluxo", "Envio concluído. Buscando a próxima oferta...");
        iniciar("buscar", "buscar", {}, (codigoBusca) => {
          if (codigoBusca === 0 && !whatsappOcupado()) {
            registrar("fluxo", "Próxima oferta pronta. Abrindo WhatsApp...");
            iniciar("preparar", "preparar");
          }
        });
      }
    }
  });

  return true;
}

function whatsappOcupado(): boolean {
  return processos.has("login") || processos.has("preparar");
}

async function existe(path: string): Promise<boolean> {
  return stat(path).then(() => true).catch(() => false);
}

async function estado() {
  const mensagem = await readFile(mensagemPath, "utf8").catch(() => "");
  const pacote = await readFile(pacotePath, "utf8")
    .then((texto) =>
      JSON.parse(texto) as {
        imagemUrl?: string;
        urlProduto?: string;
        urlAfiliado?: string;
      }
    )
    .catch(() => ({
      imagemUrl: undefined as string | undefined,
      urlProduto: undefined as string | undefined,
      urlAfiliado: undefined as string | undefined
    }));

  return {
    grupo: process.env.WHATSAPP_GROUP_NAME || "Não configurado",
    afiliadoConfigurado: Boolean(process.env.AMAZON_ASSOCIATE_TAG?.trim()),
    afiliadoTag: process.env.AMAZON_ASSOCIATE_TAG?.trim() ?? "",
    linkAfiliadoAtual: pacote.urlAfiliado ?? "",
    sessaoWhatsapp: await existe(perfilPath),
    descontoMinimo: Number(process.env.MIN_DISCOUNT_PERCENT ?? 20),
    consultas: process.env.AMAZON_QUERIES ?? process.env.AMAZON_QUERY ?? "ofertas",
    executando: [...processos.keys()],
    mensagem,
    imagemUrl: pacote.imagemUrl,
    cooldownHoras: cooldownHoras(),
    previewCooldownMinutos: previewCooldownMinutos(),
    ofertasBloqueadas: await contarBloqueadas(),
    logs
  };
}
function json(res: import("node:http").ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

async function lerJson(req: import("node:http").IncomingMessage) {
  let corpo = "";
  for await (const parte of req) corpo += String(parte);
  return corpo ? JSON.parse(corpo) : {};
}

async function executarAcao(
  acao: string,
  dados: Record<string, unknown> = {}
): Promise<{ ok: boolean; mensagem: string }> {
  if (acao === "afiliado-save") {
    const tag = normalizarTagAmazon(String(dados.tag ?? ""));

    if (!tag) {
      await salvarVariavelEnv("AMAZON_ASSOCIATE_TAG", "");
      await atualizarOfertaAtualComTag("");
      registrar("painel", "ID de associado Amazon removido.");
      return { ok: true, mensagem: "ID de associado removido." };
    }

    if (!validarTagAmazon(tag)) {
      return {
        ok: false,
        mensagem:
          "ID inválido. Cole somente o Tracking ID da Amazon ou um link de associado que contenha ?tag=."
      };
    }

    await salvarVariavelEnv("AMAZON_ASSOCIATE_TAG", tag);
    await atualizarOfertaAtualComTag(tag);
    registrar("painel", `ID de associado Amazon configurado: ${tag}`);
    return {
      ok: true,
      mensagem: `Amazon vinculada com o ID ${tag}. As próximas ofertas usarão seu link de associado.`
    };
  }

  if (acao === "buscar") {
    const ok = iniciar("buscar", "buscar");
    return { ok, mensagem: ok ? "Busca iniciada." : "Já existe uma busca em andamento." };
  }

  if (acao === "preparar") {
    if (processos.has("preparar")) {
      return {
        ok: false,
        mensagem:
          "Já existe uma oferta aberta no WhatsApp. Use Enviar e carregar próxima ou Descartar oferta aberta."
      };
    }

    if (processos.has("login")) {
      return {
        ok: false,
        mensagem: "Feche a janela de login do WhatsApp antes de preparar a oferta."
      };
    }

    const ok = iniciar("preparar", "preparar");
    return { ok, mensagem: ok ? "Preparando oferta no WhatsApp." : "A tarefa já está em andamento." };
  }

  if (acao === "login") {
    if (whatsappOcupado()) {
      return {
        ok: false,
        mensagem: "O WhatsApp já está aberto pelo projeto. Finalize a janela atual primeiro."
      };
    }

    const ok = iniciar("login", "login");
    return { ok, mensagem: ok ? "Login do WhatsApp aberto." : "A tarefa já está em andamento." };
  }

  if (acao === "fluxo") {
    if (processos.has("automatico")) {
      return {
        ok: false,
        mensagem: "Pare o monitoramento antes de iniciar a fila de envio."
      };
    }

    if (processos.has("buscar") || whatsappOcupado()) {
      return { ok: false, mensagem: "Aguarde a tarefa atual terminar." };
    }    iniciar("buscar", "buscar", {}, (codigo) => {
      if (codigo === 0 && !whatsappOcupado()) {
        registrar("fluxo", "Oferta gerada. Abrindo WhatsApp para revisão.");
        iniciar("preparar", "preparar");
      } else {
        registrar("fluxo", "Fluxo interrompido: não houve oferta pronta ou o WhatsApp está ocupado.");
      }
    });
    return { ok: true, mensagem: "Fluxo iniciado." };
  }

  if (acao === "automatico-start") {
    if (processos.has("buscar") || whatsappOcupado()) {
      return {
        ok: false,
        mensagem: "Finalize a busca/preparação atual antes de iniciar o monitoramento."
      };
    }

    const ok = iniciar("automatico", "automatico", { RUN_ONCE: "false" });
    return { ok, mensagem: ok ? "Monitoramento iniciado." : "Monitoramento já está ativo." };
  }

  if (acao === "automatico-stop") {
    const child = processos.get("automatico");
    if (!child) return { ok: false, mensagem: "O monitoramento não está ativo." };
    child.kill();
    registrar("automatico", "Parada solicitada pelo painel.");
    return { ok: true, mensagem: "Parando monitoramento." };
  }

  if (acao === "preparar-send" || acao === "preparar-send-next") {
    if (!processos.has("preparar")) {
      return { ok: false, mensagem: "Não há oferta pronta para enviar." };
    }

    carregarProximaAposEnvio = acao === "preparar-send-next";
    writeFileSync(enviarWhatsappPath, "enviar", "utf8");
    registrar(
      "preparar",
      carregarProximaAposEnvio
        ? "Envio confirmado. A próxima oferta será carregada automaticamente."
        : "Envio confirmado pelo painel."
    );
    return {
      ok: true,
      mensagem: carregarProximaAposEnvio
        ? "Enviando e preparando a próxima oferta..."
        : "Enviando a oferta no WhatsApp..."
    };
  }

  if (acao === "preparar-cancel") {
    carregarProximaAposEnvio = false;

    if (!processos.has("preparar")) {
      return { ok: false, mensagem: "Não há preparação do WhatsApp aberta." };
    }

    writeFileSync(fecharWhatsappPath, "fechar", "utf8");
    registrar("preparar", "Preparação cancelada sem registrar a oferta.");
    return { ok: true, mensagem: "Preparação cancelada. A oferta poderá aparecer novamente." };
  }

  if (acao === "historico-clear") {
    await limparHistoricoOfertas();
    registrar("painel", "Histórico de repetição limpo.");
    return { ok: true, mensagem: "Histórico de ofertas enviadas foi limpo." };
  }

  if (acao === "limpar-logs") {
    logs.splice(0, logs.length);
    return { ok: true, mensagem: "Logs limpos." };
  }

  return { ok: false, mensagem: "Ação desconhecida." };
}
const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      const html = await readFile(paginaPath, "utf8");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "GET" && req.url === "/api/status") {
      json(res, 200, await estado());
      return;
    }

    if (req.method === "POST" && req.url === "/api/action") {
      const corpo = await lerJson(req);
      const resultado = await executarAcao(
        String(corpo.action ?? ""),
        corpo as Record<string, unknown>
      );
      json(res, resultado.ok ? 200 : 409, resultado);
      return;
    }

    json(res, 404, { ok: false, mensagem: "Rota não encontrada." });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : String(error);
    registrar("painel", `Erro: ${mensagem}`);
    json(res, 500, { ok: false, mensagem });
  }
});

server.listen(porta, "127.0.0.1", () => {
  registrar("painel", `Painel disponível em http://localhost:${porta}`);
  console.log(`Painel disponível em http://localhost:${porta}`);
});
