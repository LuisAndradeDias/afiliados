import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  permitirTesteTecnicoLink,
  validarUrlProdutoTesteMercadoLivre,
  type CondicoesTesteLink
} from "../src/painel/dominios/mercadolivre-link-diagnostico.js";

test("teste tecnico aceita apenas URLs oficiais de produtos e remove rastreio", () => {
  assert.deepEqual(validarUrlProdutoTesteMercadoLivre(
    "https://www.mercadolivre.com.br/p/MLB123456?tracking=1#aba"
  ), {
    produtoId: "MLB123456",
    urlProduto: "https://www.mercadolivre.com.br/p/MLB123456"
  });
  assert.deepEqual(validarUrlProdutoTesteMercadoLivre(
    "https://www.mercadolivre.com.br/ssd-kingston/p/MLB123456"
  ), {
    produtoId: "MLB123456",
    urlProduto: "https://www.mercadolivre.com.br/p/MLB123456"
  });
  assert.deepEqual(validarUrlProdutoTesteMercadoLivre(
    "https://produto.mercadolivre.com.br/MLB-987654321-fone-bluetooth-_JM?source=share"
  ), {
    produtoId: "MLB987654321",
    urlProduto: "https://produto.mercadolivre.com.br/MLB-987654321-fone-bluetooth-_JM"
  });
});

test("teste tecnico rejeita lojas externas, shortlinks, portas, credenciais e rotas nao produto", () => {
  const bad = [
    "",
    "http://www.mercadolivre.com.br/p/MLB123",
    "https://www.mercadolivre.com.br.evil.test/p/MLB123",
    "https://meli.la/abc",
    "https://www.mercadolivre.com.br/sec/abc",
    "https://www.mercadolivre.com.br/busca/air-fryer",
    "https://www.mercadolivre.com.br/p/MLB123/checkout",
    "https://user:pass@www.mercadolivre.com.br/p/MLB123",
    "https://www.mercadolivre.com.br:8443/p/MLB123",
    "https://www.mercadolivre.com.br/p/MLBTEST",
    "https://www.mercadolivre.com.br/" + "a".repeat(1050)
  ];
  for (const invalid of bad) {
    assert.throws(() => validarUrlProdutoTesteMercadoLivre(invalid), Error, invalid.slice(0, 50));
  }
});

test("somente estado integralmente seguro permite diagnostico, nunca autoenvio", () => {
  const ok: CondicoesTesteLink = {
    pausado: true,
    semEnvioAutomatico: true,
    semMonitoramento: true,
    semWhatsappEmExecucao: true,
    semPedidoAnterior: true,
    extensaoConectada: true
  };
  assert.equal(permitirTesteTecnicoLink(ok), true);
  for (const field of Object.keys(ok) as Array<keyof CondicoesTesteLink>) {
    assert.equal(
      permitirTesteTecnicoLink({ ...ok, [field]: false }),
      false,
      "Must fail closed on " + field
    );
  }
});

test("resposta tecnica do link nao chama persistencia nem WhatsApp", async () => {
  const source = await readFile("src/painel/server.ts", "utf8");
  const handler = source.indexOf("if (mercadoLivreLinkJob.diagnostico)");
  const productionSave = source.indexOf("const oferta = await salvarLinkAfiliadoMercadoLivre(link);", handler);
  assert.ok(handler > 0 && productionSave > handler);
  const branch = source.slice(handler, productionSave);
  assert.match(branch, /normalizarLinkAfiliadoMercadoLivre\(link\)/);
  assert.match(branch, /status: "done"/);
  assert.match(branch, /return;/);
  assert.doesNotMatch(branch, /writeFile\(|prepararMercadoLivreAutomaticamente\(|salvarLinkAfiliadoMercadoLivre\(/);
  assert.match(source, /mercadoLivreTesteLinkJob:/);
  assert.match(source, /TESTE_LINK_SEM_ENVIO/);
});
