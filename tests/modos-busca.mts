/**
 * Seleção média/longa: limites reproduzíveis e persistência sem tocar OAuth.
 * Totalmente isolado de contas, navegadores e envios.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  lerModoBusca, modoBuscaValido, normalizarModoBusca, orcamentoBusca,
  salvarModoBusca, variaveisBusca
} from "../src/ofertas/modos-busca.js";

const tmp = await mkdtemp(join(tmpdir(),"cpv-modos-busca-"));
const file = join(tmp,"data","config-busca.json");
try {
  assert.equal(modoBuscaValido("media"),true);
  assert.equal(modoBuscaValido("longa"),true);
  for(const valor of ["rapida","curta","infinita","",{},null,42]){
    assert.equal(modoBuscaValido(valor),false);
    assert.equal(normalizarModoBusca(valor),"media");
  }
  assert.equal(lerModoBusca(file),"media","Sem arquivo, o modo original permanece");

  const ambiente = {
    AMAZON_QUERIES_PER_RUN:"4",AMAZON_LIMIT:"20",
    MERCADOLIVRE_QUERIES_PER_RUN:"2",MERCADOLIVRE_LIMIT:"20",
    MERCADOLIVRE_SEARCH_PAGES_PER_QUERY:"2",
    MERCADOLIVRE_PRODUCTS_CHECKED_PER_QUERY:"25",
    MERCADOLIVRE_EXTRA_QUERIES_ON_EMPTY:"2",
    ALTERNATING_MONITOR_SLOT_SECONDS:"60",
    MIN_DISCOUNT_PERCENT:"20", WHATSAPP_AUTO_SEND_ENABLED:"true"
  } as NodeJS.ProcessEnv;
  const antes = { ...ambiente };
  const medio = orcamentoBusca("media",ambiente);
  const longo = orcamentoBusca("longa",ambiente);
  assert.deepEqual(medio,{
    amazonCategorias:4,amazonLimitePorCategoria:20,
    meliCategoriasIniciais:2,meliCategoriasExtrasSemOferta:2,
    meliItensPorPagina:20,meliPaginasPorCategoria:2,meliProdutosPorCategoria:25
  });
  assert.deepEqual(longo,{
    amazonCategorias:6,amazonLimitePorCategoria:20,
    meliCategoriasIniciais:3,meliCategoriasExtrasSemOferta:2,
    meliItensPorPagina:20,meliPaginasPorCategoria:4,meliProdutosPorCategoria:40
  });
  assert.deepEqual(variaveisBusca("media",ambiente),{BUSCA_MODO:"media"},
    "Busca média não sobrescreve a configuração anterior");
  assert.deepEqual(variaveisBusca("longa",ambiente),{
    BUSCA_MODO:"longa", AMAZON_QUERIES_PER_RUN:"6",
    MERCADOLIVRE_QUERIES_PER_RUN:"3",
    MERCADOLIVRE_SEARCH_PAGES_PER_QUERY:"4",
    MERCADOLIVRE_PRODUCTS_CHECKED_PER_QUERY:"40"
  });
  assert.deepEqual(ambiente,antes,"Modo de busca não pode mutar políticas ou env");
  assert.equal(longo.meliCategoriasExtrasSemOferta,medio.meliCategoriasExtrasSemOferta,
    "Busca longa não muda a expansão condicional autorizada");

  const extremos=orcamentoBusca("longa",{
    AMAZON_QUERIES_PER_RUN:"999",
    MERCADOLIVRE_QUERIES_PER_RUN:"999",
    MERCADOLIVRE_SEARCH_PAGES_PER_QUERY:"5",
    MERCADOLIVRE_PRODUCTS_CHECKED_PER_QUERY:"60"
  } as NodeJS.ProcessEnv);
  assert.ok(extremos.amazonCategorias <= 18);
  assert.ok(extremos.meliCategoriasIniciais <= 17);
  assert.ok(extremos.meliPaginasPorCategoria <=5);
  assert.ok(extremos.meliProdutosPorCategoria <=60);
  await salvarModoBusca(file,"longa");
  assert.equal(lerModoBusca(file),"longa");
  assert.deepEqual(JSON.parse(await readFile(file,"utf8")),{modo:"longa"});
  assert.deepEqual((await readdir(join(tmp,"data"))),["config-busca.json"],
    "Não criar arquivos de operação ou temporários residuais");
  await salvarModoBusca(file,"media");
  assert.equal(lerModoBusca(file),"media");
  await writeFile(file,'{"modo":"invalido"}',"utf8");
  assert.equal(lerModoBusca(file),"media","Configuração inválida é fail-safe");
  console.log("MODOS_BUSCA_OK: perfis, limites, persistência atômica e sem alterar credenciais/ritmo.");
}finally{
  await rm(tmp,{recursive:true,force:true});
}
