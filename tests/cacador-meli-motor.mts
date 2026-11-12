import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {CacadorMeli,identidade,type Pauta,type Achado,type FonteInjetada,type Concessao}
  from "../src/cacador/meli-orquestrador.js";
import {analisarRascunhosMeli} from "../src/cacador/meli-revisao.js";
import type {RascunhoMeli} from "../src/painel/mercadolivre-assistido.js";
const start=Date.parse("2026-11-12T12:00:00Z");
const pautas:Pauta[]=[
 {id:"ferramentas",palavraChave:"parafusadeira 21v",categoria:"Ferramentas",interesse:5},
 {id:"informatica",palavraChave:"ssd portátil",categoria:"Informática",interesse:4},
 {id:"casa",palavraChave:"air fryer",categoria:"Eletrodomésticos",interesse:3}
];
const item=(time:number=start,values:Partial<Achado>={}):Achado=>({
 id:"MLB4709979065",titulo:"Parafusadeira de impacto 21 V",
 vendedor:"lojista_01",variante:"21V",modalidade:"cartao",
 precoCentavos:21990,freteCentavos:0,estoqueConfirmado:true,
 observadoEmUtc:new Date(time).toISOString(),...values
});
const licenca:Concessao={
 fonte:"fixture",confirmada:false,escopoPesquisaProdutos:false,
 referenciaEscrita:"",expiraEmUtc:"2020-01-01T00:00:00Z"
};
function mk(
  response:{status:number;itens?:Achado[];retryAfterMs?:number}={status:200,itens:[item()]},
  extra?:{pautas?:Pauta[];fonte?:FonteInjetada;modo?:"laboratorio"|"operacional";
    concessao?:Concessao;time?:{now:number}}
){
 const time=extra?.time??{now:start};
 let n=0;
 const fonte=extra?.fonte??{
  origem:"fixture" as const,consultar:async()=>{n++;return response;}
 };
 const engine=new CacadorMeli({fonte,modo:extra?.modo??"laboratorio",
  concessao:extra?.concessao??licenca,
  pautas:extra?.pautas??pautas,agora:()=>time.now});
 return {engine,time,get calls(){return n}};
}
const rasc=(i:string,mins=10,changes:Partial<RascunhoMeli>={}):RascunhoMeli=>({
 id:i,titulo:"Parafusadeira de impacto 21 V",
 urlProduto:"https://www.mercadolivre.com.br/p/MLB4709979065",
 urlAfiliado:"https://meli.la/abcd1234",
 precoAtual:219.9,precoAnterior:289.9,
 descontoPercentual:24.15,
 origem:"conferencia-manual",
 status:"rascunho-nao-publicado",
 conferidoEm:new Date(start-mins*60_000).toISOString(),
 ...changes
});

test("MELI-15C não instala coletor real por padrão",async()=>{
 const r=mk(undefined,{modo:"operacional"});
 const status=await r.engine.passo();
 assert.equal(status.estado,"sem_permissao");
 assert.equal(status.consultasFeitas,0);
 assert.equal(r.calls,0);
 assert.equal(r.engine.estado().estadoFonte,"nao_autorizada");
 assert.equal(status.publicou,false);
 assert.equal(status.enviouWhatsapp,false);
});
test("laboratório aceita somente fixture, operação exige feed com escopo e prazo",async()=>{
 const fakeFeed={origem:"feed_autorizado" as const,consultar:async()=>({status:200,itens:[item()]})};
 assert.equal((await mk(undefined,{fonte:fakeFeed}).engine.passo()).estado,"sem_permissao");
 const operational=mk(undefined,{modo:"operacional",fonte:fakeFeed,
  concessao:{fonte:"feed_autorizado",confirmada:true,escopoPesquisaProdutos:true,
   referenciaEscrita:"protocolo:docs-oficiais/2026-11-12",expiraEmUtc:"2026-12-01T00:00:00Z"}});
 assert.equal((await operational.engine.passo()).estado,"consultado");
 assert.equal(operational.engine.estado().estadoFonte,"autorizada_declarada");
});
test("concessão expirada ou sem escopo nunca consulta",async()=>{
 for(const c of [
  {...licenca,fonte:"feed_autorizado" as const,confirmada:true,escopoPesquisaProdutos:false,
   referenciaEscrita:"documentacao:oficial",expiraEmUtc:"2027-01-01T00:00:00Z"},
  {...licenca,fonte:"feed_autorizado" as const,confirmada:true,escopoPesquisaProdutos:true,
   referenciaEscrita:"documentacao:oficial",expiraEmUtc:"2026-01-01T00:00:00Z"}
 ]){
  const x=mk(undefined,{modo:"operacional",fonte:{
    origem:"feed_autorizado",consultar:async()=>{throw Error("nunca");}
  },concessao:c});
  assert.equal((await x.engine.passo()).estado,"sem_permissao");
 }
});
test("uma consulta gera memória local sem publicar ou enviar",async()=>{
 const x=mk();
 const r=await x.engine.passo();
 assert.equal(r.estado,"consultado");
 assert.equal(r.recebidos,1);
 assert.equal(r.novos,1);
 assert.equal(r.consultasFeitas,1);
 assert.equal(x.engine.estado().totalIdentidades,1);
 assert.equal(x.engine.estado().totalObservacoes,1);
 assert.equal(r.publicou,false);
 assert.equal(x.calls,1);
});
test("intervalo global de sessenta segundos evita consultas excessivas",async()=>{
 const x=mk();
 await x.engine.passo();
 x.time.now+=15_000;
 const r=await x.engine.passo();
 assert.equal(r.estado,"limite");
 assert.equal(x.calls,1);
 x.time.now+=60_000;
 assert.equal((await x.engine.passo()).estado,"consultado");
 assert.equal(x.calls,2);
});
test("limite de 12 chamadas por hora, mesmo com muitos produtos prioritários",async()=>{
 const p=Array.from({length:15},(_,i)=>({
  id:"pauta_"+i,palavraChave:"produto "+i,categoria:"Ferramentas",interesse:5
 }));
 const x=mk({status:200,itens:[]},{pautas:p});
 for(let i=0;i<12;i++){
  assert.equal((await x.engine.passo()).estado,"consultado");
  x.time.now+=61_000;
 }
 assert.equal(x.calls,12);
 assert.equal((await x.engine.passo()).estado,"limite");
});
test("teto de 60 chamadas por 24h persiste entre horas",async()=>{
 const p=Array.from({length:70},(_,i)=>({
  id:"pauta_"+i,palavraChave:"produto "+i,categoria:"Ferramentas",interesse:5
 }));
 const x=mk({status:200,itens:[]},{pautas:p});
 for(let i=0;i<60;i++){
  const outcome=await x.engine.passo();
  assert.equal(outcome.estado,"consultado","iteration "+i+" "+outcome.estado);
  x.time.now+=6*60_000;
 }
 assert.equal(x.calls,60);
 assert.equal((await x.engine.passo()).estado,"limite");
});
test("401/403 bloqueiam permanentemente a instância, sem retry",async()=>{
 for(const status of [401,403]){
  const x=mk({status, itens:[]});
  const r=await x.engine.passo();
  assert.equal(r.estado,"fonte_bloqueada");
  assert.equal(r.autorizada,true);
  x.time.now+=14*TWENTY_FOUR_HOURS;
  assert.equal((await x.engine.passo()).estado,"fonte_bloqueada");
  assert.equal(x.calls,1);
 }
});
const TWENTY_FOUR_HOURS=86_400_000;
test("429 honra Retry-After e jamais repete no mesmo passo",async()=>{
 const x=mk({status:429,retryAfterMs:3*3600_000});
 assert.equal((await x.engine.passo()).estado,"limite");
 x.time.now+=2*3600_000;
 assert.equal((await x.engine.passo()).estado,"limite");
 assert.equal(x.calls,1);
});
test("5xx e falhas de adaptador ativam descanso progressivo",async()=>{
 const x=mk({status:503},{pautas:[pautas[0]!]});
 assert.equal((await x.engine.passo()).estado,"falha");
 x.time.now+=61_000;
 assert.equal((await x.engine.passo()).estado,"aguardando");
 assert.equal(x.calls,1);
 const y=mk(undefined,{fonte:{origem:"fixture",consultar:async()=>{throw Error("falhou");}}});
 assert.equal((await y.engine.passo()).estado,"falha");
});
test("apenas uma consulta simultânea, inclusive diante de promessa pendente",async()=>{
 let resolve!:(r:{status:number;itens:Achado[]})=>void;
 let n=0;
 const x=mk(undefined,{fonte:{origem:"fixture",
  consultar:async()=>{n++;return await new Promise(r=>{resolve=r;});}
 }});
 const first=x.engine.passo();
 assert.equal((await x.engine.passo()).estado,"ocupado");
 assert.equal(n,1);
 resolve({status:200,itens:[item()]});
 assert.equal((await first).estado,"consultado");
 assert.equal(n,1);
});
test("duplicata mesma identidade e instante não gera nova oferta",async()=>{
 const x=mk({status:200,itens:[item(),item()]});
 const result=await x.engine.passo();
 assert.equal(result.recebidos,2);
 assert.equal(result.novos,1);
 assert.equal(result.repetidos,1);
 assert.equal(x.engine.estado().totalIdentidades,1);
});
test("conflito na mesma data não altera registro anterior",async()=>{
 const x=mk({status:200,itens:[item(),item(start,{precoCentavos:1100})]});
 const result=await x.engine.passo();
 assert.equal(result.novos,1);
 assert.equal(result.bloqueados,1);
 assert.equal(x.engine.observacoes(identidade(item())).length,1);
 assert.equal(x.engine.observacoes(identidade(item()))[0]!.precoCentavos,21990);
});
test("vendedor, variante e modalidade são identidades independentes",async()=>{
 const x=mk({status:200,itens:[item(),
  item(start,{vendedor:"lojista_02"}),
  item(start,{variante:"12V"}),
  item(start,{modalidade:"pix"})]});
 const r=await x.engine.passo();
 assert.equal(r.novos,4);
 assert.equal(x.engine.estado().totalIdentidades,4);
});
test("limite 30 e dados incoerentes são recusados",async()=>{
 const tooMany=mk({status:200,itens:Array.from({length:31},()=>item())});
 assert.equal((await tooMany.engine.passo()).estado,"falha");
 assert.equal(tooMany.engine.estado().totalIdentidades,0);
 const invalid=mk({status:200,itens:[item(start,{id:"MLB-X"}),item(start,{precoCentavos:0}),item()]});
 const r=await invalid.engine.passo();
 assert.equal(r.bloqueados,2);
 assert.equal(r.novos,1);
});
test("pauta e consulta com injeção são recusadas antes de tocar a origem",()=>{
 assert.throws(()=>mk(undefined,{pautas:[{...pautas[0]!,palavraChave:"x\") { kill }"}]}),/pauta/);
 assert.throws(()=>mk(undefined,{pautas:[pautas[0]!,pautas[0]!]}),/duplicada/);
});
test("comparação manual antiga não é histórico de mercado comprovado",()=>{
 const x=analisarRascunhosMeli([rasc("11111111-1111-4111-8111-111111111111")],start);
 assert.equal(x.totais.identidades,1);
 assert.equal(x.totais.revisar,1);
 assert.equal(x.totais.publicaveis,0);
 assert.equal(x.candidatos[0]!.estado,"revisar");
 assert.equal(x.candidatos[0]!.serieHistoricaVerificada,false);
 assert.equal(x.candidatos[0]!.podeEnviar,false);
 assert.match(x.candidatos[0]!.motivos.join(" "),/não comprova queda histórica/);
});
test("revisar -> revalidar -> bloqueado por idade",()=>{
 const a=rasc("11111111-1111-4111-8111-111111111111");
 for(const [age,expected] of [[10,"revisar"],[241,"revalidar"],[3100,"bloqueado"]] as const){
  const panel=analisarRascunhosMeli([{...a,conferidoEm:new Date(start-age*60_000).toISOString()}],start);
  assert.equal(panel.candidatos[0]?.estado,expected);
 }
});
test("dedup do anúncio mantém a observação mais recente",()=>{
 const same=[
  rasc("11111111-1111-4111-8111-111111111111",700),
  rasc("22222222-2222-4222-8222-222222222222",4,{titulo:"Furadeira revisada"})
 ];
 const result=analisarRascunhosMeli(same,start);
 assert.equal(result.totais.registros,2);
 assert.equal(result.totais.identidades,1);
 assert.equal(result.totais.duplicados,1);
 assert.equal(result.candidatos[0]!.titulo,"Furadeira revisada");
});
test("rascunho adulterado não contamina a lista",()=>{
 const valid=rasc("11111111-1111-4111-8111-111111111111");
 const invalid=rasc("22222222-2222-4222-8222-222222222222",9,{urlProduto:"http://evil.invalid"});
 const result=analisarRascunhosMeli([valid,invalid],start);
 assert.equal(result.totais.identidades,1);
 assert.equal(result.totais.bloqueados,1);
 assert.equal(result.candidatos[0]!.podePublicar,false);
});
test("fonte externa do painel sempre desligada, sem envios",()=>{
 const panel=analisarRascunhosMeli([],start);
 assert.equal(panel.fonteExterna.autorizacaoConfirmada,false);
 assert.equal(panel.fonteExterna.buscaAutomaticaAtiva,false);
 assert.equal(panel.guardrails.motorLigado,false);
 assert.equal(panel.guardrails.consultasExternasRealizadas,0);
 assert.equal(panel.guardrails.enviosRealizados,0);
 assert.deepEqual(panel.candidatos,[]);
});
test("código do motor não pode executar fetch ou WhatsApp",async()=>{
 const code=await readFile("src/cacador/meli-orquestrador.ts","utf8");
 assert.doesNotMatch(code,/\bfetch\s*\(|\baxios\b|\brequest\s*\(|sendMessage\s*\(/);
 const panel=await readFile("src/painel/cacador-meli-http.ts","utf8");
 assert.doesNotMatch(panel,/\bfetch\s*\(|sendMessage\s*\(/);
});

test("429 com Retry-After superior a uma semana bloqueia até revisão humana",async()=>{
 const x=mk({status:429,retryAfterMs:14*TWENTY_FOUR_HOURS});
 assert.equal((await x.engine.passo()).estado,"fonte_bloqueada");
 x.time.now+=15*TWENTY_FOUR_HOURS;
 assert.equal((await x.engine.passo()).estado,"fonte_bloqueada");
 assert.equal(x.calls,1);
});
test("resposta nula/malformada de adaptador falha fechada sem reiniciar loop",async()=>{
 const fonte:FonteInjetada={
  origem:"fixture",
  consultar:async()=>null as unknown as {status:number;itens:Achado[]}
 };
 const x=mk(undefined,{fonte});
 assert.equal((await x.engine.passo()).estado,"falha");
 assert.equal(x.engine.estado().totalIdentidades,0);
});
