import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const html = await readFile("src/painel/public/index.html", "utf8");

const base = {
  grupo: "Ofertas",
  grupoConfigurado: true,
  // Fixture visual: elegibilidade apenas simulada, sem cadastro operacional.
  canalElegibilidade: {
    estado: "elegivel", codigo: "CANAL_HOMOLOGADO",
    motivo: "Fixture homologada", podePublicar: true
  },
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

  // Uma pasta Chrome existente nao comprova que a conta esta autenticada.
  assert(
    !(await page.locator("#whatsappDot").getAttribute("class"))?.includes("ok"),
    "Perfil salvo sem verificacao nao pode ter indicador verde."
  );
  state = {
    ...base,
    executando: ["login"],
    logs: [
      "[16:17:00] [login] Iniciado.",
      "[16:17:02] [login] WHATSAPP_CONEXAO:AGUARDANDO_PAREAMENTO"
    ]
  };
  await page.waitForTimeout(1700);
  assert(
    (await page.locator("#whatsappConnectionDetails").innerText())
      .includes("Aguardando"),
    "O usuario deve enxergar status persistente enquanto pareia."
  );
  state = {
    ...base,
    executando: ["login"],
    logs: [
      "[16:17:00] [login] Iniciado.",
      "[16:17:02] [login] WHATSAPP_CONEXAO:AGUARDANDO_PAREAMENTO",
      "[16:17:04] [login] WHATSAPP_CONEXAO:CONECTADO"
    ]
  };
  await page.waitForTimeout(1700);
  assert(
    (await page.locator("#whatsappConnectionDetails").innerText())
      .includes("Conectado"),
    "So apos evidencia do WhatsApp o painel deve confirmar o login."
  );
  state = {
    ...base,
    logs: [
      "[16:17:00] [login] Iniciado.",
      "[16:17:02] [login] WHATSAPP_CONEXAO:FALHA_NAVEGACAO",
      "[16:17:02] [login] Finalizado com código 1."
    ]
  };
  await page.waitForTimeout(1700);
  assert(
    (await page.locator("#whatsappConnectionDetails").innerText())
      .includes("Falha"),
    "Fechamento abrupto nao deve parecer login concluido."
  );
  assert(
    !(await page.locator("#whatsappDot").getAttribute("class"))?.includes("ok"),
    "Falha de conexao deve manter indicador nao conectado."
  );
  state = { ...base };
  await page.waitForTimeout(1700);

  state = {
    ...base,
    grupoConfigurado:true,
    canalElegibilidade:{
      estado:"pendente-verificacao", codigo:"CANAL_NAO_HOMOLOGADO",
      motivo:"Nenhum cadastro de canais homologados foi encontrado.",
      podePublicar:false
    },
    operacaoEstado:"offer-pending",
    ofertaPlataformaAtual:"amazon",
    ofertaPreparada:true,
    mensagem:"TESTE DE OFERTA NAO ENVIAR",
    logs:[
      "[16:50:54] [mercadolivre-buscar] Iniciado.",
      "[16:51:30] [mercadolivre-buscar] Mercado Livre catalogo: consultados=60, 404=59, cache404=0, vendedores-verdes=0, descontos-minimos=0, catalogos-ativos-sem-vencedor=1.",
      "[16:52:05] [mercadolivre-buscar] Mercado Livre catalogo: consultados=60, 404=59, cache404=0, vendedores-verdes=0, descontos-minimos=0, catalogos-ativos-sem-vencedor=1.",
      "[16:52:05] [mercadolivre-buscar] Mercado Livre: 0 candidatos com vendedor verificado, 0 elegiveis com minimo real de 25% (cupons ativos considerados: 0).",
      "[16:52:05] [mercadolivre-buscar] Finalizado com código 2."
    ]
  };
  await page.waitForTimeout(1700);
  assert(
    (await page.locator("#mlDiscoveryNotice").innerText()).includes("118 respostas 404"),
    "A falta de ofertas no ML deve mostrar o motivo tecnico sem chamar de falha de login."
  );
  assert(
    (await page.locator("#reviewSubtitle").innerText()).includes("homologação"),
    "Oferta bloqueada por canal deve exibir motivo em vez de recomendar reabrir."
  );
  assert(
    (await page.locator("#flowTitle").innerText()).includes("bloqueada"),
    "Atividade atual nao pode sugerir que apenas falta abrir o WhatsApp."
  );
  assert(await page.locator("#reopenWhatsappButton").isDisabled(),
    "Sem homologacao o preparador permanece bloqueado.");
  assert(await page.locator("#openWhatsappConnectionButton").isEnabled(),
    "Verificar sessao sem envio continua permitido.");
  state = { ...base };
  await page.waitForTimeout(1700);

  assert(
    (await page.locator("#cycleToggleButton").innerText()).includes("Iniciar"),
    "Estado pausado deveria exibir Iniciar ciclo."
  );
  assert(
    (await page.locator("#flowTitle").innerText()) === "Ciclo automático pausado",
    "Atividade pausada não foi renderizada corretamente."
  );
  assert(
    (await page.locator("#mercadoLivreStatus").innerText()).includes("Token salvo"),
    "Token configurado não é prova de API Mercado Livre autorizada."
  );
  assert(
    (await page.locator("#mlAutomationStatus").textContent())?.includes("Confira o caminho"),
    "Um ping da extensão não pode ser apresentado como link pronto."
  );
  assert(
    (await page.locator("#tempoMedioButton").getAttribute("aria-pressed")) === "true",
    "Tempo médio deve aparecer selecionado por padrão."
  );
  assert(
    (await page.locator("#tempoCurtoButton").getAttribute("aria-pressed")) === "false",
    "Tempo curto deve aparecer como alternativa."
  );

  state = {
    ...base,
    intervaloModo: "curto",
    intervaloProximaLiberacaoEm: Date.now() + 5 * 60_000,
    monitorAlternadoAtivo: true,
    operacaoEstado: "scheduled",
    monitorAlternadoProximaPlataforma: "mercado-livre",
    monitorAlternadoProximaBuscaEm: Date.now() + 5 * 60_000
  };
  await page.waitForTimeout(1_700);
  assert(
    (await page.locator("#tempoCurtoButton").getAttribute("aria-pressed")) === "true",
    "A seleção de Tempo curto deve aparecer no painel."
  );
  assert(
    (await page.locator("#cycleNow").innerText()) === "Intervalo entre promoções",
    "Durante a espera, o estado principal deve mostrar o intervalo."
  );
  assert(
    (await page.locator("#intervaloAviso").innerText()).includes("Próxima publicação em"),
    "Painel deve mostrar o contador do próximo envio."
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

  // Etapa 57: oferta presente, grupo salvo e regra pendente nunca mostram envio livre.
  state = {
    ...base,
    operacaoEstado: "offer-pending",
    operacaoPlataforma: "mercado-livre",
    ofertaPreparada: true,
    ofertaPlataformaAtual: "mercado-livre",
    mensagem: "OFERTA FICTICIA SEM ENVIO",
    canalElegibilidade: {
      estado: "pendente-verificacao", codigo: "CANAL_NAO_HOMOLOGADO",
      motivo: "Cadastro pendente para esta plataforma", podePublicar: false
    }
  };
  await page.waitForTimeout(1_700);
  assert(
    (await page.locator("#cycleWhatsapp").innerText()) === "Canal não homologado",
    "O estado comercial deve ser compreensível no ciclo."
  );
  assert(
    (await page.locator("#whatsappSetupHint").innerText()).includes("Envio bloqueado"),
    "O painel deve explicar por que o canal está bloqueado."
  );
  assert(
    (await page.locator("#reopenWhatsappButton").isDisabled()) &&
    !(await page.locator("#sendNowButton").isVisible()),
    "Oferta de canal não homologado não permite abrir nem enviar."
  );

  // A migração para o PC novo começa sem grupo; a oferta deve ser
  // preservada, com um formulário legível e login separado da preparação.
  state = {
    ...base,
    grupo: "Não configurado",
    grupoConfigurado: false,
    whatsappAutoEnvioAtivo: true,
    whatsappAutoEnvioAtrasoMs: 4500,
    sessaoWhatsapp: true,
    operacaoEstado: "offer-pending",
    operacaoPlataforma: "amazon",
    ofertaPlataformaAtual: "amazon",
    ofertaPreparada: true,
    mensagem: "Oferta Amazon aguardando destino",
    whatsappRevisaoPronta: false
  };
  await page.waitForTimeout(1_700);
  assert(
    (await page.locator("#flowTitle").innerText()).includes("configure o grupo"),
    "Sem grupo, o título deve explicar por que o WhatsApp não abriu."
  );
  assert(
    !(await page.locator("#whatsappGroupInput").isVisible()) &&
    await page.locator('#openWhatsappConnectionButton').isVisible(),
    "A configuração do grupo é opcional e deve ficar recolhida por padrão."
  );
  assert(
    !(await page.locator("#sendNowButton").isVisible()),
    "O envio não pode estar disponível sem a janela de revisão."
  );
  assert(
    (await page.locator("#cycleWhatsapp").innerText()) === "Destino pendente",
    "Pasta de perfil existente não comprova WhatsApp conectado."
  );
  assert(
    (await page.locator("#reviewWhatsappState").innerText()).includes("salve"),
    "O motivo da falha deve ser apresentado junto à oferta."
  );
  assert(
    (await page.locator("#autoSendStatus").innerText()).includes("Autoenvio ativo"),
    "A tela deve exibir quando o clique físico automático está habilitado."
  );
  await page.locator(".group-advanced summary").click();
  const sizes=await page.locator("#whatsappGroupInput").evaluate(el=>({
    h:el.getBoundingClientRect().height,
    font:parseFloat(getComputedStyle(el).fontSize)
  }));
  assert(sizes.h >= 44 && sizes.font >= 14,"Campo de grupo ficou pequeno: "+JSON.stringify(sizes));
  const draft=page.locator("#whatsappGroupInput");
  await draft.fill("Meu grupo ainda não salvo");
  await page.waitForTimeout(1_700);
  assert(
    await draft.inputValue() === "Meu grupo ainda não salvo",
    "O polling da tela não pode apagar a edição do nome do grupo."
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
