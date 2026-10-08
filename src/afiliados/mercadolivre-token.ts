import { mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { parse as parseDotenv } from "dotenv";

export class MercadoLivreReautorizacaoNecessaria extends Error {
  readonly code = "MERCADOLIVRE_REAUTORIZACAO_NECESSARIA";

  constructor(detalhe = "A autorização do Mercado Livre expirou ou foi revogada.") {
    super(detalhe + ' Abra o painel e use "Conectar Mercado Livre" para autorizar novamente.');
    this.name = "MercadoLivreReautorizacaoNecessaria";
  }
}

interface RespostaRenovacao {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  user_id?: unknown;
}

export interface OpcoesTokenMercadoLivre {
  forcar?: boolean;
  tokenRejeitado?: string;
  envPath?: string;
  fetchImpl?: typeof fetch;
  agora?: () => number;
}

const renovacoes = new Map<string, Promise<string>>();
const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

function textoVariavel(
  configuracao: Record<string, string>,
  nome: string
): string {
  return configuracao[nome] ?? process.env[nome] ?? "";
}

function tokenAindaValido(
  configuracao: Record<string, string>,
  agora: number
): boolean {
  const expira = Number(textoVariavel(configuracao, "MERCADOLIVRE_TOKEN_EXPIRES_AT"));
  // Sem data confiável, deixe a API testar o token (401 força uma renovação).
  return !Number.isFinite(expira) || expira <= 0 || expira > agora + 30_000;
}

function atualizarVariaveisArquivo(
  conteudo: string,
  alteracoes: Record<string, string>
): string {
  const fimLinha = conteudo.includes("\r\n") ? "\r\n" : "\n";
  const linhas = conteudo.split(/\r?\n/);
  const atualizadas = new Set<string>();

  const novas = linhas.map((linha) => {
    const encontrado = linha.match(/^([A-Z][A-Z0-9_]*)=/);
    if (!encontrado || !(encontrado[1] in alteracoes)) return linha;
    const nome = encontrado[1];
    if (atualizadas.has(nome)) {
      throw new Error("Configuração duplicada no .env: " + nome);
    }
    atualizadas.add(nome);
    return nome + "=" + alteracoes[nome];
  });

  for (const [nome, valor] of Object.entries(alteracoes)) {
    if (atualizadas.has(nome)) continue;
    if (novas.length && novas[novas.length - 1] === "") novas.pop();
    novas.push(nome + "=" + valor);
  }

  return novas.join(fimLinha).replace(/\s*$/, fimLinha);
}

async function adquirirTrava(caminho: string): Promise<() => Promise<void>> {
  const lockPath = join(dirname(caminho), "data", "mercadolivre-refresh.lock");
  await mkdir(dirname(lockPath), { recursive: true });
  const ate = Date.now() + 25_000;

  while (Date.now() < ate) {
    try {
      const handle = await open(lockPath, "wx", 0o600);
      await handle.writeFile(String(process.pid), "utf8");
      return async () => {
        await handle.close();
        await rm(lockPath, { force: true });
      };
    } catch (erro) {
      const code = (erro as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw erro;
      const antigo = await stat(lockPath).catch(() => null);
      if (antigo && Date.now() - antigo.mtimeMs > 60_000) {
        await rm(lockPath, { force: true });
        continue;
      }
      await espera(250);
    }
  }
  throw new Error(
    "Mercado Livre: outra renovação está em andamento. Tente novamente em instantes."
  );
}

async function renovarToken(
  caminho: string,
  opcoes: OpcoesTokenMercadoLivre
): Promise<string> {
  const destravar = await adquirirTrava(caminho);
  try {
    const conteudo = await readFile(caminho, "utf8").catch(() => "");
    const config = parseDotenv(conteudo);
    const tokenAtual = textoVariavel(config, "MERCADOLIVRE_ACCESS_TOKEN").trim();
    const agora = (opcoes.agora ?? Date.now)();

    // Se outro processo atualizou .env, não consuma novamente o token rotativo.
    if (
      opcoes.tokenRejeitado &&
      tokenAtual &&
      tokenAtual !== opcoes.tokenRejeitado &&
      tokenAindaValido(config, agora)
    ) {
      process.env.MERCADOLIVRE_ACCESS_TOKEN = tokenAtual;
      return tokenAtual;
    }
    if (!opcoes.forcar && tokenAtual && tokenAindaValido(config, agora)) {
      process.env.MERCADOLIVRE_ACCESS_TOKEN = tokenAtual;
      return tokenAtual;
    }

    const refresh = textoVariavel(config, "MERCADOLIVRE_REFRESH_TOKEN").trim();
    const clientId = textoVariavel(config, "MERCADOLIVRE_CLIENT_ID").trim();
    const clientSecret = textoVariavel(config, "MERCADOLIVRE_CLIENT_SECRET").trim();
    if (!refresh || !clientId || !clientSecret) {
      throw new MercadoLivreReautorizacaoNecessaria(
        "Não há credenciais completas para renovar o acesso ao Mercado Livre."
      );
    }

    const resposta = await (opcoes.fetchImpl ?? fetch)(
      "https://api.mercadolibre.com/oauth/token",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refresh
        }),
        signal: AbortSignal.timeout(15_000)
      }
    );

    if (!resposta.ok) {
      if ([400, 401, 403].includes(resposta.status)) {
        throw new MercadoLivreReautorizacaoNecessaria(
          "O Mercado Livre rejeitou a renovação (HTTP " + resposta.status + ")."
        );
      }
      throw new Error(
        "Mercado Livre: não foi possível renovar o acesso (HTTP " + resposta.status + ")."
      );
    }

    const dados = (await resposta.json()) as RespostaRenovacao;
    if (
      typeof dados.access_token !== "string" ||
      !dados.access_token.trim() ||
      typeof dados.refresh_token !== "string" ||
      !dados.refresh_token.trim() ||
      typeof dados.expires_in !== "number" ||
      !Number.isFinite(dados.expires_in) ||
      dados.expires_in <= 0
    ) {
      throw new Error(
        "Mercado Livre: resposta de renovação incompleta; tokens antigos preservados."
      );
    }

    const alteracoes: Record<string, string> = {
      MERCADOLIVRE_ACCESS_TOKEN: dados.access_token,
      MERCADOLIVRE_REFRESH_TOKEN: dados.refresh_token,
      MERCADOLIVRE_TOKEN_EXPIRES_AT: String(agora + dados.expires_in * 1000)
    };
    if (typeof dados.user_id === "number" && Number.isSafeInteger(dados.user_id)) {
      alteracoes.MERCADOLIVRE_USER_ID = String(dados.user_id);
    }

    const destinoTemp = caminho + "." + randomBytes(6).toString("hex") + ".tmp";
    try {
      await writeFile(destinoTemp, atualizarVariaveisArquivo(conteudo, alteracoes), {
        encoding: "utf8",
        mode: 0o600
      });
      await rename(destinoTemp, caminho);
    } finally {
      await rm(destinoTemp, { force: true });
    }

    for (const [chave, valor] of Object.entries(alteracoes)) {
      process.env[chave] = valor;
    }
    console.log("Mercado Livre: token renovado e credenciais atualizadas.");
    return dados.access_token;
  } finally {
    await destravar();
  }
}

/**
 * O refresh token do Mercado Livre só pode ser utilizado uma vez.
 * A trava por arquivo e a releitura do .env protegem processos no mesmo PC.
 */
export async function obterTokenMercadoLivreValido(
  opcoes: OpcoesTokenMercadoLivre = {}
): Promise<string> {
  const caminho = resolve(opcoes.envPath ?? ".env");
  const atual = renovacoes.get(caminho);
  if (atual) return atual;

  const promessa = renovarToken(caminho, opcoes);
  renovacoes.set(caminho, promessa);
  try {
    return await promessa;
  } finally {
    if (renovacoes.get(caminho) === promessa) {
      renovacoes.delete(caminho);
    }
  }
}
