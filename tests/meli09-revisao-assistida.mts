import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { consultarRevisaoTecnica } from "../src/painel/revisao-http.js";

const NOW = Date.parse("2026-11-09T13:00:00.000Z");
const base = {
  origem:"conferencia-manual",
  status:"rascunho-nao-publicado",
  precoAtual:150,
  precoAnterior:200,
  descontoPercentual:25,
  urlProduto:"https://www.mercadolivre.com.br/p/MLB38053317",
  urlAfiliado:"https://meli.la/link-test"
};
async function ambiente(perform:(dir:string)=>Promise<void>) {
 const dir=await mkdtemp(join(tmpdir(),"meli09-review-"));
 try {await mkdir(join(dir,"data"));await perform(dir);}
 finally {await rm(dir,{recursive:true,force:true});}
}
test("rascunhos manuais aparecem como revisão separada, nunca como oferta aprovada",async()=>{
 await ambiente(async(dir)=>{
  const arquivo=join(dir,"data","mercadolivre-rascunhos-assistidos.json");
  const saved={versao:1,rascunhos:[
   {...base,id:"c4f05a30-f0f5-42ce-b536-38b0922a8871",titulo:"Fone bluetooth novo",conferidoEm:"2026-11-09T12:20:00.000Z"},
   {...base,id:"19ec3658-b7a9-463c-b4aa-38399fa1a36b",titulo:"Furadeira de impacto nova",urlProduto:"https://www.mercadolivre.com.br/p/MLB39000000",urlAfiliado:"https://meli.la/outro",conferidoEm:"2026-11-09T09:30:00.000Z"}
  ]};
  await writeFile(arquivo,JSON.stringify(saved));
  const before=await readFile(arquivo,"utf8");
  const review=await consultarRevisaoTecnica(dir,NOW);
  assert.equal(review.resumo.ofertasObservadas,0,
    "Rascunhos nunca contam como oferta observada/aprovada pelo motor");
  assert.equal(review.resumo.rascunhosAssistidos,2);
  assert.equal(review.resumo.rascunhosParaRever,1);
  assert.equal(review.fichas.length,2);
  assert.equal(review.fichas[0].origem,"rascunho-assistido-meli");
  assert.equal(review.fichas[0].revisaoNecessaria,false);
  assert.equal(review.fichas[1].revisaoNecessaria,true);
  assert.equal(review.fichas[1].link,"https://meli.la/outro");
  assert.equal(review.fichas[1].cupomCodigo,null);
  assert.ok(review.fichas.every(f=>!Object.hasOwn(f,"podePublicar")));
  assert.match(review.fichas[0].verificacoes.map(x=>x.observacao).join(" "),/manualmente|declarad|não validada/i);
  assert.equal(await readFile(arquivo,"utf8"),before,"GET de revisão não altera rascunhos");
 });
});
test("arquivo adulterado não gera ofertas nem conta registros suspeitos",async()=>{
 await ambiente(async(dir)=>{
  const file=join(dir,"data","mercadolivre-rascunhos-assistidos.json");
  await writeFile(file,JSON.stringify({versao:1,rascunhos:[
   {...base,id:"aaa",titulo:"Item forjado",urlAfiliado:"https://fake.example/roubo",
    status:"rascunho-nao-publicado",conferidoEm:"2026-11-09T12:00:00Z"},
   {...base,id:"bbb",titulo:"Produto desatualizado",status:"publicado",
    conferidoEm:"2026-11-09T12:00:00Z"}
  ]}));
  const r=await consultarRevisaoTecnica(dir,NOW);
  assert.equal(r.resumo.rascunhosAssistidos,0);
  assert.equal(r.fichas.length,0);
  assert.ok(r.avisos.some(x=>/rascunho|inconsist/i.test(x)));
 });
});
test("data futura não vale como confirmação recente",async()=>{
 await ambiente(async(dir)=>{
  await writeFile(join(dir,"data","mercadolivre-rascunhos-assistidos.json"),
    JSON.stringify({versao:1,rascunhos:[{
      ...base,id:"5d2e554b-a687-4e90-9900-99ec0c489f19",titulo:"Item exemplo",
      conferidoEm:"2027-01-01T00:00:00.000Z"
    }]}));
  const r=await consultarRevisaoTecnica(dir,NOW);
  assert.equal(r.resumo.rascunhosAssistidos,1);
  assert.equal(r.resumo.rascunhosParaRever,1);
 });
});
