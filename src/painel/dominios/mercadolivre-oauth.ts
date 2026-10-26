/**
 * Contratos OAuth do Mercado Livre.
 * A sessão OAuth (state) e a persistência dos tokens continuam no servidor.
 * fetchImpl é injetável para impedir qualquer rede real durante testes.
 */

export interface TokenMercadoLivre {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number;
}

export function redirectMercadoLivreEhValido(valor: string): boolean {
  if (!valor) return false;
  try {
    const url = new URL(valor);
    return url.protocol === "https:" &&
      url.pathname === "/oauth/mercadolivre/callback";
  } catch {
    return false;
  }
}

export function credenciaisMercadoLivreConfiguradas(
  clientId?: string, clientSecret?: string
): boolean {
  return Boolean(clientId?.trim() && clientSecret?.trim());
}

export function criarUrlAutorizacaoMercadoLivre({
  clientId, clientSecret, redirectUri, state
}: {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  state: string;
}): string {
  if (!credenciaisMercadoLivreConfiguradas(clientId, clientSecret)) {
    throw new Error("Configure o App ID e a Secret Key do Mercado Livre primeiro.");
  }
  if (!redirectMercadoLivreEhValido(redirectUri)) {
    throw new Error(
      "Configure um Redirect URI HTTPS válido terminando em /oauth/mercadolivre/callback."
    );
  }

  const url = new URL("https://auth.mercadolivre.com.br/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId.trim());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function trocarCodigoMercadoLivre({
  code, clientId, clientSecret, redirectUri, fetchImpl = fetch
}: {
  code: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<TokenMercadoLivre> {
  if (!clientId?.trim() || !clientSecret?.trim()) {
    throw new Error("Credenciais do aplicativo Mercado Livre não configuradas.");
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    code,
    redirect_uri: redirectUri
  });
  const resposta = await fetchImpl("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body
  });
  const texto = await resposta.text();
  if (!resposta.ok) {
    throw new Error(`Mercado Livre OAuth HTTP ${resposta.status}: ${texto.slice(0, 300)}`);
  }
  return JSON.parse(texto) as TokenMercadoLivre;
}
