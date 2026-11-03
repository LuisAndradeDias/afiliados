import "dotenv/config";
import { resolve } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import { detectarEstadoVisualWhatsapp } from "./whatsapp-conexao.js";
import { verificarDestinoWhatsapp } from "./whatsapp-alvo.js";

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

    console.log("Se for solicitado, escaneie o QR Code no Chrome. " +
      "A verificação da conta e do grupo encerrará a janela automaticamente, sem enviar.");

    let grupoConfirmado = false;
    const expiracao = Date.now() + 180_000;
    while (!page.isClosed() && Date.now() < expiracao) {
      const visto = await detectarEstadoVisualWhatsapp(page);
      if (visto === "fechada") break;
      const atual = visto === "conectado"
        ? "CONECTADO"
        : visto === "qr" ? "AGUARDANDO_QR" : "AGUARDANDO_PAREAMENTO";
      if (atual !== anterior) {
        informar(atual);
        anterior = atual;
      }
      if (visto === "conectado") {
        confirmou = true;
        const nomeExato = process.env.WHATSAPP_GROUP_NAME?.trim();
        if (!nomeExato) {
          informar("GRUPO_NAO_CONFIGURADO");
        } else {
          const estadoDestino = await verificarDestinoWhatsapp(page, nomeExato);
          if (estadoDestino === "grupo-pronto") {
            grupoConfirmado = true;
            informar("GRUPO_CONFIRMADO");
          } else {
            informar("DESTINO_" + estadoDestino.toUpperCase().replaceAll("-", "_"));
          }
        }
        break;
      }
      await new Promise<void>(resolve => setTimeout(resolve, 1_200));
    }

    if (confirmou && grupoConfirmado) {
      informar("DIAGNOSTICO_OK");
      console.log("Conta e grupo confirmados. Fechando o Chrome sem enviar mensagens.");
    } else if (confirmou) {
      informar("GRUPO_PENDENTE");
      console.warn("Conta conectada, mas grupo/compositor nao confirmados. Nenhuma mensagem foi enviada.");
      process.exitCode = 2;
    } else {
      informar(page.isClosed() ? "JANELA_FECHADA" : "TEMPO_LIMITE");
      console.warn("A conexao nao foi confirmada. Nenhuma mensagem foi enviada.");
      process.exitCode = 1;
    }
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
