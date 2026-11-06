import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
 validarRascunhoMeli, criarRepositorioMeli, ErroRascunhoMeli
} from "../src/painel/mercadolivre-assistido.js";

const valid = {
 titulo:"Fone Bluetooth original", urlProduto:"https://www.mercadolivre.com.br/p/MLB38053317",
 urlAfiliado:"https://meli.la/abc123xyz",precoAtual:"149,90",precoAnterior:"199,90",
 confirmacoes:{preco:true,disponibilidade:true,reputacaoVerde:true,linkAfiliado:true}
};
const e=(changes:Record<string,unknown>)=>({...valid,...changes});
const throws=(data:unknown, exp:RegExp)=>assert.throws(()=>validarRascunhoMeli(data),exp);
const item=validarRascunhoMeli(valid);
assert.equal(item.descontoPercentual,25.01);
assert.equal(item.precoAtual,149.9);
assert.equal(item.precoAnterior,199.9);
assert.equal(item.urlProduto,"https://www.mercadolivre.com.br/p/MLB38053317");
assert.equal(item.urlAfiliado,"https://meli.la/abc123xyz");
assert.equal(validarRascunhoMeli(e({precoAtual:"80,00",precoAnterior:"100,00"})).descontoPercentual,20,
  "Desconto exatamente de 20% é permitido");
throws(e({titulo:"Fone Bluetooth produto indisponível"}),/indispon|estoque|esgotado/i);
throws(e({titulo:"Fone Bluetooth estoque esgotado"}),/indispon|estoque|esgotado/i);
throws(e({precoAnterior:"170,00"}),/20%|desconto/i);
throws(e({urlProduto:"https://www.mercadolivre.com.br/ofertas"}),/produto|an[úu]ncio/i);
throws(e({urlProduto:"https://mercadolivre.com.br.evil.test/p/MLB38053317"}),/dom[ií]nio|Mercado Livre/i);
throws(e({urlProduto:"https://mercadolivre.com.br/"}),/produto|an[úu]ncio/i);
throws(e({urlProduto:"http://www.mercadolivre.com.br/p/MLB38053317"}),/HTTPS/i);
throws(e({urlAfiliado:"https://www.mercadolivre.com.br/p/MLB38053317"}),/link oficial|afiliado|meli.la/i);
throws(e({confirmacoes:{...valid.confirmacoes,disponibilidade:false}}),/confirme|disponibilidade/i);
throws(e({confirmacoes:{...valid.confirmacoes,reputacaoVerde:false}}),/reputa/i);
throws(e({confirmacoes:{...valid.confirmacoes,linkAfiliado:false}}),/afiliado/i);
throws(e({confirmacoes:{...valid.confirmacoes,preco:false}}),/pre[çc]o/i);
throws(e({titulo:""}),/t[ií]tulo/i);
throws(e({precoAtual:"-4"}),/pre[çc]o/i);
throws(e({precoAtual:"0"}),/pre[çc]o/i);
throws(e({precoAtual:"1.000.000,00"}),/pre[çc]o/i);

const dir=await mkdtemp(join(tmpdir(),"cpv-meli08-draft-"));
const file=join(dir,"data","mercadolivre-rascunhos-assistidos.json");
try{
 const repo=criarRepositorioMeli(file);
 assert.deepEqual(await repo.listar(),[]);
 const saved=await repo.salvar(valid);
 assert.match(saved.id,/^[0-9a-f-]{36}$/);
 assert.equal(saved.status,"rascunho-nao-publicado");
 assert.equal(saved.origem,"conferencia-manual");
 assert.equal(saved.descontoPercentual,25.01);
 assert.equal(saved.titulo,valid.titulo);
 const contents=JSON.parse(await readFile(file,"utf8"));
 assert.equal(contents.versao,1);
 assert.equal(contents.rascunhos.length,1);
 assert.ok(!JSON.stringify(contents).match(/access_token|refresh_token|senha/i));
 await assert.rejects(repo.salvar(valid),(err:any)=>err instanceof ErroRascunhoMeli && /cadastrado|existente/i.test(err.message));
 const list=await criarRepositorioMeli(file).listar();
 assert.equal(list.length,1);
 assert.equal(await repo.excluir("00000000-0000-0000-0000-000000000000"),false);
 assert.equal(await repo.excluir(saved.id),true);
 assert.deepEqual(await repo.listar(),[]);
 assert.deepEqual(await readdir(join(dir,"data")),["mercadolivre-rascunhos-assistidos.json"]);
 await writeFile(file,'{"quebrado":true}');
 await assert.rejects(repo.listar(),/arquivo|rascunho|corrompido/i);
 console.log("MELI08_RASCUNHOS_OK: validação comercial, origem manual, arquivo isolado, deduplicação, sem envios.");
}finally{
 await rm(dir,{recursive:true,force:true,maxRetries:4,retryDelay:100});
}
