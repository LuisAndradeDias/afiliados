import "dotenv/config";
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright";
import { registrarOfertaEnviada } from "../ofertas/historico.js";

const mensagemPath = resolve("data", "ultima-mensagem-whatsapp.txt");
const pacotePath = resolve("data", "ultima-oferta-whatsapp.json");
const fecharSignalPath = resolve("data", "fechar-whatsapp.signal");
const enviarSignalPath = resolve("data", "enviar-whatsapp.signal");
const modoTeste = process.env.WHATSAPP_PREPARE_TEST === "true";
const canal = process.env.WHATSAPP_BROWSER_CHANNEL ?? "chrome";

const argumentoGrupo = process.argv.slice(2).join(" ").trim();
const nomeGrupo = argumentoGrupo || process.env.WHATSAPP_GROUP_NAME?.trim();

if (!nomeGrupo) {
  throw new Error(
    'Informe o grupo: npm run whatsapp:preparar -- "Nome exato do grupo" ou configure WHATSAPP_GROUP_NAME.'
  );
}

const mensagem = await readFile(mensagemPath, "utf8").catch(() => {
  throw new Error(
    "Mensagem não encontrada. Rode npm run whatsapp:preview ou npm run automatico primeiro."
  );
});

interface PacotePreparar {
  imagemUrl?: string;
  plataforma?: string;
  produtoId?: string;
  titulo?: string;
  precoAtual?: number;
  descontoPercentual?: number;
}

const pacote: PacotePreparar = await readFile(pacotePath, "utf8")
  .then((texto) => JSON.parse(texto) as PacotePreparar)
  .catch(() => ({}));

async function baixarImagemOferta(url?: string): Promise<string | undefined> {
  if (!url) return undefined;

  try {
    const resposta = await fetch(url, {
      headers: {
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "user-agent": "Mozilla/5.0"
      }
    });

    if (!resposta.ok) {
      throw new Error(`HTTP ${resposta.status}`);
    }

    const tipo = (resposta.headers.get("content-type") ?? "").toLowerCase();
    if (!tipo.startsWith("image/")) {
      throw new Error(`Conteúdo inesperado: ${tipo || "sem content-type"}`);
    }

    const extensao = tipo.includes("png")
      ? "png"
      : tipo.includes("gif")
        ? "gif"
        : "jpg";
    const caminho = resolve("data", `ultima-imagem-whatsapp.${extensao}`);

    for (const ext of ["jpg", "png", "gif"]) {
      if (ext !== extensao) {
        await rm(resolve("data", `ultima-imagem-whatsapp.${ext}`), { force: true });
      }
    }

    const bytes = Buffer.from(await resposta.arrayBuffer());
    if (bytes.length < 500) throw new Error("Arquivo de imagem muito pequeno.");

    await writeFile(caminho, bytes);
    console.log(`Imagem da oferta baixada: ${caminho}`);
    return caminho;
  } catch (error) {
    const mensagemErro = error instanceof Error ? error.message : String(error);
    console.warn(`Não foi possível baixar a imagem da oferta: ${mensagemErro}`);
    return undefined;
  }
}

const imagemPath = modoTeste
  ? undefined
  : await baixarImagemOferta(pacote.imagemUrl);

await rm(fecharSignalPath, { force: true });
await rm(enviarSignalPath, { force: true });

async function primeiroVisivel(
  candidatos: Locator[],
  timeoutPorSeletor = 4_000
): Promise<Locator> {
  for (const candidato of candidatos) {
    const atual = candidato.first();
    try {
      await atual.waitFor({ state: "visible", timeout: timeoutPorSeletor });
      return atual;
    } catch {
      // tenta o próximo seletor
    }
  }
  throw new Error("Elemento esperado não foi encontrado no WhatsApp Web.");
}

async function localizarBusca(page: Page): Promise<Locator> {
  return primeiroVisivel(
    [
      page.getByRole("textbox", { name: /pesquisar|search/i }),
      page.locator('#side div[contenteditable="true"][role="textbox"]'),
      page.locator('div[contenteditable="true"][data-tab="3"]'),
      page.locator('div[contenteditable="true"][aria-label*="Pesquisar"]')
    ],
    30_000
  );
}


async function fecharAbasExtras(
  context: BrowserContext,
  principal: Page
): Promise<void> {
  for (const extra of context.pages()) {
    if (extra === principal) continue;
    await extra.close().catch(() => undefined);
  }

  await principal.bringToFront();
}


async function registrarEnvioAtual(): Promise<void> {
  if (!pacote.produtoId || !pacote.titulo) {
    throw new Error("Não foi possível identificar a oferta enviada.");
  }

  await registrarOfertaEnviada({
    plataforma: pacote.plataforma ?? "amazon",
    produtoId: pacote.produtoId,
    titulo: pacote.titulo,
    precoAtual: pacote.precoAtual,
    descontoPercentual: pacote.descontoPercentual
  });
}

async function enviarOfertaNoWhatsapp(page: Page): Promise<void> {
  const dialogo = page.locator('[role="dialog"]').last();
  const dialogoVisivel = await dialogo.isVisible().catch(() => false);
  const raiz = dialogoVisivel ? dialogo : page;

  const iconeEnviar = raiz.locator('[data-icon*="send"]').last();
  const iconeVisivel = await iconeEnviar.isVisible().catch(() => false);

  if (iconeVisivel) {
    const botao = iconeEnviar
      .locator('xpath=ancestor::*[@role="button" or self::button][1]')
      .first();

    await botao.click({ timeout: 5_000 });
  } else {
    const legenda = await primeiroVisivel(
      [
        raiz.getByRole("textbox", {
          name: /^digite uma mensagem$|^type a message$/i
        }),
        raiz.locator('[contenteditable="true"][role="textbox"]').first()
      ],
      4_000
    );

    await legenda.focus();
    await page.keyboard.press("Enter");
  }

  if (dialogoVisivel) {
    await dialogo.waitFor({ state: "hidden", timeout: 15_000 });
  } else {
    await page.waitForTimeout(1_500);
  }
}

async function aguardarFinalizacao(
  context: BrowserContext,
  page: Page
): Promise<void> {
  while (context.pages().length > 0) {
    const enviar = await readFile(enviarSignalPath, "utf8")
      .then(() => true)
      .catch(() => false);

    if (enviar) {
      await rm(enviarSignalPath, { force: true });
      console.log("Envio solicitado pelo painel.");

      await enviarOfertaNoWhatsapp(page);
      await registrarEnvioAtual();
      console.log("ENVIO_CONFIRMADO: oferta enviada e registrada no histórico.");
      await context.close().catch(() => undefined);
      return;
    }

    const fechar = await readFile(fecharSignalPath, "utf8")
      .then(() => true)
      .catch(() => false);

    if (fechar) {
      await rm(fecharSignalPath, { force: true });
      console.log("Preparação cancelada pelo painel.");
      await context.close().catch(() => undefined);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function obterPaginaWhatsapp(context: BrowserContext): Promise<Page> {
  const paginas = context.pages();
  const page = paginas[0] ?? (await context.newPage());

  await page.goto("https://web.whatsapp.com/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  });

  await page.waitForTimeout(1_000);
  await fecharAbasExtras(context, page);

  return page;
}


async function localizarBotaoEnviar(page: Page): Promise<Locator> {
  return primeiroVisivel(
    [
      page.locator('[aria-label*="Enviar"]').first(),
      page.locator('[aria-label*="Send"]').first(),
      page.getByRole("button", { name: /enviar|send/i })
    ],
    15_000
  );
}

async function prepararImagemComLegenda(
  page: Page,
  caminhoImagem: string,
  legenda: string
): Promise<Locator> {
  const anexar = await primeiroVisivel([
    page.getByRole("button", { name: /anexar|attach/i }),
    page.locator('button[aria-label="Anexar"]')
  ]);

  await anexar.click();

  const fotosVideos = await primeiroVisivel(
    [
      page.getByText(/fotos e vídeos|photos and videos/i, { exact: true }),
      page.getByText(/fotos e videos|photos and videos/i, { exact: true })
    ],
    8_000
  );

  const fileChooserPromise = page.waitForEvent("filechooser", {
    timeout: 8_000
  });

  await fotosVideos.click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(caminhoImagem);

  console.log("Imagem selecionada pelo menu Fotos e vídeos.");

  const campoLegenda = await primeiroVisivel(
    [
      page.getByRole("textbox", {
        name: /^digite uma mensagem$|^type a message$/i
      }),
      page.locator('[contenteditable="true"][role="textbox"]').first()
    ],
    8_000
  );

  const botaoEnviar = await localizarBotaoEnviar(page);

  await campoLegenda.fill(legenda.trim());
  await botaoEnviar.waitFor({ state: "visible", timeout: 8_000 });

  console.log("Imagem anexada e legenda preenchida.");
  console.log("Oferta pronta para envio pelo painel.");
  return botaoEnviar;
}

async function localizarCompositor(page: Page): Promise<Locator> {
  return primeiroVisivel([
    page.locator('footer div[contenteditable="true"][role="textbox"]'),
    page.locator('div[contenteditable="true"][data-tab="10"]'),
    page.locator('footer div[contenteditable="true"]')
  ]);
}
const pastaPerfil = resolve(
  "data",
  modoTeste ? "whatsapp-profile-test" : "whatsapp-profile"
);

let context;
try {
  context = await chromium.launchPersistentContext(pastaPerfil, {
    channel: canal,
    headless: modoTeste,
    viewport: modoTeste ? { width: 1280, height: 900 } : null,
    args: modoTeste ? [] : ["--start-maximized"]
  });
} catch (error) {
  throw new Error(
    "Não foi possível abrir o perfil do WhatsApp. Feche outra janela do projeto que esteja usando o mesmo perfil e tente novamente.",
    { cause: error }
  );
}

const page = modoTeste
  ? context.pages()[0] ?? (await context.newPage())
  : await obterPaginaWhatsapp(context);

if (!modoTeste) {
  context.on("page", async (extra) => {
    if (extra === page) return;

    await extra.waitForTimeout(400).catch(() => undefined);
    const url = extra.url();

    if (url === "about:blank" || url.startsWith("chrome://newtab")) {
      await extra.close().catch(() => undefined);
      await page.bringToFront().catch(() => undefined);
    }
  });
}

if (modoTeste) {
  await page.setContent(`
    <div contenteditable="true" role="textbox" data-tab="3" aria-label="Pesquisar"></div>
    <div id="lista"><span title="${nomeGrupo}">${nomeGrupo}</span></div>
    <footer><div contenteditable="true" role="textbox" data-tab="10"></div></footer>
  `);
} else {
  console.log("Aguardando o WhatsApp Web ficar pronto...");
  console.log("Se aparecer QR Code, faça o login pelo celular. O programa continuará sozinho.");
}
try {
  const busca = await localizarBusca(page);
  await busca.fill(nomeGrupo);

  const resultadoGrupo = await primeiroVisivel(
    [
      page.getByTitle(nomeGrupo, { exact: true }),
      page.locator("[title]").filter({ hasText: nomeGrupo })
    ],
    8_000
  );
  await resultadoGrupo.click();

  await localizarCompositor(page);
  await page.waitForTimeout(2_000);

  let preparouImagem = false;
  let botaoEnviar: Locator;

  if (imagemPath) {
    botaoEnviar = await prepararImagemComLegenda(page, imagemPath, mensagem);
    preparouImagem = true;
  } else {
    const compositor = await localizarCompositor(page);
    await compositor.fill(mensagem.trim());

    const textoPreparado = (await compositor.textContent())?.trim() ?? "";
    if (!textoPreparado) {
      throw new Error("A mensagem não foi inserida no campo de conversa.");
    }

    botaoEnviar = await localizarBotaoEnviar(page);
  }

  if (!modoTeste) {
    await page.waitForTimeout(750);
    await fecharAbasExtras(context, page);
    console.log(
      `Aba ativa: ${page.url()} | Abas abertas pelo projeto: ${context.pages().length}`
    );
  }

  console.log(
    preparouImagem
      ? `Imagem + legenda preparadas no grupo: ${nomeGrupo}`
      : `Mensagem preparada no grupo: ${nomeGrupo}`
  );
  console.log("Aguardando sua confirmação pelo painel.");

  if (modoTeste) {
    console.log("Teste concluído: busca, abertura do grupo e preenchimento funcionaram.");
    await context.close();
    process.exit(0);
  }

  console.log(
    preparouImagem
      ? "Revise a foto e a legenda. Para enviar, use Enviar e carregar próxima no painel."
      : "Revise a mensagem. Para enviar, use o botão Enviar agora no painel."
  );

  await aguardarFinalizacao(context, page);
} catch (error) {
  await context.close();
  throw error;
}
