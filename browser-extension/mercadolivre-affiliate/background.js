const PANEL = "http://127.0.0.1:3030";

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
  try {
    await api("/api/mercadolivre/extension-ping", {
      method: "POST",
      body: "{}"
    });
  } catch {
    // O painel pode estar fechado; tentamos novamente depois.
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("meli-ping", { periodInMinutes: 1 });
  ping();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("meli-ping", { periodInMinutes: 1 });
  ping();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "meli-ping") ping();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const executar = async () => {
    if (!message || typeof message !== "object") {
      return { ok: false, mensagem: "Mensagem inválida." };
    }

    if (message.type === "ping") {
      return api("/api/mercadolivre/extension-ping", {
        method: "POST",
        body: "{}"
      });
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
