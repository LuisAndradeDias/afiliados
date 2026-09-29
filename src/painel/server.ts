import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const raiz = process.cwd();
const paginaPath = resolve(raiz, "src", "painel", "public", "index.html");
const mensagemPath = resolve(raiz, "data", "ultima-mensagem-whatsapp.txt");
const pacotePath = resolve(raiz, "data", "ultima-oferta-whatsapp.json");
const perfilPath = resolve(raiz, "data", "whatsapp-profile");
const tsxCli = resolve(raiz, "node_modules", "tsx", "dist", "cli.mjs");
const porta = Number(process.env.PAINEL_PORT ?? 3030);

const processos = new Map<string, ChildProcess>();
const logs: string[] = [];

function registrar(origem: string, texto: string): void {
  for (const linha of texto.split(/\r?\n/)) {
    if (!linha.trim()) continue;
    const horario = new Date().toLocaleTimeString("pt-BR");
    logs.push(`[${horario}] [${origem}] ${linha}`);
  }
  if (logs.length > 300) logs.splice(0, logs.length - 300);
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
    .then((texto) => JSON.parse(texto) as { imagemUrl?: string })
    .catch(() => ({ imagemUrl: undefined as string | undefined }));

  return {
    grupo: process.env.WHATSAPP_GROUP_NAME || "Não configurado",
    afiliadoConfigurado: Boolean(process.env.AMAZON_ASSOCIATE_TAG?.trim()),
    sessaoWhatsapp: await existe(perfilPath),
    descontoMinimo: Number(process.env.MIN_DISCOUNT_PERCENT ?? 20),
    consultas: process.env.AMAZON_QUERIES ?? process.env.AMAZON_QUERY ?? "ofertas",
    executando: [...processos.keys()],
    mensagem,
    imagemUrl: pacote.imagemUrl,
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

function executarAcao(acao: string): { ok: boolean; mensagem: string } {
  if (acao === "buscar") {
    const ok = iniciar("buscar", "buscar");
    return { ok, mensagem: ok ? "Busca iniciada." : "Já existe uma busca em andamento." };
  }

  if (acao === "login" || acao === "preparar") {
    if (whatsappOcupado()) {
      return { ok: false, mensagem: "O WhatsApp já está sendo usado por outra tarefa." };
    }
    const ok = iniciar(acao, acao);
    return { ok, mensagem: ok ? "WhatsApp aberto." : "A tarefa já está em andamento." };
  }

  if (acao === "fluxo") {
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
      const resultado = executarAcao(String(corpo.action ?? ""));
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
