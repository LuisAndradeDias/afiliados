const PANEL = "http://127.0.0.1:3030";
const AFILIADOS = "https://www.mercadolivre.com.br/afiliados";

async function api(path, options = {}) {
  const response = await fetch(PANEL + path, {
    cache: "no-store",
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { ok: false, mensagem: text || "Resposta inválida do painel." };
  }

  if (!response.ok) {
    throw new Error(data.mensagem || "HTTP " + response.status);
  }

  return data;
}

async function ping() {
  return api("/api/mercadolivre/extension-ping", {
    method: "POST",
    body: "{}"
  });
}

async function garantirAbaParaJob() {
  const resposta = await api("/api/mercadolivre/link-job");
  if (!resposta?.job) return;

  const abas = await chrome.tabs.query({
    url: [
      "https://www.mercadolivre.com.br/*",
      "https://mercadolivre.com.br/*"
    ]
  });

  const ativa = abas.find((aba) => aba.id && !aba.discarded);
  if (ativa) return;

  await chrome.tabs.create({
    url: AFILIADOS,
    active: false
  });
}

async function cicloBackground() {
  try {
    await ping();
    await garantirAbaParaJob();
  } catch {
    // Painel fechado, Chrome sem permissão ou rede indisponível.
    // O próximo ciclo tenta novamente.
  }
}

function configurarAlarme() {
  chrome.alarms.create("meli-monitor", { periodInMinutes: 0.5 });
}

chrome.runtime.onInstalled.addListener(() => {
  configurarAlarme();
  void cicloBackground();
});

chrome.runtime.onStartup.addListener(() => {
  configurarAlarme();
  void cicloBackground();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "meli-monitor") {
    void cicloBackground();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const executar = async () => {
    if (!message || typeof message !== "object") {
      return { ok: false, mensagem: "Mensagem inválida." };
    }

    if (message.type === "ping") {
      return ping();
    }

    if (message.type === "getJob") {
      return api("/api/mercadolivre/link-job");
    }

    if (message.type === "startJob") {
      return api("/api/mercadolivre/link-job/start", {
        method: "POST",
        body: JSON.stringify({ id: message.id })
      });
    }

    if (message.type === "result") {
      return api("/api/mercadolivre/link-result", {
        method: "POST",
        body: JSON.stringify({
          id: message.id,
          link: message.link || "",
          error: message.error || ""
        })
      });
    }

    if (message.type === "couponSnapshot") {
      return api("/api/mercadolivre/coupons-observed", {
        method: "POST",
        body: JSON.stringify({
          url: message.url || "",
          blocks: Array.isArray(message.blocks)
            ? message.blocks.slice(0, 100)
            : []
        })
      });
    }

    return { ok: false, mensagem: "Ação desconhecida." };
  };

  executar()
    .then(sendResponse)
    .catch((error) =>
      sendResponse({
        ok: false,
        mensagem: error instanceof Error ? error.message : String(error)
      })
    );

  return true;
});
