import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  cooldownHoras,
  contarBloqueadas,
  limparHistoricoOfertas,
  previewCooldownMinutos
} from "../ofertas/historico.js";
import {
  lerOfertaMercadoLivre,
  salvarLinkAfiliadoMercadoLivre
} from "../afiliados/mercadolivre.js";
import {
  registrarCuponsObservadosMercadoLivre,
  statusCuponsMercadoLivre
} from "../afiliados/mercadolivre-cupons.js";

const raiz = process.cwd();
const paginaPath = resolve(raiz, "src", "painel", "public", "index.html");
const mensagemPath = resolve(raiz, "data", "ultima-mensagem-whatsapp.txt");
const pacotePath = resolve(raiz, "data", "ultima-oferta-whatsapp.json");
const ofertaMercadoLivrePath = resolve(raiz, "data", "ultima-oferta-mercadolivre.json");
const perfilPath = resolve(raiz, "data", "whatsapp-profile");
const perfilMercadoLivrePath = resolve(raiz, "data", "mercadolivre-profile");
const instagramDirPath = resolve(
  raiz,
  process.env.INSTAGRAM_DATA_DIR?.trim() || "data/instagram"
);
const instagramAvaliacaoPath = resolve(
  instagramDirPath,
  "ultima-avaliacao.json"
);
const instagramPacotePath = resolve(
  instagramDirPath,
  "ultimo-pacote.json"
);
const fecharWhatsappPath = resolve(raiz, "data", "fechar-whatsapp.signal");
const enviarWhatsappPath = resolve(raiz, "data", "enviar-whatsapp.signal");
const tsxCli = resolve(raiz, "node_modules", "tsx", "dist", "cli.mjs");
const porta = Number(process.env.PAINEL_PORT ?? 3030);

const processos = new Map<string, ChildProcess>();
const logs: string[] = [];
let carregarProximaAposEnvio = false;
let finalizacaoWhatsappAtual: "enviar" | "cancelar" | null = null;
let ultimoEnvioConcluidoEm = 0;
let ultimoEnvioComProxima = false;
let mercadoLivreOauthState = "";
let origemPreparacaoAtual: "amazon" | "mercado-livre" = "amazon";
let origemPreparacaoEmExecucao: "amazon" | "mercado-livre" | null = null;
let whatsappRevisaoPronta = false;
let whatsappAutoEnvioEmAndamento = false;
let whatsappPreparacaoIniciadaEm = 0;

type MercadoLivreLinkJobStatus =
  | "pending"
  | "running"
  | "done"
  | "error";

interface MercadoLivreLinkJob {
  id: string;
  produtoId: string;
  urlProduto: string;
  criadoEm: string;
  status: MercadoLivreLinkJobStatus;
  mensagem?: string;
}

let mercadoLivreLinkJob: MercadoLivreLinkJob | null = null;
let mercadoLivreExtensionLastSeen = 0;

type MercadoLivreFluxoEtapa =
  | "idle"
  | "monitoring"
  | "searching"
  | "linking"
  | "preparing"
  | "waiting-send"
  | "error";

let mercadoLivreFluxoAutomatico = false;
let mercadoLivreFluxoEtapa: MercadoLivreFluxoEtapa = "idle";
let mercadoLivreFluxoMensagem = "";

type PlataformaMonitor = "mercado-livre" | "amazon";

let monitorAlternadoAtivo =
  process.env.ALTERNATING_MONITOR_ENABLED === "true" ||
  process.env.MERCADOLIVRE_MONITOR_ENABLED === "true";
let mercadoLivreMonitorAtivo = monitorAlternadoAtivo;
let monitorAlternadoTimer: ReturnType<typeof setTimeout> | null = null;
let mercadoLivreMonitorProximaBuscaEm = 0;
let monitorAlternadoProximaPlataforma: PlataformaMonitor = "mercado-livre";
let monitorAlternadoUltimaPlataforma: PlataformaMonitor | null = null;
let monitorAlternadoUltimoTurnoEm = 0;
let mercadoLivreMonitorUltimaBuscaEm = 0;
let amazonMonitorUltimaBuscaEm = 0;
let mercadoLivreBuscaLimitada = false;
let mercadoLivreBloqueadoAte = 0;

function monitorAlternadoSlotMs(): number {
  const segundos = Number(
    process.env.ALTERNATING_MONITOR_SLOT_SECONDS ?? 60
  );
  return Math.max(30, Number.isFinite(segundos) ? segundos : 60) * 1_000;
}

function mercadoLivreMonitorIntervaloMs(): number {
  return monitorAlternadoSlotMs() * 2;
}

function mercadoLivreMonitorBackoffMs(): number {
  const minutos = Number(
    process.env.MERCADOLIVRE_MONITOR_BACKOFF_MINUTES ?? 8
  );
  return Math.max(2, Number.isFinite(minutos) ? minutos : 8) * 60_000;
}

function cancelarAgendamentoMonitorAlternado(): void {
  if (monitorAlternadoTimer) {
    clearTimeout(monitorAlternadoTimer);
    monitorAlternadoTimer = null;
  }
  mercadoLivreMonitorProximaBuscaEm = 0;
}

function nomePlataformaMonitor(plataforma: PlataformaMonitor): string {
  return plataforma === "mercado-livre" ? "Mercado Livre" : "Amazon";
}

function plataformaDoValor(valor?: string): PlataformaMonitor | null {
  const normalizado = (valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalizado.includes("mercado livre")) return "mercado-livre";
  if (normalizado.includes("amazon")) return "amazon";
  return null;
}

async function plataformaDaOfertaAtual(): Promise<PlataformaMonitor | null> {
  const pacote = await readFile(pacotePath, "utf8")
    .then((texto) => JSON.parse(texto) as { plataforma?: string })
    .catch(() => null);

  return plataformaDoValor(pacote?.plataforma);
}

function outraPlataformaMonitor(
  plataforma: PlataformaMonitor
): PlataformaMonitor {
  return plataforma === "mercado-livre" ? "amazon" : "mercado-livre";
}

function monitorTemTarefaAtiva(): boolean {
  return (
    whatsappOcupado() ||
    processos.has("buscar") ||
    processos.has("mercadolivre-buscar") ||
    processos.has("mercadolivre-whatsapp") ||
    processos.has("automatico") ||
    mercadoLivreFluxoAutomatico
  );
}

function agendarMonitorAlternado(
  plataforma: PlataformaMonitor,
  atrasoMs: number,
  mensagem: string
): void {
  cancelarAgendamentoMonitorAlternado();
  if (!monitorAlternadoAtivo) return;

  const atraso = Math.max(500, atrasoMs);
  monitorAlternadoProximaPlataforma = plataforma;
  mercadoLivreMonitorProximaBuscaEm = Date.now() + atraso;

  atualizarFluxoMercadoLivre("monitoring", mensagem);

  monitorAlternadoTimer = setTimeout(() => {
    monitorAlternadoTimer = null;
    mercadoLivreMonitorProximaBuscaEm = 0;
    void executarTurnoMonitorAlternado(plataforma);
  }, atraso);
}

function agendarProximoTurnoAposRodada(
  plataforma: PlataformaMonitor,
  mensagem: string
): void {
  const alvo = monitorAlternadoUltimoTurnoEm + monitorAlternadoSlotMs();
  const atraso = Math.max(500, alvo - Date.now());
  agendarMonitorAlternado(plataforma, atraso, mensagem);
}

async function executarTurnoMonitorAlternado(
  plataforma: PlataformaMonitor
): Promise<void> {
  if (!monitorAlternadoAtivo) return;

  if (monitorTemTarefaAtiva()) {
    agendarMonitorAlternado(
      plataforma,
      10_000,
      `Ciclo intercalado pausado por uma tarefa ativa. ${nomePlataformaMonitor(plataforma)} continua como próxima consulta.`
    );
    return;
  }

  const agora = Date.now();
  monitorAlternadoUltimoTurnoEm = agora;
  monitorAlternadoUltimaPlataforma = plataforma;
  monitorAlternadoProximaPlataforma = outraPlataformaMonitor(plataforma);

  if (plataforma === "mercado-livre") {
    mercadoLivreMonitorUltimaBuscaEm = agora;

    if (mercadoLivreBloqueadoAte > agora) {
      const minutos = Math.max(
        1,
        Math.ceil((mercadoLivreBloqueadoAte - agora) / 60_000)
      );
      registrar(
        "monitor",
        `Turno Mercado Livre pulado por backoff da API (${minutos} min restantes).`
      );
      agendarProximoTurnoAposRodada(
        "amazon",
        "Mercado Livre em backoff. Amazon será consultada no próximo minuto."
      );
      return;
    }

    const resultado = await iniciarFluxoMercadoLivreAutomatico(true);
    if (!resultado.ok && monitorAlternadoAtivo) {
      agendarProximoTurnoAposRodada(
        "amazon",
        "Turno Mercado Livre não iniciou. Amazon será consultada no próximo minuto."
      );
    }
    return;
  }

  amazonMonitorUltimaBuscaEm = agora;
  const resultado = iniciarFluxoAmazonMonitor();
  if (!resultado.ok && monitorAlternadoAtivo) {
    agendarProximoTurnoAposRodada(
      "mercado-livre",
      "Turno Amazon não iniciou. Mercado Livre será consultado no próximo minuto."
    );
  }
}

async function definirMonitorMercadoLivreAtivo(
  ativo: boolean
): Promise<void> {
  monitorAlternadoAtivo = ativo;
  mercadoLivreMonitorAtivo = ativo;

  await salvarVariavelEnv(
    "ALTERNATING_MONITOR_ENABLED",
    ativo ? "true" : "false"
  );
  await salvarVariavelEnv(
    "MERCADOLIVRE_MONITOR_ENABLED",
    ativo ? "true" : "false"
  );

  if (!ativo) {
    cancelarAgendamentoMonitorAlternado();
    if (!monitorTemTarefaAtiva()) {
      mercadoLivreFluxoAutomatico = false;
      atualizarFluxoMercadoLivre(
        "idle",
        "Monitoramento intercalado Amazon + Mercado Livre pausado."
      );
    }
  }
}

function atualizarFluxoMercadoLivre(
  etapa: MercadoLivreFluxoEtapa,
  mensagem: string
): void {
  mercadoLivreFluxoEtapa = etapa;
  mercadoLivreFluxoMensagem = mensagem;
  registrar("mercadolivre-fluxo", mensagem);
}

function mercadoLivreExtensionConectada(): boolean {
  return Date.now() - mercadoLivreExtensionLastSeen < 75_000;
}

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

function redirectMercadoLivre(): string {
  return process.env.MERCADOLIVRE_REDIRECT_URI?.trim() ?? "";
}

function redirectMercadoLivreValido(): boolean {
  const valor = redirectMercadoLivre();
  if (!valor) return false;

  try {
    const url = new URL(valor);
    return (
      url.protocol === "https:" &&
      url.pathname === "/oauth/mercadolivre/callback"
    );
  } catch {
    return false;
  }
}

function appMercadoLivreConfigurada(): boolean {
  return Boolean(
    process.env.MERCADOLIVRE_CLIENT_ID?.trim() &&
      process.env.MERCADOLIVRE_CLIENT_SECRET?.trim()
  );
}

function urlAutorizacaoMercadoLivre(): string {
  const clientId = process.env.MERCADOLIVRE_CLIENT_ID?.trim();
  if (!clientId || !appMercadoLivreConfigurada()) {
    throw new Error("Configure o App ID e a Secret Key do Mercado Livre primeiro.");
  }
  if (!redirectMercadoLivreValido()) {
    throw new Error(
      "Configure um Redirect URI HTTPS válido terminando em /oauth/mercadolivre/callback."
    );
  }

  mercadoLivreOauthState = randomBytes(24).toString("hex");
  const url = new URL("https://auth.mercadolivre.com.br/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectMercadoLivre());
  url.searchParams.set("state", mercadoLivreOauthState);
  return url.toString();
}

interface TokenMercadoLivre {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number;
}

async function trocarCodigoMercadoLivre(code: string): Promise<TokenMercadoLivre> {
  const clientId = process.env.MERCADOLIVRE_CLIENT_ID?.trim();
  const clientSecret = process.env.MERCADOLIVRE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Credenciais do aplicativo Mercado Livre não configuradas.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectMercadoLivre()
  });

  const resposta = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });

  const texto = await resposta.text();
  if (!resposta.ok) {
    throw new Error(`Mercado Livre OAuth HTTP ${resposta.status}: ${texto.slice(0, 300)}`);
  }

  return JSON.parse(texto) as TokenMercadoLivre;
}

async function salvarTokenMercadoLivre(token: TokenMercadoLivre): Promise<void> {
  await salvarVariavelEnv("MERCADOLIVRE_ACCESS_TOKEN", token.access_token);
  if (token.refresh_token) {
    await salvarVariavelEnv("MERCADOLIVRE_REFRESH_TOKEN", token.refresh_token);
  }
  if (token.user_id !== undefined) {
    await salvarVariavelEnv("MERCADOLIVRE_USER_ID", String(token.user_id));
  }
  if (token.expires_in) {
    await salvarVariavelEnv(
      "MERCADOLIVRE_TOKEN_EXPIRES_AT",
      String(Date.now() + token.expires_in * 1000)
    );
  }
}

interface PacotePainel {
  plataforma?: string;
  mensagem?: string;
  urlProduto?: string;
  urlAfiliado?: string;
  imagemUrl?: string;
  categoria?: string;
  descontoPercentual?: number;
  comissaoEstimadaPercentual?: number;
  scoreOferta?: number;
  cupomCodigo?: string;
  cupomPercentual?: number;
  cupomValor?: number;
  cupomCompraMinima?: number;
  cupomDescontoMaximo?: number;
  precoComCupomEstimado?: number;
  descontoEfetivoPercentual?: number;
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
    preparar: "src/robo/whatsapp-preparar.ts",
    "mercadolivre-login": "src/robo/mercadolivre-login.ts",
    "mercadolivre-buscar": "src/robo/mercadolivre-preview.ts",
    "mercadolivre-whatsapp": "src/robo/mercadolivre-whatsapp.ts",
    automatico: "src/robo/automatico.ts"
  };
  const arquivo = mapa[script];
  if (!arquivo) throw new Error(`Ação desconhecida: ${script}`);
  return arquivo;
}

async function limparPreparacaoAtual(
  origem: "amazon" | "mercado-livre"
): Promise<void> {
  const caminhos = [
    mensagemPath,
    pacotePath,
    resolve(raiz, "data", "ultima-imagem-whatsapp.jpg"),
    resolve(raiz, "data", "ultima-imagem-whatsapp.png"),
    resolve(raiz, "data", "ultima-imagem-whatsapp.gif")
  ];

  if (origem === "mercado-livre") {
    caminhos.push(ofertaMercadoLivrePath);
    mercadoLivreLinkJob = null;
    mercadoLivreFluxoAutomatico = false;
    mercadoLivreFluxoEtapa = "idle";
    mercadoLivreFluxoMensagem = "";
  }

  await Promise.all(
    caminhos.map((caminho) => rm(caminho, { force: true }).catch(() => undefined))
  );
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

  if (nome === "preparar") {
    whatsappRevisaoPronta = false;
    whatsappAutoEnvioEmAndamento = false;
    whatsappPreparacaoIniciadaEm = Date.now();
  }

  registrar(nome, "Iniciado.");
  child.stdout?.on("data", (d) => {
    const texto = String(d);
    registrar(nome, texto);

    if (
      nome === "mercadolivre-buscar" &&
      (texto.includes("limite de requisicoes") || texto.includes("HTTP 429"))
    ) {
      mercadoLivreBuscaLimitada = true;
    }

    if (
      nome === "preparar" &&
      (
        texto.includes("Oferta pronta para envio pelo painel.") ||
        texto.includes("Aguardando sua confirmação no painel ou o envio direto no WhatsApp.")
      )
    ) {
      whatsappRevisaoPronta = true;
      const plataforma =
        origemPreparacaoEmExecucao ?? origemPreparacaoAtual;

      atualizarFluxoMercadoLivre(
        "waiting-send",
        `Oferta ${nomePlataformaMonitor(plataforma)} pronta no WhatsApp. Aguardando sua confirmação.`
      );
    }

    if (
      nome === "preparar" &&
      texto.includes("AUTO_ENVIO_INICIADO:")
    ) {
      whatsappAutoEnvioEmAndamento = true;
      const plataforma =
        origemPreparacaoEmExecucao ?? origemPreparacaoAtual;
      atualizarFluxoMercadoLivre(
        "waiting-send",
        `Enviando oferta ${nomePlataformaMonitor(plataforma)} e aguardando confirmação real do WhatsApp.`
      );
      registrar(
        "painel",
        "Autoenvio iniciado. Aguardando confirmação real do WhatsApp."
      );
    }

    if (
      nome === "preparar" &&
      (
        texto.includes("ENVIO_CONFIRMADO_MANUAL:") ||
        texto.includes("ENVIO_CONFIRMADO_AUTO:")
      )
    ) {
      whatsappAutoEnvioEmAndamento = false;
      finalizacaoWhatsappAtual = "enviar";
      carregarProximaAposEnvio = false;
      registrar(
        "painel",
        texto.includes("ENVIO_CONFIRMADO_AUTO:")
          ? "Envio automático confirmado pelo WhatsApp. Finalizando a oferta e retomando o ciclo."
          : "Envio feito diretamente no WhatsApp detectado. Finalizando a oferta e retomando o ciclo."
      );
    }

    if (nome === "preparar" && texto.includes("ENVIO_NAO_CONFIRMADO:")) {
      whatsappAutoEnvioEmAndamento = false;
      finalizacaoWhatsappAtual = null;
      carregarProximaAposEnvio = false;
      registrar(
        "painel",
        "O WhatsApp não confirmou o envio. Os botões foram liberados para tentar novamente."
      );
    }
  });
  child.stderr?.on("data", (d) => {
    const texto = String(d);
    registrar(nome, texto);

    if (
      nome === "mercadolivre-buscar" &&
      (texto.includes("limite de requisicoes") || texto.includes("HTTP 429"))
    ) {
      mercadoLivreBuscaLimitada = true;
    }

    if (nome === "preparar" && texto.includes("ENVIO_NAO_CONFIRMADO:")) {
      whatsappAutoEnvioEmAndamento = false;
      finalizacaoWhatsappAtual = null;
      carregarProximaAposEnvio = false;
      registrar(
        "painel",
        "O WhatsApp não confirmou o envio. Os botões foram liberados para tentar novamente."
      );
    }
  });
  child.on("error", (erro) => {
    registrar(nome, `Erro ao iniciar: ${erro.message}`);
    processos.delete(nome);
  });

  child.on("close", async (codigo) => {
    registrar(nome, `Finalizado com código ${codigo ?? "?"}.`);
    processos.delete(nome);
    aoFinal?.(codigo);

    if (nome !== "preparar") return;

    const origemFinalizada =
      origemPreparacaoEmExecucao ?? origemPreparacaoAtual;
    const finalizacao = finalizacaoWhatsappAtual;
    const carregarProxima = carregarProximaAposEnvio;
    const revisaoEstavaPronta = whatsappRevisaoPronta;

    origemPreparacaoEmExecucao = null;
    whatsappRevisaoPronta = false;
    whatsappAutoEnvioEmAndamento = false;
    whatsappPreparacaoIniciadaEm = 0;
    finalizacaoWhatsappAtual = null;
    carregarProximaAposEnvio = false;

    if (codigo !== 0) {
      mercadoLivreFluxoAutomatico = false;

      const detalhe = revisaoEstavaPronta
        ? "A janela do WhatsApp foi fechada antes da confirmação."
        : "O WhatsApp não terminou de abrir/preparar a oferta.";

      atualizarFluxoMercadoLivre(
        "idle",
        `${detalhe} A oferta foi mantida no painel. Use Reabrir no WhatsApp ou Descartar oferta.`
      );
      registrar(
        "fluxo",
        `${detalhe} A oferta preparada foi preservada para evitar perda ou envio duplicado.`
      );
      return;
    }

    if (finalizacao === "cancelar") {
      await limparPreparacaoAtual(origemFinalizada);
      registrar("fluxo", "Preparação descartada. Painel liberado para uma nova oferta.");

      if (monitorAlternadoAtivo) {
        const proxima: PlataformaMonitor =
          origemFinalizada === "mercado-livre"
            ? "amazon"
            : "mercado-livre";
        agendarMonitorAlternado(
          proxima,
          5_000,
          `Oferta descartada. Retomando o ciclo por ${nomePlataformaMonitor(proxima)}.`
        );
      }
      return;
    }

    if (finalizacao !== "enviar") return;

    ultimoEnvioConcluidoEm = Date.now();
    ultimoEnvioComProxima =
      carregarProxima || monitorAlternadoAtivo;
    await limparPreparacaoAtual(origemFinalizada);

    if (monitorAlternadoAtivo) {
      const proxima: PlataformaMonitor =
        origemFinalizada === "mercado-livre"
          ? "amazon"
          : "mercado-livre";

      registrar(
        "fluxo",
        `Envio concluído. Retomando o monitoramento intercalado por ${nomePlataformaMonitor(proxima)}.`
      );
      agendarMonitorAlternado(
        proxima,
        5_000,
        `Envio concluído. ${nomePlataformaMonitor(proxima)} será consultada em instantes.`
      );
      return;
    }

    if (!carregarProxima) {
      registrar(
        "fluxo",
        "Envio concluído. Painel liberado para preparar outra promoção."
      );
      return;
    }

    if (origemFinalizada === "amazon") {
      registrar("fluxo", "Envio concluído. Buscando a próxima oferta Amazon...");
      iniciar("buscar", "buscar", {}, (codigoBusca) => {
        if (codigoBusca === 0 && !whatsappOcupado()) {
          registrar("fluxo", "Próxima oferta pronta. Abrindo WhatsApp...");
          iniciarPreparacaoWhatsapp("amazon");
        }
      });
    } else {
      atualizarFluxoMercadoLivre(
        "idle",
        "Oferta Mercado Livre enviada. Iniciando a próxima automaticamente..."
      );
      void iniciarFluxoMercadoLivreAutomatico();
    }
  });

  return true;
}

function whatsappOcupado(): boolean {
  return processos.has("login") || processos.has("preparar");
}

function iniciarPreparacaoWhatsapp(
  origem: PlataformaMonitor
): boolean {
  if (processos.has("preparar")) return false;

  origemPreparacaoAtual = origem;
  origemPreparacaoEmExecucao = origem;
  whatsappRevisaoPronta = false;
  whatsappPreparacaoIniciadaEm = Date.now();

  atualizarFluxoMercadoLivre(
    "preparing",
    `Oferta ${nomePlataformaMonitor(origem)} encontrada. Abrindo e preparando o WhatsApp...`
  );

  const ok = iniciar("preparar", "preparar");
  if (!ok) {
    origemPreparacaoEmExecucao = null;
    whatsappPreparacaoIniciadaEm = 0;
  }
  return ok;
}


function iniciarFluxoAmazonMonitor(): {
  ok: boolean;
  mensagem: string;
} {
  if (!monitorAlternadoAtivo) {
    return {
      ok: false,
      mensagem: "O monitoramento intercalado está pausado."
    };
  }

  if (!process.env.AMAZON_ASSOCIATE_TAG?.trim()) {
    registrar(
      "monitor-amazon",
      "Amazon pulada: Tracking ID não configurado."
    );
    agendarProximoTurnoAposRodada(
      "mercado-livre",
      "Amazon sem Tracking ID. Mercado Livre será consultado no próximo minuto."
    );
    return {
      ok: false,
      mensagem: "Configure o Tracking ID da Amazon."
    };
  }

  if (processos.has("buscar") || whatsappOcupado()) {
    return {
      ok: false,
      mensagem: "Amazon aguardando a tarefa atual terminar."
    };
  }

  origemPreparacaoAtual = "amazon";
  atualizarFluxoMercadoLivre(
    "searching",
    "Monitoramento intercalado: buscando a próxima oferta Amazon..."
  );
  registrar(
    "monitor-amazon",
    "Turno Amazon iniciado pelo monitoramento intercalado."
  );

  const ok = iniciar(
    "buscar",
    "buscar",
    {},
    (codigo) => {
      if (codigo === 0 && !whatsappOcupado()) {
        registrar(
          "monitor-amazon",
          "Oferta Amazon encontrada. Pausando o ciclo para revisão no WhatsApp."
        );
        const abriu = iniciarPreparacaoWhatsapp("amazon");

        if (!abriu) {
          agendarProximoTurnoAposRodada(
            "mercado-livre",
            "Não foi possível abrir a revisão Amazon. Mercado Livre será consultado no próximo minuto."
          );
        }
        return;
      }

      registrar(
        "monitor-amazon",
        codigo === 2
          ? "Nenhuma oferta Amazon passou pelos filtros nesta rodada."
          : `Rodada Amazon terminou com código ${codigo ?? "?"}.`
      );
      agendarProximoTurnoAposRodada(
        "mercado-livre",
        "Rodada Amazon concluída. Mercado Livre será consultado no próximo minuto."
      );
    }
  );

  return {
    ok,
    mensagem: ok
      ? "Busca Amazon iniciada pelo ciclo intercalado."
      : "Já existe uma busca Amazon em andamento."
  };
}

async function existe(path: string): Promise<boolean> {
  return stat(path).then(() => true).catch(() => false);
}

async function criarPedidoLinkMercadoLivre(): Promise<MercadoLivreLinkJob> {
  const oferta = await lerOfertaMercadoLivre();

  mercadoLivreLinkJob = {
    id: randomBytes(12).toString("hex"),
    produtoId: oferta.produtoId,
    urlProduto: oferta.urlProduto,
    criadoEm: new Date().toISOString(),
    status: "pending"
  };

  registrar(
    "mercadolivre-link",
    `Pedido automático criado para ${oferta.produtoId}. Aguardando extensão do navegador.`
  );

  return mercadoLivreLinkJob;
}

async function prepararMercadoLivreAutomaticamente(): Promise<boolean> {
  if (whatsappOcupado() || processos.has("mercadolivre-whatsapp")) {
    atualizarFluxoMercadoLivre(
      "error",
      "Fluxo ML pausado: o WhatsApp ou a preparação já está ocupado."
    );
    return false;
  }

  const oferta = await lerOfertaMercadoLivre();
  if (!oferta.urlAfiliado) {
    atualizarFluxoMercadoLivre(
      "error",
      "Fluxo ML interrompido: o link oficial não foi salvo."
    );
    return false;
  }

  origemPreparacaoAtual = "mercado-livre";
  atualizarFluxoMercadoLivre(
    "preparing",
    "Link oficial salvo. Gerando mensagem e pacote do Mercado Livre..."
  );

  const ok = iniciar(
    "mercadolivre-whatsapp",
    "mercadolivre-whatsapp",
    {},
    (codigo) => {
      if (codigo === 0 && !whatsappOcupado()) {
        iniciarPreparacaoWhatsapp("mercado-livre");
      } else if (codigo !== 0) {
        mercadoLivreFluxoAutomatico = false;

        if (monitorAlternadoAtivo) {
          agendarProximoTurnoAposRodada(
            "amazon",
            "Falha ao montar a oferta Mercado Livre. Amazon será consultada no próximo minuto."
          );
        } else {
          atualizarFluxoMercadoLivre(
            "error",
            "Falha ao montar a oferta Mercado Livre para o WhatsApp."
          );
        }
      }
    }
  );

  if (!ok) {
    atualizarFluxoMercadoLivre(
      "error",
      "A preparação Mercado Livre já está em andamento."
    );
  }

  return ok;
}

async function iniciarFluxoMercadoLivreAutomatico(
  modoMonitor = false
): Promise<{
  ok: boolean;
  mensagem: string;
}> {
  if (modoMonitor && !monitorAlternadoAtivo) {
    return {
      ok: false,
      mensagem: "O monitoramento intercalado Amazon + Mercado Livre está pausado."
    };
  }

  if (!process.env.MERCADOLIVRE_ACCESS_TOKEN?.trim()) {
    return {
      ok: false,
      mensagem: "Conecte a API do Mercado Livre antes de iniciar o fluxo."
    };
  }

  if (processos.has("mercadolivre-buscar") || processos.has("mercadolivre-whatsapp")) {
    return {
      ok: false,
      mensagem: "Já existe uma tarefa Mercado Livre em andamento."
    };
  }

  if (whatsappOcupado()) {
    return {
      ok: false,
      mensagem: "Finalize a oferta aberta no WhatsApp antes de iniciar outra."
    };
  }

  cancelarAgendamentoMonitorAlternado();
  mercadoLivreBuscaLimitada = false;
  mercadoLivreMonitorUltimaBuscaEm = Date.now();
  mercadoLivreFluxoAutomatico = true;
  mercadoLivreLinkJob = null;
  atualizarFluxoMercadoLivre(
    "searching",
    modoMonitor
      ? "Monitoramento ativo: consultando a próxima categoria do Mercado Livre..."
      : "Buscando a próxima oferta elegível do Mercado Livre..."
  );

  const ok = iniciar(
    "mercadolivre-buscar",
    "mercadolivre-buscar",
    {},
    async (codigo) => {
      if (codigo !== 0) {
        mercadoLivreFluxoAutomatico = false;

        if (codigo === 3) {
          if (monitorAlternadoAtivo) {
            await definirMonitorMercadoLivreAtivo(false);
          }
          atualizarFluxoMercadoLivre(
            "error",
            "Mercado Livre precisa de nova autorização. Clique em Conectar Mercado Livre. Ciclo pausado para evitar consultas inválidas; a oferta já aberta foi preservada."
          );
          return;
        }

        if (modoMonitor && monitorAlternadoAtivo) {
          const limitado = mercadoLivreBuscaLimitada;

          if (limitado) {
            mercadoLivreBloqueadoAte =
              Date.now() + mercadoLivreMonitorBackoffMs();
          }

          agendarProximoTurnoAposRodada(
            "amazon",
            limitado
              ? "Mercado Livre entrou em backoff por limite da API. Amazon será consultada no próximo minuto."
              : codigo === 2
                ? "Nenhuma oferta Mercado Livre passou pelos filtros. Amazon será consultada no próximo minuto."
                : "Falha na consulta ao Mercado Livre; consulte os logs. Amazon será consultada no próximo minuto."
          );
          return;
        }

        atualizarFluxoMercadoLivre(
          "error",
          codigo === 2
            ? "Nenhuma oferta Mercado Livre atingiu os filtros nesta rodada."
            : "Erro ao consultar o Mercado Livre. Verifique os logs e a autenticação."
        );
        return;
      }

      try {
        await criarPedidoLinkMercadoLivre();
        atualizarFluxoMercadoLivre(
          "linking",
          "Oferta encontrada. Gerando o link oficial automaticamente..."
        );
      } catch (error) {
        mercadoLivreFluxoAutomatico = false;
        const mensagem = error instanceof Error ? error.message : String(error);

        if (modoMonitor && monitorAlternadoAtivo) {
          agendarProximoTurnoAposRodada(
            "amazon",
            `Falha ao iniciar o link automático: ${mensagem}. Amazon será consultada no próximo minuto.`
          );
          return;
        }

        atualizarFluxoMercadoLivre(
          "error",
          `Não foi possível iniciar a geração do link: ${mensagem}`
        );
      }
    }
  );

  if (!ok) {
    mercadoLivreFluxoAutomatico = false;

    if (modoMonitor && monitorAlternadoAtivo) {
      agendarProximoTurnoAposRodada(
        "amazon",
        "A busca Mercado Livre estava ocupada. Amazon será consultada no próximo minuto."
      );
    } else {
      atualizarFluxoMercadoLivre(
        "error",
        "A busca Mercado Livre já está em andamento."
      );
    }

    return {
      ok: false,
      mensagem: "A busca Mercado Livre já está em andamento."
    };
  }

  return {
    ok: true,
    mensagem: modoMonitor
      ? "Monitoramento consultando o Mercado Livre."
      : "Fluxo Mercado Livre iniciado: buscar → gerar link → preparar WhatsApp."
  };
}

async function estado() {
  const mensagem = await readFile(mensagemPath, "utf8").catch(() => "");
  const statusCupons = await statusCuponsMercadoLivre();
  const pacote: PacotePainel = await readFile(pacotePath, "utf8")
    .then((texto) => JSON.parse(texto) as PacotePainel)
    .catch(() => ({}));
  const instagramAvaliacao = await readFile(
    instagramAvaliacaoPath,
    "utf8"
  )
    .then((texto) => JSON.parse(texto))
    .catch(() => null);
  const instagramConteudo = await readFile(
    instagramPacotePath,
    "utf8"
  )
    .then((texto) => JSON.parse(texto))
    .catch(() => null);
  const ofertaMercadoLivre = await readFile(
    ofertaMercadoLivrePath,
    "utf8"
  )
    .then((texto) => JSON.parse(texto) as {
      titulo?: string;
      precoAtual?: number;
      precoAnterior?: number;
      descontoPercentual?: number;
      imagem?: string;
      urlProduto?: string;
      urlAfiliado?: string;
      categoria?: string;
    })
    .catch(() => ({}));

  const plataformaPacoteAtual = plataformaDoValor(pacote.plataforma);
  const ofertaPreparada = Boolean(mensagem.trim() && plataformaPacoteAtual);
  const whatsappEmExecucao = processos.has("preparar");
  const operacaoPlataforma: PlataformaMonitor | null =
    whatsappEmExecucao || finalizacaoWhatsappAtual
      ? (
          plataformaPacoteAtual ??
          origemPreparacaoEmExecucao ??
          origemPreparacaoAtual
        )
      : processos.has("buscar")
        ? "amazon"
        : (
            processos.has("mercadolivre-buscar") ||
            processos.has("mercadolivre-whatsapp") ||
            mercadoLivreLinkJob?.status === "pending" ||
            mercadoLivreLinkJob?.status === "running"
          )
          ? "mercado-livre"
          : null;

  const operacaoEstado =
    finalizacaoWhatsappAtual === "enviar" ||
    whatsappAutoEnvioEmAndamento
      ? "sending"
      : whatsappEmExecucao && whatsappRevisaoPronta
        ? "review"
        : whatsappEmExecucao
          ? "preparing"
          : processos.has("mercadolivre-whatsapp")
            ? "preparing"
            : (
                mercadoLivreLinkJob?.status === "pending" ||
                mercadoLivreLinkJob?.status === "running"
              )
              ? "linking"
              : processos.has("buscar") || processos.has("mercadolivre-buscar")
                ? "searching"
                : ofertaPreparada
                  ? "offer-pending"
                  : mercadoLivreFluxoEtapa === "error"
                    ? "error"
                    : monitorAlternadoAtivo
                      ? "scheduled"
                      : "paused";

  return {
    grupo: process.env.WHATSAPP_GROUP_NAME || "Não configurado",
    afiliadoConfigurado: Boolean(process.env.AMAZON_ASSOCIATE_TAG?.trim()),
    afiliadoTag: process.env.AMAZON_ASSOCIATE_TAG?.trim() ?? "",
    linkAfiliadoAtual: pacote.urlAfiliado ?? "",
    sessaoWhatsapp: await existe(perfilPath),
    sessaoMercadoLivre: await existe(perfilMercadoLivrePath),
    mercadoLivreAppConfigurada: appMercadoLivreConfigurada(),
    mercadoLivreRedirectConfigurado: redirectMercadoLivreValido(),
    mercadoLivreOauthPronto:
      appMercadoLivreConfigurada() && redirectMercadoLivreValido(),
    mercadoLivreApiConfigurada: Boolean(process.env.MERCADOLIVRE_ACCESS_TOKEN?.trim()),
    mercadoLivreUserId: process.env.MERCADOLIVRE_USER_ID?.trim() ?? "",
    mercadoLivreClientId: process.env.MERCADOLIVRE_CLIENT_ID?.trim() ?? "",
    mercadoLivreRedirectUri: redirectMercadoLivre(),
    mercadoLivreOferta: ofertaMercadoLivre,
    mercadoLivreExtensionConectada: mercadoLivreExtensionConectada(),
    mercadoLivreLinkJob,
    mercadoLivreFluxoAutomatico,
    mercadoLivreFluxoEtapa,
    mercadoLivreFluxoMensagem,
    mercadoLivreMonitorAtivo,
    monitorAlternadoAtivo,
    monitorAlternadoProximaPlataforma,
    monitorAlternadoUltimaPlataforma,
    monitorAlternadoProximaBuscaEm: mercadoLivreMonitorProximaBuscaEm,
    monitorAlternadoSlotSegundos: monitorAlternadoSlotMs() / 1_000,
    mercadoLivreMonitorProximaBuscaEm,
    mercadoLivreMonitorUltimaBuscaEm,
    amazonMonitorUltimaBuscaEm,
    mercadoLivreMonitorIntervaloMinutos:
      mercadoLivreMonitorIntervaloMs() / 60_000,
    amazonMonitorIntervaloMinutos:
      (monitorAlternadoSlotMs() * 2) / 60_000,
    mercadoLivreMonitorBackoffMinutos:
      mercadoLivreMonitorBackoffMs() / 60_000,
    origemPreparacaoAtual,
    origemPreparacaoEmExecucao,
    plataformaAtual: pacote.plataforma ?? "",
    ofertaPlataformaAtual: plataformaPacoteAtual,
    ofertaPreparada,
    whatsappRevisaoPronta:
      whatsappEmExecucao && whatsappRevisaoPronta,
    whatsappPreparacaoIniciadaEm,
    operacaoEstado,
    operacaoPlataforma,
    ultimoEnvioConcluidoEm,
    ultimoEnvioComProxima,
    whatsappEnvioPendente:
      finalizacaoWhatsappAtual === "enviar" ||
      whatsappAutoEnvioEmAndamento,
    descontoMinimo: Number(process.env.MIN_DISCOUNT_PERCENT ?? 20),
    consultas: process.env.AMAZON_QUERIES ?? process.env.AMAZON_QUERY ?? "ofertas",
    executando: [...processos.keys()],
    mensagem,
    imagemUrl: pacote.imagemUrl,
    categoriaAtual: pacote.categoria ?? "",
    comissaoAtual: pacote.comissaoEstimadaPercentual ?? 0,
    scoreAtual: pacote.scoreOferta ?? 0,
    cupomAtual: pacote.cupomCodigo ?? "",
    cupomPercentualAtual: pacote.cupomPercentual ?? 0,
    cupomValorAtual: pacote.cupomValor ?? 0,
    precoComCupomEstimado: pacote.precoComCupomEstimado ?? 0,
    descontoEfetivoAtual:
      pacote.descontoEfetivoPercentual ??
      pacote.descontoPercentual ??
      0,
    mercadoLivreCuponsTotal: statusCupons.total,
    mercadoLivreCuponsAtivos: statusCupons.ativos,
    mercadoLivreCuponsAtualizadosEm: statusCupons.coletadoEm ?? "",
    cooldownHoras: cooldownHoras(),
    previewCooldownMinutos: previewCooldownMinutos(),
    ofertasBloqueadas: await contarBloqueadas(),
    instagramAvaliacao,
    instagramConteudo,
    instagramMinimoDesconto: Number(
      process.env.INSTAGRAM_MIN_DISCOUNT_PERCENT ?? 35
    ),
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

async function servirImagemInstagram(
  tipo: "story" | "reel",
  res: import("node:http").ServerResponse
): Promise<void> {
  const pacote = await readFile(
    instagramPacotePath,
    "utf8"
  )
    .then((texto) => JSON.parse(texto) as {
      storyArquivo?: string;
      reelCapaArquivo?: string;
    })
    .catch(() => null);

  const relativo =
    tipo === "story"
      ? pacote?.storyArquivo
      : pacote?.reelCapaArquivo;

  if (!relativo) {
    res.writeHead(404, {
      "content-type": "text/plain; charset=utf-8"
    });
    res.end("Imagem Instagram ainda não disponível.");
    return;
  }

  const caminho = resolve(raiz, relativo);
  if (!caminho.startsWith(instagramDirPath)) {
    res.writeHead(403, {
      "content-type": "text/plain; charset=utf-8"
    });
    res.end("Caminho de imagem inválido.");
    return;
  }

  const bytes = await readFile(caminho).catch(
    () => null
  );
  if (!bytes) {
    res.writeHead(404, {
      "content-type": "text/plain; charset=utf-8"
    });
    res.end("Imagem Instagram não encontrada.");
    return;
  }

  res.writeHead(200, {
    "content-type": "image/jpeg",
    "cache-control": "no-store"
  });
  res.end(bytes);
}

async function executarAcao(
  acao: string,
  dados: Record<string, unknown> = {}
): Promise<{ ok: boolean; mensagem: string }> {
  if (acao === "mercadolivre-config-save") {
    const clientId = String(dados.clientId ?? "").trim();
    const clientSecret = String(dados.clientSecret ?? "").trim();

    if (!clientId) {
      return { ok: false, mensagem: "Informe o App ID do Mercado Livre." };
    }

    await salvarVariavelEnv("MERCADOLIVRE_CLIENT_ID", clientId);
    if (clientSecret) {
      await salvarVariavelEnv("MERCADOLIVRE_CLIENT_SECRET", clientSecret);
    }
    registrar("painel", "Credenciais do aplicativo Mercado Livre salvas localmente.");
    return {
      ok: true,
      mensagem: appMercadoLivreConfigurada()
        ? "Aplicativo Mercado Livre configurado. Agora clique em Autorizar conta."
        : "App ID salvo. Informe também a Secret Key para autorizar."
    };
  }

  if (acao === "mercadolivre-redirect-save") {
    const valor = String(dados.redirectUri ?? "").trim();

    if (!valor) {
      return {
        ok: false,
        mensagem:
          "Informe o Redirect URI HTTPS cadastrado no DevCenter do Mercado Livre."
      };
    }

    let url: URL;
    try {
      url = new URL(valor);
    } catch {
      return { ok: false, mensagem: "O Redirect URI informado não é uma URL válida." };
    }

    if (
      url.protocol !== "https:" ||
      url.pathname !== "/oauth/mercadolivre/callback"
    ) {
      return {
        ok: false,
        mensagem:
          "Use uma URL HTTPS que termine exatamente em /oauth/mercadolivre/callback."
      };
    }

    url.hash = "";
    const redirect = url.toString();
    await salvarVariavelEnv("MERCADOLIVRE_REDIRECT_URI", redirect);
    registrar("painel", "Redirect URI HTTPS do Mercado Livre salvo localmente.");

    return {
      ok: true,
      mensagem:
        "Redirect URI salvo. Confirme que esta mesma URL está cadastrada no DevCenter e depois clique em Autorizar OAuth."
    };
  }

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

  if (
    acao === "monitor-set" ||
    acao === "mercadolivre-monitor-toggle"
  ) {
    const desejado =
      acao === "monitor-set"
        ? Boolean(dados.ativo)
        : !monitorAlternadoAtivo;

    if (!desejado) {
      if (!monitorAlternadoAtivo) {
        return {
          ok: true,
          mensagem: "O ciclo Amazon + Mercado Livre já está pausado."
        };
      }

      await definirMonitorMercadoLivreAtivo(false);
      return {
        ok: true,
        mensagem: "Ciclo Amazon + Mercado Livre pausado. A oferta já aberta, se houver, continua disponível para revisão."
      };
    }

    if (!process.env.MERCADOLIVRE_ACCESS_TOKEN?.trim()) {
      return {
        ok: false,
        mensagem: "Conecte a API do Mercado Livre antes de ativar o ciclo."
      };
    }

    if (!process.env.AMAZON_ASSOCIATE_TAG?.trim()) {
      return {
        ok: false,
        mensagem: "Configure o Tracking ID da Amazon antes de ativar o ciclo."
      };
    }

    if (!monitorAlternadoAtivo) {
      await definirMonitorMercadoLivreAtivo(true);
    }

    const temOfertaPendente =
      await existe(mensagemPath) &&
      await existe(pacotePath);

    if (monitorTemTarefaAtiva() || temOfertaPendente) {
      return {
        ok: true,
        mensagem: temOfertaPendente
          ? "Ciclo automático ativo, mas há uma oferta pendente. Reabra ou descarte essa oferta antes da próxima busca."
          : "Ciclo automático ativo. A busca ficará pausada enquanto a oferta atual estiver sendo preparada ou revisada."
      };
    }

    cancelarAgendamentoMonitorAlternado();
    agendarMonitorAlternado(
      monitorAlternadoProximaPlataforma || "mercado-livre",
      750,
      "Ciclo automático ativo. Iniciando a próxima consulta."
    );

    return {
      ok: true,
      mensagem:
        "Ciclo Amazon + Mercado Livre ativo: as plataformas serão consultadas alternadamente a cada minuto."
    };
  }

  if (acao === "mercadolivre-fluxo") {
    return iniciarFluxoMercadoLivreAutomatico();
  }

  if (acao === "mercadolivre-buscar") {
    mercadoLivreFluxoAutomatico = false;
    atualizarFluxoMercadoLivre(
      "idle",
      "Busca manual do Mercado Livre iniciada."
    );

    const ok = iniciar(
      "mercadolivre-buscar",
      "mercadolivre-buscar"
    );
    return {
      ok,
      mensagem: ok
        ? "Busca de ofertas do Mercado Livre iniciada."
        : "Já existe uma busca do Mercado Livre em andamento."
    };
  }

  if (acao === "mercadolivre-link-auto") {
    mercadoLivreFluxoAutomatico = false;

    try {
      await criarPedidoLinkMercadoLivre();
      atualizarFluxoMercadoLivre(
        "linking",
        "Pedido manual de link criado. Aguardando o Gerador de Links automático."
      );

      return {
        ok: true,
        mensagem: mercadoLivreExtensionConectada()
          ? "Gerador automático iniciado. A nova guia do Mercado Livre fará o restante."
          : "Pedido criado. Instale/ative a extensão Meli no navegador para concluir automaticamente."
      };
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      return { ok: false, mensagem };
    }
  }

  if (acao === "mercadolivre-link-save") {
    const link = String(dados.link ?? "").trim();

    try {
      const oferta = await salvarLinkAfiliadoMercadoLivre(link);
      registrar(
        "mercadolivre",
        `Link oficial salvo para ${oferta.produtoId}.`
      );
      return {
        ok: true,
        mensagem: "Link oficial salvo. A oferta já pode ser preparada no WhatsApp."
      };
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      return { ok: false, mensagem };
    }
  }

  if (acao === "mercadolivre-preparar") {
    mercadoLivreFluxoAutomatico = false;

    try {
      const ok = await prepararMercadoLivreAutomaticamente();
      return {
        ok,
        mensagem: ok
          ? "Preparando oferta do Mercado Livre para o WhatsApp."
          : "Não foi possível iniciar a preparação do Mercado Livre."
      };
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : String(error);
      return { ok: false, mensagem };
    }
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

    const pacoteAtual = await readFile(pacotePath, "utf8")
      .then((texto) => JSON.parse(texto) as { plataforma?: string })
      .catch(() => ({} as { plataforma?: string }));
    const origem =
      plataformaDoValor(pacoteAtual.plataforma) ?? "amazon";

    const ok = iniciarPreparacaoWhatsapp(origem);
    return { ok, mensagem: ok ? "Preparando oferta no WhatsApp." : "A tarefa já está em andamento." };
  }

  if (acao === "mercadolivre-login") {
    const ok = iniciar("mercadolivre-login", "mercadolivre-login");
    return {
      ok,
      mensagem: ok
        ? "Mercado Livre aberto. Entre na sua conta e acesse Afiliados e Criadores."
        : "A sessão do Mercado Livre já está aberta."
    };
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
    }

    origemPreparacaoAtual = "amazon";
    iniciar("buscar", "buscar", {}, (codigo) => {
      if (codigo === 0 && !whatsappOcupado()) {
        registrar("fluxo", "Oferta gerada. Abrindo WhatsApp para revisão.");
        iniciarPreparacaoWhatsapp("amazon");
      } else {
        registrar("fluxo", "Fluxo interrompido: não houve oferta pronta ou o WhatsApp está ocupado.");
      }
    });
    return { ok: true, mensagem: "Fluxo iniciado." };
  }

  if (acao === "automatico-start") {
    if (monitorAlternadoAtivo) {
      return {
        ok: false,
        mensagem:
          "O monitoramento intercalado Amazon + Mercado Livre já está ativo. Pause-o antes de usar o monitor legado da Amazon."
      };
    }

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
    const origemPacote = await plataformaDaOfertaAtual();
    if (origemPacote) {
      origemPreparacaoAtual = origemPacote;
      if (processos.has("preparar")) {
        origemPreparacaoEmExecucao = origemPacote;
      }
    }

    if (finalizacaoWhatsappAtual === "enviar") {
      return {
        ok: false,
        mensagem: "O comando de envio já foi enviado. Aguardando confirmação do WhatsApp."
      };
    }

    if (!processos.has("preparar")) {
      return { ok: false, mensagem: "Não há oferta pronta para enviar." };
    }

    if (
      acao === "preparar-send-next" &&
      origemPreparacaoAtual === "mercado-livre" &&
      !mercadoLivreExtensionConectada()
    ) {
      return {
        ok: false,
        mensagem:
          "A extensão Meli precisa estar conectada para carregar a próxima oferta automaticamente."
      };
    }

    carregarProximaAposEnvio = acao === "preparar-send-next";
    finalizacaoWhatsappAtual = "enviar";
    if (
      origemPreparacaoAtual === "mercado-livre" &&
      acao === "preparar-send"
    ) {
      mercadoLivreFluxoAutomatico = false;
      atualizarFluxoMercadoLivre(
        "idle",
        monitorAlternadoAtivo
          ? "Envio confirmado. O ciclo Amazon + Mercado Livre será retomado após o WhatsApp confirmar o envio."
          : "Envio Mercado Livre confirmado. O fluxo será encerrado após o envio."
      );
    }

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
    const origemPacote = await plataformaDaOfertaAtual();
    if (origemPacote) {
      origemPreparacaoAtual = origemPacote;
      if (processos.has("preparar")) {
        origemPreparacaoEmExecucao = origemPacote;
      }
    }

    if (!processos.has("preparar")) {
      if (!origemPacote) {
        return { ok: false, mensagem: "Não há oferta preparada para descartar." };
      }

      await limparPreparacaoAtual(origemPacote);

      if (monitorAlternadoAtivo) {
        const proxima = outraPlataformaMonitor(origemPacote);
        agendarMonitorAlternado(
          proxima,
          2_000,
          `Oferta pendente descartada. Retomando o ciclo por ${nomePlataformaMonitor(proxima)}.`
        );
      }

      registrar(
        "painel",
        "Oferta preparada sem janela ativa do WhatsApp foi descartada."
      );
      return {
        ok: true,
        mensagem: "Oferta descartada. O ciclo automático foi liberado."
      };
    }

    carregarProximaAposEnvio = false;
    finalizacaoWhatsappAtual = "cancelar";

    if (origemPreparacaoAtual === "mercado-livre") {
      mercadoLivreFluxoAutomatico = false;
      atualizarFluxoMercadoLivre(
        "idle",
        "Preparação Mercado Livre descartada pelo usuário."
      );
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
    const requestUrl = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "GET" && requestUrl.pathname === "/mercadolivre/connect") {
      const destino = urlAutorizacaoMercadoLivre();
      res.writeHead(302, { location: destino });
      res.end();
      return;
    }

    if (
      req.method === "GET" &&
      requestUrl.pathname === "/oauth/mercadolivre/callback"
    ) {
      const code = requestUrl.searchParams.get("code");
      const state = requestUrl.searchParams.get("state");

      if (!code || !state || state !== mercadoLivreOauthState) {
        throw new Error("Retorno OAuth do Mercado Livre inválido ou expirado.");
      }

      const token = await trocarCodigoMercadoLivre(code);
      await salvarTokenMercadoLivre(token);
      mercadoLivreOauthState = "";
      registrar(
        "mercadolivre",
        `Conta autorizada via OAuth${token.user_id ? ` (usuário ${token.user_id})` : ""}.`
      );

      res.writeHead(302, { location: "/?mercadolivre=conectado" });
      res.end();
      return;
    }

    if (
      req.method === "POST" &&
      requestUrl.pathname === "/webhooks/mercadolivre"
    ) {
      let corpo = "";
      for await (const parte of req) corpo += String(parte);
      registrar(
        "mercadolivre-webhook",
        corpo ? `Notificação recebida: ${corpo.slice(0, 500)}` : "Notificação recebida."
      );
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (
      req.method === "GET" &&
      requestUrl.pathname === "/api/instagram/story"
    ) {
      await servirImagemInstagram("story", res);
      return;
    }

    if (
      req.method === "GET" &&
      requestUrl.pathname === "/api/instagram/reel-capa"
    ) {
      await servirImagemInstagram("reel", res);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/") {
      const html = await readFile(paginaPath, "utf8");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (
      req.method === "POST" &&
      requestUrl.pathname === "/api/mercadolivre/extension-ping"
    ) {
      mercadoLivreExtensionLastSeen = Date.now();
      json(res, 200, { ok: true });
      return;
    }

    if (
      req.method === "POST" &&
      requestUrl.pathname === "/api/mercadolivre/coupons-observed"
    ) {
      mercadoLivreExtensionLastSeen = Date.now();
      const corpo = await lerJson(req);
      const origem = String(corpo.url ?? "").slice(0, 500);
      const blocos = Array.isArray(corpo.blocks)
        ? corpo.blocks
            .filter((item: unknown): item is string => typeof item === "string")
            .map((item: string) => item.slice(0, 4_000))
            .slice(0, 100)
        : [];

      const quantidade = await registrarCuponsObservadosMercadoLivre(
        blocos,
        origem || "mercadolivre-browser"
      );

      if (quantidade > 0) {
        registrar(
          "mercadolivre-cupons",
          `Extensão observou ${quantidade} cupom(ns) no navegador.`
        );
      }

      json(res, 200, { ok: true, quantidade });
      return;
    }

    if (
      req.method === "GET" &&
      requestUrl.pathname === "/api/mercadolivre/link-job"
    ) {
      mercadoLivreExtensionLastSeen = Date.now();
      json(res, 200, {
        ok: true,
        job:
          mercadoLivreLinkJob &&
          (mercadoLivreLinkJob.status === "pending" ||
            mercadoLivreLinkJob.status === "running")
            ? mercadoLivreLinkJob
            : null
      });
      return;
    }

    if (
      req.method === "POST" &&
      requestUrl.pathname === "/api/mercadolivre/link-job/start"
    ) {
      mercadoLivreExtensionLastSeen = Date.now();
      const corpo = await lerJson(req);
      const id = String(corpo.id ?? "");

      if (!mercadoLivreLinkJob || mercadoLivreLinkJob.id !== id) {
        json(res, 409, {
          ok: false,
          mensagem: "Pedido de link expirado ou substituído."
        });
        return;
      }

      mercadoLivreLinkJob = {
        ...mercadoLivreLinkJob,
        status: "running",
        mensagem: "Gerador de Links aberto pela extensão."
      };
      registrar(
        "mercadolivre-link",
        `Extensão iniciou o pedido ${id}.`
      );
      json(res, 200, { ok: true, job: mercadoLivreLinkJob });
      return;
    }

    if (
      req.method === "POST" &&
      requestUrl.pathname === "/api/mercadolivre/link-result"
    ) {
      mercadoLivreExtensionLastSeen = Date.now();
      const corpo = await lerJson(req);
      const id = String(corpo.id ?? "");
      const link = String(corpo.link ?? "").trim();
      const erro = String(corpo.error ?? "").trim();

      if (!mercadoLivreLinkJob || mercadoLivreLinkJob.id !== id) {
        json(res, 409, {
          ok: false,
          mensagem: "Pedido de link expirado ou substituído."
        });
        return;
      }

      if (erro) {
        mercadoLivreLinkJob = {
          ...mercadoLivreLinkJob,
          status: "error",
          mensagem: erro
        };
        if (mercadoLivreFluxoAutomatico) {
          mercadoLivreFluxoAutomatico = false;

          if (monitorAlternadoAtivo) {
            agendarProximoTurnoAposRodada(
              "amazon",
              `Gerador de Links falhou: ${erro}. Amazon será consultada no próximo minuto.`
            );
          } else {
            atualizarFluxoMercadoLivre(
              "error",
              `Falha no Gerador de Links: ${erro}`
            );
          }
        }
        registrar("mercadolivre-link", `Falha automática: ${erro}`);
        json(res, 200, { ok: true });
        return;
      }

      try {
        const oferta = await salvarLinkAfiliadoMercadoLivre(link);
        mercadoLivreLinkJob = {
          ...mercadoLivreLinkJob,
          status: "done",
          mensagem: "Link oficial gerado e salvo."
        };
        registrar(
          "mercadolivre-link",
          `Link automático salvo para ${oferta.produtoId}.`
        );

        if (mercadoLivreFluxoAutomatico) {
          atualizarFluxoMercadoLivre(
            "preparing",
            "Link oficial gerado. Preparando a oferta para o WhatsApp..."
          );

          void prepararMercadoLivreAutomaticamente().catch((error) => {
            mercadoLivreFluxoAutomatico = false;
            const mensagem =
              error instanceof Error ? error.message : String(error);
            atualizarFluxoMercadoLivre(
              "error",
              `Falha após gerar o link: ${mensagem}`
            );
          });
        }

        json(res, 200, {
          ok: true,
          mensagem: mercadoLivreFluxoAutomatico
            ? "Link oficial salvo. Preparação do WhatsApp iniciada."
            : "Link oficial gerado e salvo no painel."
        });
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : String(error);
        mercadoLivreLinkJob = {
          ...mercadoLivreLinkJob,
          status: "error",
          mensagem
        };
        if (mercadoLivreFluxoAutomatico) {
          mercadoLivreFluxoAutomatico = false;

          if (monitorAlternadoAtivo) {
            agendarProximoTurnoAposRodada(
              "amazon",
              `O link automático foi recusado: ${mensagem}. Amazon será consultada no próximo minuto.`
            );
          } else {
            atualizarFluxoMercadoLivre(
              "error",
              `O link automático foi recusado: ${mensagem}`
            );
          }
        }
        registrar(
          "mercadolivre-link",
          `Link devolvido pela extensão foi recusado: ${mensagem}`
        );
        json(res, 409, { ok: false, mensagem });
      }
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/status") {
      json(res, 200, await estado());
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/action") {
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

  if (monitorAlternadoAtivo) {
    void (async () => {
      const temOfertaPendente =
        await existe(mensagemPath) &&
        await existe(pacotePath);

      if (temOfertaPendente) {
        atualizarFluxoMercadoLivre(
          "idle",
          "Existe uma oferta preparada de uma execução anterior. Reabra ou descarte essa oferta antes de continuar o ciclo."
        );
        return;
      }

      agendarMonitorAlternado(
        "mercado-livre",
        1_500,
        "Ciclo automático restaurado. Mercado Livre inicia e Amazon entra no minuto seguinte."
      );
    })();
  }
});
