import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {HistoricoMeli11Store,PipelineMeli11,type Permissao,type Observacao} from "../src/historico/meli11.js";

const NOW="2026-11-11T15:00:00Z";
const autorizacao:Permissao={referencia:"suporte_revisado_fixture",
  fonte:"provedor_teste",escopo:"afiliados_autorizados",aprovada:true,retencaoDias:30};
const base:Observacao={
  itemId:"MLB123456789",titulo:"Produto somente de teste",
  vendedorId:"seller111",varianteId:"padrao",pagamento:"pix",moeda:"BRL",
  centavos:15000,observadoEm:"2026-11-09T12:00:00Z",disponibilidade:"confirmada"
};
test("sem autorizacao nao cria banco nem chama fonte externa",async()=>{
  let calls=0;
  const fonte={identificador:"provedor_teste",async coletar(){calls++;return [base];}};
  const p=new PipelineMeli11({fonte,habilitado:true});
  p.iniciar();
  await p.executarUmaVez();
  const s=p.situacao();
  assert.equal(calls,0);
  assert.equal(s.situacao,"aguardando_autorizacao");
  assert.equal(s.coletaHabilitada,false);
  assert.deepEqual(s.itens,[]);
  await p.fechar();
});
test("permissao sem adaptador ou flag nao permite chamada",async()=>{
  let calls=0;
  const fonte={identificador:"provedor_teste",async coletar(){calls++;return [base];}};
  const p=new PipelineMeli11({fonte,permissao:autorizacao,habilitado:false});
  await p.executarUmaVez();
  assert.equal(calls,0);
  assert.equal(p.situacao().coletaHabilitada,false);
  await p.fechar();
  const q=new PipelineMeli11({permissao:autorizacao,habilitado:true});
  await q.executarUmaVez();
  assert.equal(q.situacao().situacao,"aguardando_fonte");
  await q.fechar();
});
test("lote atomico rejeita fonte, horario futuro, centavos invalidos e conflitos",()=>{
  const h=new HistoricoMeli11Store();
  try{
    assert.throws(()=>h.salvarLote([base],null,NOW),/autorizacao/);
    assert.throws(()=>h.salvarLote([base,{...base,centavos:-5,
      observadoEm:"2026-11-10T12:00:00Z"}],autorizacao,NOW),/Cotacao/);
    assert.equal(h.contar(),0);
    assert.throws(()=>h.salvarLote([{...base,observadoEm:"2026-11-12T12:00:00Z"}],
      autorizacao,NOW),/retencao/);
    assert.equal(h.salvarLote([base],autorizacao,NOW).inseridas,1);
    assert.equal(h.salvarLote([base],autorizacao,NOW).repetidas,1);
    assert.throws(()=>h.salvarLote([{...base,centavos:10000}],autorizacao,NOW),/Conflito/);
    assert.equal(h.contar(),1);
  }finally{h.fechar();}
});
test("separa vendedor, variante e modalidades, respeita fonte e licenca",()=>{
  const h=new HistoricoMeli11Store();
  try{
    h.salvarLote([
      base,{...base,vendedorId:"seller222",centavos:22000},
      {...base,varianteId:"outra",centavos:18000},
      {...base,pagamento:"cartao",centavos:17000},
      {...base,observadoEm:"2026-11-10T12:00:00Z",centavos:14500,
        disponibilidade:"indeterminada"}
    ],autorizacao,NOW);
    const items=h.consultar(autorizacao,NOW);
    assert.equal(items.length,3);
    const first=items.find(i=>i.vendedorId==="seller111"&&i.varianteId==="padrao");
    assert.ok(first);
    assert.equal(first.pix.length,2);
    assert.equal(first.cartao.length,1);
    assert.equal(first.pix[1].disponibilidade,"indeterminada");
    assert.deepEqual(h.consultar({...autorizacao,referencia:"outra_licenca"},NOW),[]);
  }finally{h.fechar();}
});
test("persiste em arquivo SQLite entre execucoes e aplica retencao",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"meli11-persistencia-"));
  const arquivo=join(dir,"registros.sqlite");
  try{
    const a=new HistoricoMeli11Store(arquivo);
    try{a.salvarLote([base],autorizacao,NOW);}finally{a.fechar();}
    const b=new HistoricoMeli11Store(arquivo);
    try{
      assert.equal(b.contar(),1);
      assert.equal(b.consultar(autorizacao,NOW).length,1);
      assert.equal(b.expurgar(autorizacao,"2027-01-10T15:00:00Z"),1);
      assert.equal(b.contar(),0);
    }finally{b.fechar();}
  }finally{await rm(dir,{recursive:true,force:true});}
});
test("agendador processa fonte injetada autorizada sem produzir ofertas",async()=>{
  let requests=0;
  const src={identificador:"provedor_teste",
    async coletar(_signal:AbortSignal){requests++;return [base]}};
  const p=new PipelineMeli11({
    fonte:src,permissao:autorizacao,habilitado:true,agora:()=>Date.parse(NOW)
  });
  try{
    await p.executarUmaVez();
    assert.equal(requests,1);
    const s=p.situacao();
    assert.equal(s.situacao,"atualizado");
    assert.equal(s.itens.length,1);
    assert.equal(s.itens[0].pix.length,1);
    assert.equal("ofertaAprovada" in s,false);
    assert.equal("envioWhatsapp" in s,false);
  }finally{await p.fechar();}
});
test("erro 403 trava novas consultas ate revisao de autorizacao",async()=>{
  let requests=0;
  const src={identificador:"provedor_teste",async coletar(){
    requests++;
    throw Object.assign(new Error("acesso negado"),{code:"MERCADOLIVRE_PERMISSION_REQUIRED"});
  }};
  const p=new PipelineMeli11({fonte:src,permissao:autorizacao,habilitado:true,
    agora:()=>Date.parse(NOW)});
  try{
    await p.executarUmaVez();
    assert.equal(p.situacao().situacao,"permissao_negada");
    assert.equal(p.situacao().coletaHabilitada,false);
    p.iniciar();
    await p.executarUmaVez();
    assert.equal(requests,1);
    assert.deepEqual(p.situacao().itens,[]);
  }finally{await p.fechar();}
});
test("erro 429 nao repete imediatamente nem grava preco",async()=>{
  let requests=0;
  const src={identificador:"provedor_teste",async coletar(){
    requests++;
    throw Object.assign(new Error("limite"),{code:"MERCADOLIVRE_RATE_LIMIT"});
  }};
  const p=new PipelineMeli11({fonte:src,permissao:autorizacao,habilitado:true,
    agora:()=>Date.parse(NOW)});
  try{
    p.iniciar();
    await new Promise(resolve=>setTimeout(resolve,25));
    assert.equal(requests,1);
    assert.equal(p.situacao().situacao,"limite_atingido");
  }finally{await p.fechar();}
});
