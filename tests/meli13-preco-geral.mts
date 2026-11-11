import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {DatabaseSync} from "node:sqlite";
import {PrecoGeralMarketplaceStore,type PoliticaFonteMarketplace} from "../src/historico/preco-geral-marketplace.js";
import type {PrecoMarketplaceMeli12} from "../src/historico/mercadolivre-sale-price.js";

const NOW="2026-11-11T18:00:00Z";
const licenca:PoliticaFonteMarketplace={
  registro:"licenca_revisada_FIXTURE_20261111",
  fonte:"mercadolivre_sale_price",
  escopo:"preco_geral_marketplace",
  verificadaPorResponsavel:true,aprovada:true,
  retencaoDias:30,validoAteUtc:"2026-12-11T18:00:00Z"
};
const base:PrecoMarketplaceMeli12={
  itemId:"MLB123456789",
  titulo:"ITEM INTERNO FICTICIO",
  vendedorId:"sellerTeste",
  varianteId:"varianteA",
  contexto:"channel_marketplace",
  moeda:"BRL",
  centavos:28990,
  precoRegularCentavos:32990,
  referenciaOficialUtc:"2026-11-11T17:58:00Z",
  observadoEmUtc:NOW,
  modalidadePagamento:"nao_informada",
  disponibilidade:"indeterminada",
  podeCompararComoDesconto:false,
  podePublicar:false,
  proveniencia:"resposta_sale_price_validada"
};

test("sem autorizacao nao grava nem consulta precos",()=>{
  const h=new PrecoGeralMarketplaceStore();
  try{
    assert.throws(()=>h.registrar([base],null,NOW),/autorizacao/);
    assert.equal(h.contar(),0);
    assert.deepEqual(h.consultar(null,NOW),[]);
    assert.deepEqual(h.consultar({...licenca,aprovada:false as true},NOW),[]);
  }finally{h.fechar();}
});
test("nao aceita licenca vencida, fora de escopo ou nao revisada",()=>{
  const h=new PrecoGeralMarketplaceStore();
  try{
    for(const p of [
      {...licenca,validoAteUtc:"2026-11-10T12:00:00Z"},
      {...licenca,escopo:"pix" as "preco_geral_marketplace"},
      {...licenca,verificadaPorResponsavel:false as true},
      {...licenca,retencaoDias:365},
      {...licenca,fonte:"pagina_scraping" as "mercadolivre_sale_price"}
    ]){
      assert.throws(()=>h.registrar([base],p,NOW));
    }
    assert.equal(h.contar(),0);
  }finally{h.fechar();}
});
test("retorno conserva contexto geral; nunca atribui Pix, cartao, estoque ou oferta",()=>{
  const h=new PrecoGeralMarketplaceStore();
  try{
    assert.deepEqual(h.registrar([base],licenca,NOW),{inseridas:1,repetidas:0});
    const all=h.consultar(licenca,NOW);
    assert.equal(all.length,1);
    assert.equal(all[0].itemId,base.itemId);
    assert.equal(all[0].contexto,"channel_marketplace");
    assert.equal(all[0].modalidadePagamento,"nao_informada");
    assert.equal(all[0].disponibilidade,"indeterminada");
    assert.equal(all[0].serie.length,1);
    assert.deepEqual(all[0].serie[0],{
      observadoEmUtc:"2026-11-11T18:00:00.000Z",
      referenciaOficialUtc:"2026-11-11T17:58:00.000Z",
      centavos:28990,precoRegularCentavos:32990,
      disponibilidade:"indeterminada",modalidadePagamento:"nao_informada",
      podePublicar:false,podeCompararComoDesconto:false
    });
    for(const campo of ["pix","cartao","envioPermitido","linkAfiliado"]){
      assert.equal(Object.hasOwn(all[0],campo),false);
    }
  }finally{h.fechar();}
});
test("repeticao exata e idempotente; conflito de preco recusa sobrescrita",()=>{
  const h=new PrecoGeralMarketplaceStore();
  try{
    assert.equal(h.registrar([base],licenca,NOW).inseridas,1);
    assert.equal(h.registrar([{...base,observadoEmUtc:"2026-11-11T18:00:00.000Z"}],licenca,NOW).repetidas,1);
    assert.throws(()=>h.registrar([{...base,centavos:27990}],licenca,NOW),/conflitantes/);
    assert.throws(()=>h.registrar([{...base,precoRegularCentavos:35000}],licenca,NOW),/conflitantes/);
    assert.equal(h.contar(),1);
    assert.equal(h.consultar(licenca,NOW)[0].serie[0].centavos,28990);
  }finally{h.fechar();}
});
test("batch com conflito desfaz tambem insercao anterior na mesma transacao",()=>{
  const h=new PrecoGeralMarketplaceStore();
  try{
    h.registrar([base],licenca,NOW);
    assert.throws(()=>h.registrar([
      {...base,observadoEmUtc:"2026-11-11T17:00:00Z",referenciaOficialUtc:"2026-11-11T16:58:00Z"},
      {...base,centavos:20000}
    ],licenca,NOW),/conflitantes/);
    assert.equal(h.contar(),1);
  }finally{h.fechar();}
});
test("separa item, vendedor, variante e concessoes mesmo com instante igual",()=>{
  const h=new PrecoGeralMarketplaceStore();
  const licenca2={...licenca,registro:"licenca_revisada_FIXTURE_B"};
  try {
    const lote=[
      base,
      {...base,vendedorId:"outroSeller",centavos:14500},
      {...base,varianteId:"outraVariante",centavos:12500},
      {...base,itemId:"MLB999888777",centavos:11500}
    ];
    assert.equal(h.registrar(lote,licenca,NOW).inseridas,4);
    assert.equal(h.registrar([base],licenca2,NOW).inseridas,1);
    assert.equal(h.consultar(licenca,NOW).length,4);
    assert.equal(h.consultar(licenca2,NOW).length,1);
    assert.equal(h.contar(),5);
    assert.equal(h.revogarRegistro(licenca.registro),4);
    assert.equal(h.contar(),1);
    assert.equal(h.consultar(licenca2,NOW).length,1);
  }finally{h.fechar();}
});
test("rejeita tipos/marcações que confundiriam oferta real e preço Pix/cartão",()=>{
  const h=new PrecoGeralMarketplaceStore();
  try {
    for(const altered of [
      {...base,modalidadePagamento:"pix"},
      {...base,modalidadePagamento:"cartao"},
      {...base,disponibilidade:"confirmada"},
      {...base,podePublicar:true},
      {...base,podeCompararComoDesconto:true},
      {...base,proveniencia:"html_sem_autorizacao"},
      {...base,contexto:"user_type_business"},
      {...base,moeda:"USD"},
      {...base,centavos:0},
      {...base,precoRegularCentavos:0}
    ]){
      assert.throws(()=>h.registrar([altered as PrecoMarketplaceMeli12],licenca,NOW),
        /nao confiavel/);
    }
    assert.equal(h.contar(),0);
  }finally{h.fechar();}
});
test("rejeita tempo futuro, referencia antiga, data impossivel e titulo invalido",()=>{
  const h=new PrecoGeralMarketplaceStore();
  try{
    for(const altered of [
      {...base,observadoEmUtc:"2026-11-12T18:00:00Z"},
      {...base,referenciaOficialUtc:"2026-11-12T18:00:00Z"},
      {...base,referenciaOficialUtc:"2026-11-07T00:00:00Z"},
      {...base,observadoEmUtc:"2026-02-30T18:00:00Z"},
      {...base,titulo:"Nome\ncom controle"}
    ])assert.throws(()=>h.registrar([altered],licenca,NOW));
    assert.equal(h.contar(),0);
  }finally{h.fechar();}
});
test("limite de 80 amostras e lote invalido nao alteram banco",()=>{
  const h=new PrecoGeralMarketplaceStore();
  try{
    assert.throws(()=>h.registrar(Array.from({length:81},()=>base),licenca,NOW),/Limite/);
    assert.throws(()=>h.registrar([
      base,{...base,itemId:"MLB321456987",precoRegularCentavos:-1}
    ],licenca,NOW),/nao confiavel/);
    assert.equal(h.contar(),0);
  }finally{h.fechar();}
});
test("persistencia SQLite ao reabrir e migracao nao destrutiva de MELI-11",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"meli13-store-"));
  const file=join(dir,"market.sqlite");
  try{
    const db=new DatabaseSync(file);
    db.exec("CREATE TABLE meli11_obs (legado TEXT);INSERT INTO meli11_obs VALUES ('preservado');");
    db.close();
    const h1=new PrecoGeralMarketplaceStore(file);
    try{h1.registrar([base],licenca,NOW);}finally{h1.fechar();}
    const h2=new PrecoGeralMarketplaceStore(file);
    try{
      assert.equal(h2.consultar(licenca,NOW).length,1);
      assert.equal(h2.registrar([base],licenca,NOW).repetidas,1);
    }finally{h2.fechar();}
    const verificar=new DatabaseSync(file);
    try{
      const old=verificar.prepare("SELECT legado FROM meli11_obs").get() as {legado:string};
      assert.equal(old.legado,"preservado");
      assert.equal((verificar.prepare("SELECT COUNT(*) AS n FROM meli13_preco_geral").get() as {n:number}).n,1);
    }finally{verificar.close();}
  }finally{await rm(dir,{recursive:true,force:true});}
});
test("retencao apaga somente registros da concessao mesmo se licenca venceu",()=>{
  const h=new PrecoGeralMarketplaceStore();
  try{
    h.registrar([base],licenca,NOW);
    assert.equal(h.contar(),1);
    assert.deepEqual(h.consultar(licenca,"2027-01-31T18:00:00Z"),[]);
    assert.equal(h.expurgarRetencao(licenca,"2027-01-31T18:00:00Z"),1);
    assert.equal(h.contar(),0);
  }finally{h.fechar();}
});
test("revogacao por id exclui acervo e nao aceita registro arbitrario",()=>{
  const h=new PrecoGeralMarketplaceStore();
  try{
    h.registrar([base],licenca,NOW);
    assert.throws(()=>h.revogarRegistro("../secrets"),/invalido/);
    assert.equal(h.revogarRegistro(licenca.registro),1);
    assert.equal(h.contar(),0);
    assert.deepEqual(h.consultar(licenca,NOW),[]);
  }finally{h.fechar();}
});
