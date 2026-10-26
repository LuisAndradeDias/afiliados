(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const form = byId("shopeeForm");
  const feedback = byId("shopeeFeedback");
  const saveButton = byId("shopeeSave");
  const drafts = byId("shopeeDrafts");
  const sidebar = byId("sidebar");
  const scrim = byId("scrim");
  const menu = byId("menuBtn");
  const formatter = new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL"
  });

  function mobileMenu(open) {
    sidebar.classList.toggle("open", open);
    scrim.hidden = !open;
    scrim.classList.toggle("open", open);
    menu.setAttribute("aria-expanded", String(open));
  }
  menu.addEventListener("click", () => mobileMenu(!sidebar.classList.contains("open")));
  scrim.addEventListener("click", () => mobileMenu(false));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") mobileMenu(false);
  });

  function mensagem(text, tipo = "error") {
    feedback.hidden = false;
    feedback.className = "shopee-feedback " + tipo;
    feedback.textContent = text;
  }

  async function api(path, options = {}) {
    const res = await fetch(path, { cache: "no-store", ...options });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(
      typeof data.mensagem === "string" ? data.mensagem :
      "Não foi possível completar a operação local."
    );
    return data;
  }

  function botao(label, fn, classe = "") {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    element.className = classe;
    element.addEventListener("click", fn);
    return element;
  }

  function mostrarRascunhos(items) {
    drafts.replaceChildren();
    byId("shopeeDraftCount").textContent = String(items.length);
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "shopee-empty";
      empty.textContent = "Nenhum link salvo ainda. Quando sua conta for aprovada, gere um link no portal da Shopee e cadastre aqui para começar.";
      drafts.append(empty);
      return;
    }
    items.forEach(item => {
      const card = document.createElement("article");
      card.className = "shopee-draft";
      const body = document.createElement("div");
      body.className = "shopee-draft-content";
      const title = document.createElement("strong");
      title.textContent = item.titulo;
      const link = document.createElement("small");
      link.textContent = item.urlAfiliado;
      const meta = document.createElement("span");
      meta.className = "shopee-draft-meta";
      meta.textContent = item.preco === null ?
        "Link manual · preço não informado" :
        formatter.format(item.preco) + " · link manual";
      body.append(title, link, meta);
      const actions = document.createElement("div");
      actions.className = "shopee-draft-actions";
      actions.append(
        botao("Copiar link", async () => {
          try {
            await navigator.clipboard.writeText(item.urlAfiliado);
            mensagem("Link copiado. Nenhuma mensagem foi enviada.", "ok");
          } catch { mensagem("Não foi possível copiar. Verifique a permissão do navegador."); }
        }),
        botao("Excluir", async () => {
          if (!window.confirm("Excluir este rascunho? Isso não altera outras plataformas.")) return;
          try {
            await api("/api/shopee/rascunhos/" + encodeURIComponent(item.id), {
              method: "DELETE"
            });
            mensagem("Rascunho excluído com segurança.", "ok");
            await carregarRascunhos();
          } catch (error) { mensagem(error.message); }
        }, "danger")
      );
      card.append(body, actions);
      drafts.append(card);
    });
  }

  async function carregarRascunhos() {
    const result = await api("/api/shopee/rascunhos");
    mostrarRascunhos(result.rascunhos);
  }

  async function carregarStatus() {
    const info = await api("/api/shopee/status");
    byId("shopeeConnection").textContent = info.apiAtiva ?
      "API conectada" : "Aguardando sua conta";
    byId("shopeeAccountStat").textContent = info.apiAtiva ?
      "Conectada" : "Aguardando";
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (saveButton.disabled) return;
    saveButton.disabled = true;
    saveButton.textContent = "Salvando...";
    feedback.hidden = true;
    try {
      await api("/api/shopee/rascunhos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          titulo: byId("shopeeTitulo").value,
          url: byId("shopeeUrl").value,
          preco: byId("shopeePreco").value,
          confirmado: byId("shopeeConfirmado").checked
        })
      });
      form.reset();
      mensagem("Link salvo como rascunho local. Nenhuma oferta foi enviada.", "ok");
      await carregarRascunhos();
    } catch (error) {
      mensagem(error.message);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Salvar rascunho";
    }
  });

  Promise.all([carregarStatus(), carregarRascunhos()]).catch(() => {
    mensagem("A Central local não respondeu. Atualize a página para tentar novamente.");
    const empty = document.createElement("div");
    empty.className = "shopee-empty";
    empty.textContent = "Rascunhos indisponíveis. Nenhum dado foi enviado.";
    drafts.replaceChildren(empty);
  });
})();
