/** Seleção assistida: guarda apenas rascunhos; não promove para o motor de envio. */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { normalizarLinkAfiliadoMercadoLivre } from "../afiliados/mercadolivre.js";
import { DESCONTO_MINIMO_PERCENTUAL } from "../ofertas/regras-autorizadas.js";
import { textoDeIndisponibilidade } from "../fontes/mercadolivre/selecao.js";

export class ErroRascunhoMeli extends Error {
  constructor(mensagem: string, readonly statusCode = 400) {
    super(mensagem);
    this.name = "ErroRascunhoMeli";
  }
}

export interface DadosRascunhoMeli {
  titulo: string;
  urlProduto: string;
  urlAfiliado: string;
  precoAtual: number;
  precoAnterior: number;
  descontoPercentual: number;
}
export interface RascunhoMeli extends DadosRascunhoMeli {
  id: string;
  origem: "conferencia-manual";
  status: "rascunho-nao-publicado";
  conferidoEm: string;
}

export function urlProdutoIndividual(input: unknown): string {
  if (typeof input !== "string" || input.length > 2048) {
    throw new ErroRascunhoMeli("Informe o link HTTPS de um produto específico do Mercado Livre.");
  }
  let u: URL;
  try { u = new URL(input.trim()); }
  catch { throw new ErroRascunhoMeli("Link de produto inválido."); }
  const hostname = u.hostname.toLowerCase();
  if (u.protocol !== "https:" || u.port || u.username || u.password) {
    throw new ErroRascunhoMeli("Use somente links HTTPS de produtos do Mercado Livre.");
  }
  if (hostname !== "mercadolivre.com.br" &&
      !hostname.endsWith(".mercadolivre.com.br")) {
    throw new ErroRascunhoMeli("O domínio do produto precisa ser o Mercado Livre.");
  }
  if (!/^\/p\/MLB[0-9]+(?:\/|$)/i.test(u.pathname) &&
      !/^\/MLB-[0-9]+(?:-|\/|$)/i.test(u.pathname)) {
    throw new ErroRascunhoMeli(
      "Use uma página de produto ou anúncio individual, nunca busca/categoria/ofertas."
    );
  }
  u.search = "";u.hash = "";
  return u.toString();
}

function precoBR(valor: unknown): number {
  if (typeof valor !== "string" && typeof valor !== "number") {
    throw new ErroRascunhoMeli("Preço inválido. Use valores em reais.");
  }
  const s = String(valor).trim();
  if (!/^[0-9]{1,6}(?:[.,][0-9]{1,2})?$/.test(s)) {
    throw new ErroRascunhoMeli("Preço inválido. Digite sem separador de milhar.");
  }
  const p = Number(s.replace(",", "."));
  if (!Number.isFinite(p) || p <= 0 || p > 999999.99) {
    throw new ErroRascunhoMeli("Preço deve ser um valor positivo em reais.");
  }
  return Math.round(p * 100) / 100;
}

export function validarRascunhoMeli(entrada: unknown): DadosRascunhoMeli {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) {
    throw new ErroRascunhoMeli("Dados de oferta inválidos.");
  }
  const d = entrada as Record<string, unknown>;
  const titulo = typeof d.titulo === "string"
    ? d.titulo.trim().replace(/\s+/g, " ") : "";
  if (titulo.length < 5 || titulo.length > 160 || /[\x00-\x1f\x7f]/.test(titulo)) {
    throw new ErroRascunhoMeli("Informe um título entre 5 e 160 caracteres.");
  }
  if (textoDeIndisponibilidade(titulo)) {
    throw new ErroRascunhoMeli("Produto indisponível ou com estoque esgotado.");
  }
  const confirmations = d.confirmacoes;
  const c = confirmations && typeof confirmations === "object" &&
    !Array.isArray(confirmations) ? confirmations as Record<string, unknown> : {};
  if (c.preco !== true) {
    throw new ErroRascunhoMeli("Confirme o preço no produto antes de salvar.");
  }
  if (c.disponibilidade !== true) {
    throw new ErroRascunhoMeli("Confirme a disponibilidade no anúncio antes de salvar.");
  }
  if (c.reputacaoVerde !== true) {
    throw new ErroRascunhoMeli("Confirme a reputação verde do vendedor.");
  }
  if (c.linkAfiliado !== true) {
    throw new ErroRascunhoMeli("Confirme que gerou o link afiliado pela sua conta.");
  }

  const urlProduto = urlProdutoIndividual(d.urlProduto);
  let urlAfiliado: string;
  try { urlAfiliado = normalizarLinkAfiliadoMercadoLivre(String(d.urlAfiliado ?? "")); }
  catch { throw new ErroRascunhoMeli("Informe o link oficial de afiliado (meli.la ou /sec/)."); }
  const affiliate = new URL(urlAfiliado);
  if (affiliate.username || affiliate.password || affiliate.port) {
    throw new ErroRascunhoMeli("Link oficial de afiliado inválido.");
  }
  const precoAtual = precoBR(d.precoAtual);
  const precoAnterior = precoBR(d.precoAnterior);
  const atualCentavos = Math.round(precoAtual * 100);
  const anteriorCentavos = Math.round(precoAnterior * 100);
  const percentual = (anteriorCentavos - atualCentavos) / anteriorCentavos * 100;
  if (anteriorCentavos <= atualCentavos ||
      atualCentavos * 100 > anteriorCentavos * (100 - DESCONTO_MINIMO_PERCENTUAL)) {
    throw new ErroRascunhoMeli(
      `O desconto deve ser de pelo menos ${DESCONTO_MINIMO_PERCENTUAL}% com preço anterior confirmado.`
    );
  }
  return {
    titulo, urlProduto, urlAfiliado, precoAtual, precoAnterior,
    descontoPercentual: Math.round(percentual * 100) / 100
  };
}

function erroArquivo(): ErroRascunhoMeli {
  return new ErroRascunhoMeli(
    "Arquivo local de rascunhos Mercado Livre indisponível ou corrompido.", 500
  );
}

export function criarRepositorioMeli(caminho: string) {
  let pendente: Promise<unknown> = Promise.resolve();
  async function ler(): Promise<RascunhoMeli[]> {
    let texto: string;
    try {
      if ((await stat(caminho)).size > 128 * 1024) throw erroArquivo();
      texto = await readFile(caminho, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw erroArquivo();
    }
    try {
      const data = JSON.parse(texto) as unknown;
      if (!data || typeof data !== "object" || Array.isArray(data)) throw Error("formato");
      const envelope = data as {versao?:unknown;rascunhos?:unknown};
      if (envelope.versao !== 1 || !Array.isArray(envelope.rascunhos) ||
          envelope.rascunhos.length > 100 ||
          envelope.rascunhos.some((x:unknown) =>
            !x || typeof x !== "object" || typeof (x as RascunhoMeli).id !== "string" ||
            typeof (x as RascunhoMeli).urlProduto !== "string" ||
            typeof (x as RascunhoMeli).urlAfiliado !== "string" ||
            (x as RascunhoMeli).status !== "rascunho-nao-publicado"
          )) throw Error("formato");
      return envelope.rascunhos as RascunhoMeli[];
    } catch { throw erroArquivo(); }
  }
  async function gravar(items:RascunhoMeli[]) {
    const temp = caminho+"."+randomUUID()+".tmp";
    try {
      await mkdir(dirname(caminho),{recursive:true});
      await writeFile(temp,JSON.stringify({versao:1,rascunhos:items},null,2),{
        encoding:"utf8",mode:0o600
      });
      await rename(temp,caminho);
    } finally {
      await rm(temp,{force:true}).catch(()=>undefined);
    }
  }
  function serial<T>(f:()=>Promise<T>):Promise<T> {
    const result=pendente.then(f);
    pendente=result.catch(()=>undefined);
    return result;
  }
  return {
    listar:()=>serial(ler),
    salvar:(payload:unknown)=>serial(async()=>{
      const data=validarRascunhoMeli(payload);
      const all=await ler();
      if(all.some(x=>x.urlProduto===data.urlProduto||x.urlAfiliado===data.urlAfiliado)){
        throw new ErroRascunhoMeli("Produto ou link já cadastrado.");
      }
      if(all.length>=100)throw new ErroRascunhoMeli("Limite local de 100 rascunhos atingido.",409);
      const item:RascunhoMeli={
        id:randomUUID(),...data,origem:"conferencia-manual",
        status:"rascunho-nao-publicado",conferidoEm:new Date().toISOString()
      };
      await gravar([item,...all]);
      return item;
    }),
    excluir:(id:string)=>serial(async()=>{
      const items=await ler();
      const outros=items.filter(x=>x.id!==id);
      if(outros.length===items.length)return false;
      await gravar(outros);
      return true;
    })
  };
}
