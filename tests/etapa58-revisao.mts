import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile, stat, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  criarFichaRevisao, consultarPainelRevisao
} from "../src/revisao/consulta.js";
import type { DiagnosticoElegibilidadeCanal } from "../src/canais/elegibilidade.js";

const hoje = new Date("2026-10-29T12:00:00.000Z");
const grupo = "GRUPO FICTICIO DO TESTE";
const canalBloqueado: DiagnosticoElegibilidadeCanal = {
  estado: "pendente-verificacao", codigo: "CANAL_NAO_HOMOLOGADO",
  motivo: "Canal ainda não homologado.", podePublicar: false
};
const canalHomologado: DiagnosticoElegibilidadeCanal = {
  estado: "elegivel", codigo: "CANAL_HOMOLOGADO",
  motivo: "Registro de teste.", podePublicar: true
};

function oferta(valor = 120) {
  return {
    plataforma: "Mercado Livre",
    titulo: "Ferramenta fictícia para revisão",
    produtoId: "MLB38053317",
    anuncioId: "MLB3771505959",
    vendedorId: 11223344,
    precoAtual: valor,
    precoContextoStatus: "coerente",
    precoContextoVerificadoEm: "2026-10-29T11:58:00.000Z",
    estoqueDisponivel: 4,
    disponibilidadeConfirmada: true,
    disponibilidadeVerificadaEm: "2026-10-29T11:58:00.000Z",
    urlAfiliado: "https://meli.la/TESTENAO_REAL",
    cupomCodigo: "FICTICIO",
    cupomValidacao: "produto-confirmado",
    cupomConfirmadoEm: "2026-10-29T11:58:00.000Z",
    cupomProdutoIdConfirmado: "MLB38053317",
    cupomAnuncioIdConfirmado: "MLB3771505959",
    cupomFonteConfirmacao: "checkout"
  };
}

function montar(dado: unknown, canal = canalBloqueado, origem:
  "preparacao-whatsapp" | "registro-mercado-livre" = "preparacao-whatsapp") {
  return criarFichaRevisao({
    origem, atualizadoEm: hoje.toISOString(), dado
  }, canal, hoje);
}

async function temporario(fn: (raiz: string) => Promise<void>) {
  const raiz = await mkdtemp(join(tmpdir(), "etapa58-revisao-"));
  try {
    await mkdir(join(raiz, "data"));
    await fn(raiz);
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
}

test("a revisão vazia não inventa candidatos nem registros aprovados", async () => {
  await temporario(async (raiz) => {
    const painel = await consultarPainelRevisao({ raiz, grupo, agora: hoje });
    assert.deepEqual(painel.resumo, {
      candidatos: 0, bloqueados: 0, necessitamRevisao: 0, aprovados: 0
    });
    assert.deepEqual(painel.fichas, []);
    assert.equal(painel.modo, "somente-leitura");
  });
});

test("registros recentes não viram automaticamente promoção aprovada", () => {
  const ficha = montar(oferta(), canalHomologado);
  assert.ok(ficha);
  assert.equal(ficha.decisao.podePublicar, false);
  assert.equal(ficha.decisao.estado, "necessita-revisao");
  assert.equal(ficha.evidencias.find((e) => e.criterio === "preco")?.codigo,
    "PRECO_CONTEXTUAL_REGISTRADO");
  assert.equal(ficha.evidencias.find((e) => e.criterio === "disponibilidade")?.codigo,
    "ESTOQUE_REGISTRADO");
  assert.equal(ficha.evidencias.find((e) => e.criterio === "cupom")?.codigo,
    "CUPOM_CHECKOUT_REGISTRADO");
  assert.equal(ficha.evidencias.find((e) => e.criterio === "atribuicao")?.codigo,
    "ATRIBUICAO_INCONCLUSIVA");
  assert.ok(ficha.decisao.motivos.some((m) =>
    m.codigo === "REVISAO_E_REVALIDACAO_OBRIGATORIAS"));
  assert.doesNotMatch(JSON.stringify(ficha), /TESTENAO_REAL|FICTICIO/);
});

test("sem homologação, canal bloqueia mesmo com preço e cupom salvos", () => {
  const ficha = montar(oferta());
  assert.ok(ficha);
  assert.equal(ficha.decisao.estado, "bloqueada");
  assert.ok(ficha.decisao.motivos.some((m) => m.codigo === "CANAL_NAO_HOMOLOGADO"));
  assert.equal(ficha.decisao.podePublicar, false);
});

test("estoque sem vendedor ou anúncio não é considerado comprovado", () => {
  const semVendedor = montar({ ...oferta(), vendedorId: undefined }, canalHomologado);
  assert.ok(semVendedor);
  assert.equal(semVendedor.evidencias.find((e) => e.codigo === "ESTOQUE_NAO_HOMOLOGADO")?.estado,
    "pendente");
  const semAnuncio = montar({ ...oferta(), anuncioId: undefined }, canalHomologado);
  assert.ok(semAnuncio);
  assert.ok(semAnuncio.evidencias.some((e) => e.codigo === "ANUNCIO_NAO_CONFIRMADO"));
  assert.ok(semAnuncio.evidencias.some((e) => e.codigo === "ESTOQUE_NAO_HOMOLOGADO"));
});

test("preços desatualizados, divergentes ou malformados não são prova", () => {
  const vencido = montar({
    ...oferta(), precoContextoVerificadoEm: "2026-10-29T11:30:00.000Z"
  }, canalHomologado);
  assert.equal(vencido?.evidencias.find((e) => e.criterio === "preco")?.estado, "expirada");
  const divergente = montar({
    ...oferta(), precoContextoStatus: "divergente"
  }, canalHomologado);
  assert.equal(divergente?.decisao.estado, "bloqueada");
  const centavosInvalidos = montar({ ...oferta(), precoAtual: 10.555 }, canalHomologado);
  assert.equal(centavosInvalidos?.evidencias.find((e) => e.criterio === "preco")?.codigo,
    "PRECO_SEM_VALOR_VALIDO");
});

test("revisao aponta link de produto ou anuncio divergente, sem expor URL",()=>{
  for(const [url,tipo] of [
    ["https://www.mercadolivre.com.br/p/MLB99999999","catalogo"],
    ["https://produto.mercadolivre.com.br/MLB-9999999999-outra-oferta-_JM","anuncio"]
  ] as const){
    const ficha=montar({...oferta(),urlAfiliado:url},canalHomologado);
    assert.ok(ficha);
    const evid=ficha.evidencias.find(e=>e.criterio==="link");
    assert.equal(evid?.estado,"divergente",tipo);
    assert.equal(evid?.codigo,"LINK_DESTINO_DIVERGENTE",tipo);
    assert.equal(ficha.decisao.estado,"bloqueada",tipo);
    assert.equal(ficha.decisao.podePublicar,false);
    assert.doesNotMatch(JSON.stringify(ficha),/MLB99999999|MLB-9999999999/);
  }
  const coerente=montar({
    ...oferta(),
    urlAfiliado:"https://www.mercadolivre.com.br/mini-ferramenta/p/MLB38053317"
  },canalHomologado);
  assert.equal(coerente?.evidencias.find(e=>e.criterio==="link")?.codigo,
    "LINK_FORMATO_RECONHECIDO");
  assert.equal(coerente?.decisao.podePublicar,false,
    "Identidade correta de URL nao comprova atribuicao nem libera envio");
});

test("ASIN de outro produto Amazon e porta nao padrao nao sao links reconhecidos",()=>{
  const base={
    ...oferta(),plataforma:"Amazon Brasil",produtoId:"B0AAAAAAA1",
    anuncioId:undefined,
    urlAfiliado:"https://www.amazon.com.br/dp/B0BBBBBBB2?tag=teste-20"
  };
  const outro=montar(base,canalHomologado);
  assert.equal(outro?.evidencias.find(e=>e.criterio==="link")?.codigo,
    "LINK_DESTINO_DIVERGENTE");
  assert.equal(outro?.decisao.estado,"bloqueada");
  assert.equal(outro?.decisao.podePublicar,false);
  assert.doesNotMatch(JSON.stringify(outro),/B0BBBBBBB2|teste-20/);
  const mesmo=montar({...base,
    urlAfiliado:"https://www.amazon.com.br/dp/B0AAAAAAA1?tag=teste-20"
  },canalHomologado);
  assert.equal(mesmo?.evidencias.find(e=>e.criterio==="link")?.codigo,
    "LINK_FORMATO_RECONHECIDO");
  assert.equal(mesmo?.decisao.podePublicar,false);
  const porta=montar({...oferta(),
    urlAfiliado:"https://www.mercadolivre.com.br:8443/p/MLB38053317"
  },canalHomologado);
  assert.equal(porta?.evidencias.find(e=>e.criterio==="link")?.codigo,
    "LINK_NAO_VALIDADO");
  assert.equal(porta?.decisao.estado,"bloqueada");
});

test("cupom antigo e URL falsa não liberam a oferta", () => {
  const ficha = montar({
    ...oferta(), cupomConfirmadoEm: "2026-10-29T11:20:00.000Z",
    urlAfiliado: "https://meli.la.phishing.invalid/TESTE"
  }, canalHomologado);
  assert.ok(ficha);
  assert.ok(ficha.evidencias.some((e) => e.codigo === "CUPOM_NAO_COMPROVADO"));
  assert.ok(ficha.evidencias.some((e) => e.codigo === "LINK_NAO_VALIDADO"));
  assert.equal(ficha.decisao.estado, "bloqueada");
  assert.equal(montar({ ...oferta(), urlAfiliado: "https://www.mercadolivre.com.br/" }, canalHomologado)
    ?.evidencias.find((e) => e.criterio === "link")?.codigo, "LINK_NAO_VALIDADO");
});

test("dados externos nunca entram como HTML nem ampliam o ID", () => {
  const xss = '<img src=x onerror="alert(1)">';
  const ficha = montar({ ...oferta(), titulo: xss.repeat(50) }, canalHomologado);
  assert.ok(ficha);
  assert.equal(ficha.titulo.length, 180);
  assert.ok(ficha.titulo.startsWith("<img"));
  assert.equal(montar({ ...oferta(), produtoId: "../.env" }), null);
  assert.equal(montar({ ...oferta(), plataforma: "Loja não reconhecida" }), null);
});

test("consulta real é somente leitura e não revela links nem cupons", async () => {
  await temporario(async (raiz) => {
    const file = join(raiz, "data", "ultima-oferta-whatsapp.json");
    await writeFile(file, JSON.stringify(oferta()), "utf8");
    const before = await stat(file);
    const original = await readFile(file, "utf8");
    const painel = await consultarPainelRevisao({ raiz, grupo, agora: hoje });
    const after = await stat(file);
    assert.equal(painel.resumo.bloqueados, 1);
    assert.equal(painel.resumo.aprovados, 0);
    assert.equal(painel.fichas[0]?.decisao.podePublicar, false);
    assert.doesNotMatch(JSON.stringify(painel), /meli[.]la\/TESTENAO_REAL|FICTICIO/);
    assert.equal(before.mtimeMs, after.mtimeMs);
    assert.equal(await readFile(file, "utf8"), original);
  });
});

test("fontes idênticas são deduplicadas; preço ou vendedor conflitante é bloqueado", async () => {
  await temporario(async (raiz) => {
    const one = join(raiz, "data", "ultima-oferta-whatsapp.json");
    const two = join(raiz, "data", "ultima-oferta-mercadolivre.json");
    await writeFile(one, JSON.stringify(oferta()), "utf8");
    await writeFile(two, JSON.stringify(oferta()), "utf8");
    const painel1 = await consultarPainelRevisao({ raiz, grupo, agora: hoje });
    assert.equal(painel1.resumo.candidatos, 1);
    assert.ok(painel1.avisos.includes("REGISTRO_DUPLICADO_NAO_SOMADO"));
    await writeFile(two, JSON.stringify({ ...oferta(), vendedorId: 1 }), "utf8");
    const painel2 = await consultarPainelRevisao({ raiz, grupo, agora: hoje });
    assert.equal(painel2.resumo.candidatos, 2);
    assert.equal(painel2.resumo.bloqueados, 2);
    assert.ok(painel2.avisos.includes("REGISTROS_DIVERGENTES_EM_PRECO_OU_VENDEDOR"));
    assert.ok(painel2.fichas.every((f) =>
      f.evidencias.some((e) => e.codigo === "REGISTROS_DIVERGENTES")));
  });
});

test("arquivo corrompido ou muito grande gera aviso, sem falhar ou expor dados", async () => {
  await temporario(async (raiz) => {
    const file = join(raiz, "data", "ultima-oferta-whatsapp.json");
    await writeFile(file, "{malformado", "utf8");
    const invalido = await consultarPainelRevisao({ raiz, grupo, agora: hoje });
    assert.equal(invalido.resumo.candidatos, 0);
    assert.ok(invalido.avisos.includes("ARQUIVO_DE_OFERTA_INACESSIVEL_OU_INVALIDO"));
    await writeFile(file, "X".repeat(140 * 1024), "utf8");
    const enorme = await consultarPainelRevisao({ raiz, grupo, agora: hoje });
    assert.ok(enorme.avisos.includes("ARQUIVO_DE_OFERTA_COM_TAMANHO_INVALIDO"));
    assert.doesNotMatch(JSON.stringify(enorme), /XXXXXX/);
  });
});
