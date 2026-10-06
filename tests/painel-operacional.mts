import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const html = await readFile("src/painel/public/index.html", "utf8");

const base = {
  grupo: "Ofertas",
  afiliadoConfigurado: true,
  afiliadoTag: "topoutlet05-20",
  sessaoWhatsapp: true,
  mercadoLivreApiConfigurada: true,
  mercadoLivreExtensionConectada: true,
  mercadoLivreAppConfigurada: true,
  mercadoLivreOauthPronto: true,
  mercadoLivreRedirectUri: "",
  mercadoLivreClientId: "",
  mercadoLivreOferta: {},
  mercadoLivreLinkJob: null,
  mercadoLivreFluxoAutomatico: false,
  mercadoLivreFluxoEtapa: "idle",
  mercadoLivreFluxoMensagem: "",
  mercadoLivreCuponsAtivos: 0,
  descontoMinimo: 20,
  consultas: "ofertas",
  previewCooldownMinutos: 120,
  cooldownHoras: 24,
  ofertasBloqueadas: 0,
  linkAfiliadoAtual: "",
  logs: [],
  executando: [],
  mensagem: "",
  imagemUrl: "",
  categoriaAtual: "",
  comissaoAtual: 0,
  scoreAtual: 0,
  cupomAtual: "",
  precoComCupomEstimado: 0,
  whatsappEnvioPendente: false,
  ultimoEnvioConcluidoEm: 0,
  ultimoEnvioComProxima: false,
  ofertaPreparada: false,
  ofertaPlataformaAtual: null,
  whatsappRevisaoPronta: false,
  operacaoEstado: "paused",
  operacaoPlataforma: null,
  monitorAlternadoAtivo: false,
  monitorAlternadoProximaPlataforma: "mercado-livre",
  monitorAlternadoProximaBuscaEm: 0,
  amazonMonitorUltimaBuscaEm: 0,
  mercadoLivreMonitorUltimaBuscaEm: 0
};

let state: Record<string, unknown> = { ...base };

const server = createServer((req, res) => {
  if (req.url === "/api/status") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(state));
    return;
  }

  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  res.writeHead(404);
  res.end();
});

await new Promise<void>((resolve) =>
  server.listen(0, "127.0.0.1", () => resolve())
);

const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("Não foi possível iniciar o servidor de teste.");
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true
});

try {
  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  await page.goto(`http://127.0.0.1:${address.port}/`, {
    waitUntil: "networkidle"
  });

  assert(
    (await page.locator("#cycleToggleButton").innerText()).includes("Iniciar"),
    "Estado pausado deveria exibir Iniciar ciclo."
  );
  assert(
    (await page.locator("#flowTitle").innerText()) === "Ciclo automático pausado",
    "Atividade pausada não foi renderizada corretamente."
  );

  state = {
    ...base,
    monitorAlternadoAtivo: true,
    operacaoEstado: "searching",
    operacaoPlataforma: "amazon",
    monitorAlternadoProximaPlataforma: "mercado-livre",
    monitorAlternadoProximaBuscaEm: Date.now() + 60_000,
    executando: ["buscar"]
  };
  await page.waitForTimeout(1_700);

  assert(
    (await page.locator("#cycleNow").innerText()) === "Buscando na Amazon",
    "Busca Amazon não apareceu no status principal."
  );
  assert(
    (await page.locator("#amazonLane").getAttribute("class"))?.includes("active"),
    "Faixa Amazon deveria estar ativa durante a busca."
  );

  state = {
    ...base,
    monitorAlternadoAtivo: true,
    operacaoEstado: "review",
    operacaoPlataforma: "amazon",
    ofertaPreparada: true,
    ofertaPlataformaAtual: "amazon",
    whatsappRevisaoPronta: true,
    monitorAlternadoProximaPlataforma: "mercado-livre",
    executando: ["preparar"],
    mensagem: "OFERTA AMAZON https://www.amazon.com.br/dp/TESTE?tag=topoutlet05-20",
    categoriaAtual: "echo",
    comissaoAtual: 9.5,
    scoreAtual: 71
  };
  await page.waitForTimeout(1_700);

  assert(
    (await page.locator("#reviewOrigin").innerText()) === "Amazon",
    "Oferta Amazon foi rotulada como outra plataforma."
  );
  assert(
    await page.locator("#sendNowButton").isVisible(),
    "Enviar deveria aparecer quando o WhatsApp está pronto."
  );
  assert(
    !(await page.locator("#reopenWhatsappButton").isVisible()),
    "Reabrir não deveria aparecer com revisão já pronta."
  );

  state = {
    ...base,
    monitorAlternadoAtivo: true,
    operacaoEstado: "sending",
    operacaoPlataforma: "amazon",
    ofertaPreparada: true,
    ofertaPlataformaAtual: "amazon",
    whatsappRevisaoPronta: true,
    whatsappEnvioPendente: true,
    monitorAlternadoProximaPlataforma: "mercado-livre",
    executando: ["preparar"],
    mensagem: "OFERTA AMAZON https://www.amazon.com.br/dp/TESTE?tag=topoutlet05-20"
  };
  await page.waitForTimeout(1_700);

  assert(
    (await page.locator("#cycleNow").innerText()) ===
      "Confirmando envio no WhatsApp",
    "Autoenvio em confirmação deveria aparecer como sending no painel."
  );
  assert(
    await page.locator("#sendNowButton").isDisabled(),
    "Botão Enviar deve ficar bloqueado enquanto o WhatsApp confirma o autoenvio."
  );

  state = {
    ...base,
    monitorAlternadoAtivo: true,
    operacaoEstado: "offer-pending",
    operacaoPlataforma: "mercado-livre",
    ofertaPreparada: true,
    ofertaPlataformaAtual: "mercado-livre",
    monitorAlternadoProximaPlataforma: "amazon",
    mensagem: "OFERTA MERCADO LIVRE https://meli.la/teste",
    categoriaAtual: "casa",
    scoreAtual: 80
  };
  await page.waitForTimeout(1_700);

  assert(
    (await page.locator("#reviewOrigin").innerText()) === "Mercado Livre",
    "Oferta Meli pendente deveria ser identificada como Mercado Livre."
  );
  assert(
    await page.locator("#reopenWhatsappButton").isVisible(),
    "Oferta pendente deveria oferecer Reabrir no WhatsApp."
  );
  assert(
    !(await page.locator("#sendNowButton").isVisible()),
    "Enviar não pode aparecer se a janela do WhatsApp não está pronta."
  );

  assert(
    pageErrors.length === 0,
    `Erros de página: ${pageErrors.join(" | ")}`
  );

  console.log("painel-operacional: OK");
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve())
  );
}
