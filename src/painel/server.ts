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

const raiz = process.cwd();
const paginaPath = resolve(raiz, "src", "painel", "public", "index.html");
const mensagemPath = resolve(raiz, "data", "ultima-mensagem-whatsapp.txt");
const pacotePath = resolve(raiz, "data", "ultima-oferta-whatsapp.json");
const ofertaMercadoLivrePath = resolve(raiz, "data", "ultima-oferta-mercadolivre.json");
const perfilPath = resolve(raiz, "data", "whatsapp-profile");
const perfilMercadoLivrePath = resolve(raiz, "data", "mercadolivre-profile");
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
  | "searching"
  | "linking"
  | "preparing"
  | "waiting-send"
  | "error";

let mercadoLivreFluxoAutomatico = false;
let mercadoLivreFluxoEtapa: MercadoLivreFluxoEtapa = "idle";
let mercadoLivreFluxoMensagem = "";

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
  comissaoEstimadaPercentual?: number;
  scoreOferta?: number;
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
  registrar(nome, "Iniciado.");
  child.stdout?.on("data", (d) => registrar(nome, String(d)));
  child.stderr?.on("data", (d) => registrar(nome, String(d)));  child.on("error", (erro) => {
    registrar(nome, `Erro ao iniciar: ${erro.message}`);
    processos.delete(nome);
  });

  child.on("close", async (codigo) => {
    registrar(nome, `Finalizado com código ${codigo ?? "?"}.`);
    processos.delete(nome);
    aoFinal?.(codigo);

    if (nome !== "preparar") return;

    const origemFinalizada = origemPreparacaoAtual;
    const finalizacao = finalizacaoWhatsappAtual;
    const carregarProxima = carregarProximaAposEnvio;

    finalizacaoWhatsappAtual = null;
    carregarProximaAposEnvio = false;

    if (codigo !== 0) return;

    if (finalizacao === "cancelar") {
      await limparPreparacaoAtual(origemFinalizada);
      registrar("fluxo", "Preparação descartada. Painel liberado para uma nova oferta.");
      return;
    }

    if (finalizacao !== "enviar") return;

    ultimoEnvioConcluidoEm = Date.now();
    ultimoEnvioComProxima = carregarProxima;
    await limparPreparacaoAtual(origemFinalizada);

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
          origemPreparacaoAtual = "amazon";
          registrar("fluxo", "Próxima oferta pronta. Abrindo WhatsApp...");
          iniciar("preparar", "preparar");
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
        atualizarFluxoMercadoLivre(
          "waiting-send",
          "Oferta pronta. Abrindo WhatsApp para revisão e confirmação."
        );
        iniciar("preparar", "preparar");
      } else if (codigo !== 0) {
        atualizarFluxoMercadoLivre(
          "error",
          "Falha ao montar a oferta Mercado Livre para o WhatsApp."
        );
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

async function iniciarFluxoMercadoLivreAutomatico(): Promise<{
  ok: boolean;
  mensagem: string;
}> {
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

  mercadoLivreFluxoAutomatico = true;
  mercadoLivreLinkJob = null;
  atualizarFluxoMercadoLivre(
    "searching",
    "Buscando a próxima oferta elegível do Mercado Livre..."
  );

  const ok = iniciar(
    "mercadolivre-buscar",
    "mercadolivre-buscar",
    {},
    async (codigo) => {
      if (codigo !== 0) {
        mercadoLivreFluxoAutomatico = false;
        atualizarFluxoMercadoLivre(
          "error",
          "Nenhuma oferta Mercado Livre atingiu os filtros nesta rodada."
        );
        return;
      }

      try {
        await criarPedidoLinkMercadoLivre();
        atualizarFluxoMercadoLivre(
          "linking",
          "Oferta encontrada. Aguardando o Gerador de Links automático."
        );
      } catch (error) {
        mercadoLivreFluxoAutomatico = false;
        const mensagem = error instanceof Error ? error.message : String(error);
        atualizarFluxoMercadoLivre(
          "error",
          `Não foi possível iniciar a geração do link: ${mensagem}`
        );
      }
    }
  );

  if (!ok) {
    mercadoLivreFluxoAutomatico = false;
    atualizarFluxoMercadoLivre(
      "error",
      "A busca Mercado Livre já está em andamento."
    );
    return {
      ok: false,
      mensagem: "A busca Mercado Livre já está em andamento."
    };
  }

  return {
    ok: true,
    mensagem:
      "Fluxo Mercado Livre iniciado: buscar → gerar link → preparar WhatsApp."
  };
}

async function estado() {
  const mensagem = await readFile(mensagemPath, "utf8").catch(() => "");
  const pacote: PacotePainel = await readFile(pacotePath, "utf8")
    .then((texto) => JSON.parse(texto) as PacotePainel)
    .catch(() => ({}));
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
    origemPreparacaoAtual,
    plataformaAtual: pacote.plataforma ?? "",
    ultimoEnvioConcluidoEm,
    ultimoEnvioComProxima,
    descontoMinimo: Number(process.env.MIN_DISCOUNT_PERCENT ?? 20),
    consultas: process.env.AMAZON_QUERIES ?? process.env.AMAZON_QUERY ?? "ofertas",
    executando: [...processos.keys()],
    mensagem,
    imagemUrl: pacote.imagemUrl,
    categoriaAtual: pacote.categoria ?? "",
    comissaoAtual: pacote.comissaoEstimadaPercentual ?? 0,
    scoreAtual: pacote.scoreOferta ?? 0,
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
    origemPreparacaoAtual = (pacoteAtual.plataforma ?? "")
      .toLowerCase()
      .includes("mercado livre")
      ? "mercado-livre"
      : "amazon";

    const ok = iniciar("preparar", "preparar");
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
        "Envio Mercado Livre confirmado. O fluxo será encerrado após o envio."
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
    if (!processos.has("preparar")) {
      return { ok: false, mensagem: "Não há preparação do WhatsApp aberta." };
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
          atualizarFluxoMercadoLivre(
            "error",
            `Falha no Gerador de Links: ${erro}`
          );
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
          atualizarFluxoMercadoLivre(
            "error",
            `O link automático foi recusado: ${mensagem}`
          );
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
});
