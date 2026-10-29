import "dotenv/config";
import { resolve } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import { detectarEstadoVisualWhatsapp } from "./whatsapp-conexao.js";

const modoTeste = process.env.WHATSAPP_LOGIN_TEST === "true";
const profileDir = resolve("data", modoTeste ? "whatsapp-profile-test" : "whatsapp-profile");
const canal = process.env.WHATSAPP_BROWSER_CHANNEL ?? "chrome";

/** Os marcadores nao contêm URLs, QR, dados pessoais nem credenciais. */
function informar(estado: string): void {
  console.log("WHATSAPP_CONEXAO:" + estado);
}

function codigoFalha(error: unknown): string {
  const mensagem = error instanceof Error ? error.message : String(error);
  if (/singleton|profile.*(in use|lock)|user.data.directory.*in use/i.test(mensagem)) {
    return "PERFIL_OCUPADO";
  }
  if (/target.*(closed|crashed)|browser.*(closed|disconnected)|context.*closed/i
    .test(mensagem)) {
    return "JANELA_FECHADA";
  }
  return "FALHA_NAVEGACAO";
}

async function paginaWhatsapp(context: BrowserContext): Promise<Page> {
  const page = context.pages().find(p => !p.isClosed()) ?? await context.newPage();
  await page.goto("https://web.whatsapp.com/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  });
  if (page.isClosed()) throw new Error("janela fechada");
  for (const extra of context.pages()) {
    if (extra !== page) await extra.close().catch(() => undefined);
  }
  await page.bringToFront();
  return page;
}

async function conectar(): Promise<void> {
  let context: BrowserContext | undefined;
  let confirmou = false;
  let anterior = "";
  try {
    informar("ABRINDO");
    context = await chromium.launchPersistentContext(profileDir, {
      channel: canal,
      headless: modoTeste,
      viewport: modoTeste ? { width: 1280, height: 900 } : null,
      args: modoTeste ? [] : ["--start-maximized"]
    });
    const page = await paginaWhatsapp(context);
    informar("JANELA_ABERTA");

    if (modoTeste) {
      // O teste nunca equivale a uma sessão de WhatsApp autenticada.
      informar("TESTE_SEM_AUTENTICACAO");
      return;
    }

    console.log("Use o QR Code no Chrome do projeto, se solicitado. " +
      "Aguarde a confirmação de conexão no painel antes de fechar a janela.");

    while (!page.isClosed()) {
      const visto = await detectarEstadoVisualWhatsapp(page);
      if (visto === "fechada") break;
      const atual = visto === "conectado"
        ? "CONECTADO"
        : visto === "qr" ? "AGUARDANDO_QR" : "AGUARDANDO_PAREAMENTO";
      if (atual !== anterior) {
        informar(atual);
        anterior = atual;
      }
      if (visto === "conectado") confirmou = true;
      await new Promise<void>(resolve => setTimeout(resolve, 1_500));
    }

    informar(confirmou ? "VERIFICADO_ANTES_FECHAMENTO" :
      "ENCERRADO_SEM_VERIFICACAO");
  } catch (error) {
    const motivo = codigoFalha(error);
    informar(motivo);
    console.error(motivo === "PERFIL_OCUPADO"
      ? "O perfil do WhatsApp ja esta em uso por outra janela do projeto."
      : motivo === "JANELA_FECHADA"
        ? "A janela do Chrome foi fechada antes da verificacao da conexao."
        : "Nao foi possivel abrir ou carregar o WhatsApp Web. Verifique a conexao de rede.");
    process.exitCode = 1;
  } finally {
    await context?.close().catch(() => undefined);
  }
}

await conectar();
