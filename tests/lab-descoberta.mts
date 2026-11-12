import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {executar,chave} from "../labs/descoberta/motor.js";
import {ciclosDeLaboratorio} from "../labs/descoberta/fixtures.js";
import {simularOrquestrador,fontesSimuladas} from "../labs/descoberta/orquestrador.js";

const input=ciclosDeLaboratorio();
const report=executar(input);
const ultimo=report.ciclos.at(-1)!;
const by=(id:string)=>ultimo.avaliacoes.find(x=>x.chave.includes(id))!;

test("laboratorio 100% simulado, sem autorizacao falsa nem envio",()=>{
 assert.equal(report.etiqueta,"SIMULACAO_SEM_DADOS_REAIS");
 assert.equal(report.resumo.ciclos,4);
 assert.equal(report.resumo.enviosRealizados,0);
 assert.equal(report.resumo.coletaMeliApiRealizada,0);
 assert.equal(report.resumo.origensAutomaticasReais,0);
 assert.ok(ultimo.avaliacoes.every(x=>!x.podePublicar&&!x.fonteRealAutorizada));
});
test("quatro ciclos com simulacao de polling, deduplicacao e rejeicao",()=>{
 assert.equal(report.resumo.recebidas,44);
 assert.equal(report.resumo.aceitas,41);
 assert.equal(report.resumo.repetidas,1);
 assert.equal(report.resumo.rejeitadas,2);
 assert.equal(ultimo.recebidas,14);
 assert.equal(ultimo.aceitas,11);
 assert.equal(ultimo.repetidas,1);
 assert.equal(ultimo.rejeitadas,2);
 assert.equal(report.ciclos[0]!.revisao,0);
 assert.equal(report.ciclos[1]!.revisao,0);
 assert.equal(report.ciclos[2]!.revisao,0);
});
test("so 3 ofertas boas vao para revisao humana, nenhuma para publicacao",()=>{
 assert.equal(ultimo.revisao,3);
 const aprovados=ultimo.avaliacoes.filter(x=>x.status==="revisar");
 assert.deepEqual(new Set(aprovados.map(x=>x.canal)),new Set(["Amazon","Shopee"]));
 assert.ok(aprovados.every(x=>x.historicoReferencias>=3));
 assert.ok(aprovados.every(x=>x.reducaoPercentual!==null&&x.reducaoPercentual>=10));
 assert.deepEqual(
  new Set(aprovados.map(x=>x.chave.split("|")[1])),
  new Set(["AMZ_DEMO_SSD1TB","SHP_DEMO_AFRY4L","SHP_DEMO_PHONE"])
 );
});
test("queda usa 3 observacoes previas comparaveis e frete, nunca preco riscado",()=>{
 const s=by("AMZ_DEMO_SSD1TB");
 assert.equal(s.precoReferenciaCentavos,34990);
 assert.equal(s.precoTotalCentavos,27990);
 assert.equal(s.reducaoPercentual,20);
 const a=by("SHP_DEMO_AFRY4L");
 assert.equal(a.precoReferenciaCentavos,23990);
 assert.equal(a.precoTotalCentavos,17990);
 assert.equal(a.reducaoPercentual,25);
 assert.equal(a.status,"revisar");
});
test("cupom nao verificado nao altera preco; cupom confirmado so em fixture e estimado",()=>{
 const air=by("SHP_DEMO_AFRY4L");
 assert.equal(air.cupomStatus,"nao-verificado");
 assert.equal(air.custoEstimadoComCupomCentavos,17990);
 assert.equal(air.cupomDescontoEstimadoCentavos,0);
 const phone=by("SHP_DEMO_PHONE");
 assert.equal(phone.cupomStatus,"simulado-valido");
 assert.equal(phone.precoTotalCentavos,129900);
 assert.equal(phone.cupomDescontoEstimadoCentavos,3000);
 assert.equal(phone.custoEstimadoComCupomCentavos,126900);
 assert.ok(phone.razoes.some(x=>x.includes("checkout")));
 assert.equal(phone.podePublicar,false);
});
test("API do MELI não pode ser fonte de descoberta no laboratório",()=>{
 const meli=by("MLB_DEMO_TOOL01");
 assert.equal(meli.canal,"Mercado Livre");
 assert.equal(meli.origem,"fixture-meli-curadoria");
 assert.equal(meli.status,"bloqueado");
 assert.ok(meli.razoes.some(x=>x.includes("Estoque")));
 assert.equal(ultimo.fontes.meliAssistido,1);
});
test("variante mudada não aproveita histórico do produto antigo",()=>{
 const x=ultimo.avaliacoes.filter(o=>o.chave.includes("SHP_DEMO_CHARGER"));
 assert.equal(x.length,2);
 assert.equal(x.find(x=>x.variante==="45W")?.status,"acompanhar");
 assert.equal(x.find(x=>x.variante==="45W")?.precoReferenciaCentavos,null);
 assert.equal(x.find(x=>x.variante==="65W")?.status,"bloqueado");
});
test("preco atipico, frete desconhecido, estoque e observacao antiga bloqueiam",()=>{
 for(const key of ["AMZ_DEMO_MONITOR","SHP_DEMO_SHOE",
  "SHP_DEMO_PAN","AMZ_DEMO_MOUSE"]){
  assert.equal(by(key).status,"bloqueado",key);
 }
 assert.ok(by("AMZ_DEMO_MONITOR").razoes.some(x=>x.includes("atípica")));
 assert.ok(by("SHP_DEMO_SHOE").razoes.some(x=>x.includes("Frete")));
 assert.ok(by("AMZ_DEMO_MOUSE").razoes.some(x=>x.includes("desatualizada")));
});
test("item novo e preco sem queda nao competem com boas oportunidades",()=>{
 assert.equal(by("AMZ_DEMO_KEYBOARD").status,"acompanhar");
 assert.equal(by("AMZ_DEMO_KEYBOARD").historicoReferencias,0);
 assert.equal(by("AMZ_DEMO_SPEAKER").status,"acompanhar");
 assert.equal(by("AMZ_DEMO_SPEAKER").reducaoPercentual,0);
});
test("mutacao de entradas apos reexecucao nao altera historico armazenado",()=>{
 const copy=ciclosDeLaboratorio();
 const a=executar(copy);
 copy[0]!.observacoes[0]!.precoCentavos=10;
 assert.equal(a.ciclos.at(-1)!.avaliacoes.find(x=>x.chave.includes("SSD1TB"))?.precoReferenciaCentavos,34990);
});
test("fonte falsificada, preco invalido ou parcela arbitraria nao aprovada",()=>{
 const list=ciclosDeLaboratorio();
 list[3]!.observacoes.push({
  ...list[3]!.observacoes[0]!,
  id:"A_MALICIOUS",origem:"fixture-meli-curadoria",
  precoCentavos:400
 });
 const result=executar(list);
 assert.equal(result.resumo.rejeitadas,3);
 assert.ok(!result.ciclos.at(-1)!.avaliacoes.some(x=>x.chave.includes("A_MALICIOUS")));
});
test("ordem de ciclos e vencimento de timestamps validados",()=>{
 assert.throws(()=>executar([input[2]!,input[1]!]),/ordem/);
 assert.throws(()=>executar([]),/ciclos/);
 const list=ciclosDeLaboratorio();
 list[0]!.observacoes[0]!.observadoEmUtc="2026-11-31T12:00:00Z";
 const resp=executar(list);
 assert.equal(resp.resumo.rejeitadas,3);
});
test("motor e fixtures nao fazem requisicoes externas nem envios",async()=>{
 const arquivos=[
  "labs/descoberta/motor.ts",
  "labs/descoberta/fixtures.ts",
  "labs/descoberta/orquestrador.ts"
 ];
 for(const arquivo of arquivos){
  const txt=await readFile(arquivo,"utf8");
  assert.doesNotMatch(txt,/\bfetch\s*\(|\baxios\b|\bhttps?\.get\s*\(|\bplaywright\b|\bsendMessage\s*\(/i);
 }
});
test("chave de identidade inclui vendedor, variante e pagamento",()=>{
 const a=input[0]!.observacoes[0]!;
 assert.notEqual(chave(a),chave({...a,vendedor:"vendedor2"}));
 assert.notEqual(chave(a),chave({...a,variante:"256GB"}));
 assert.notEqual(chave(a),chave({...a,pagamento:"pix"}));
});

test("orquestrador consulta tres fontes de fixture por ciclo, sem API real",async()=>{
 const r=await simularOrquestrador();
 assert.equal(r.coletasSimuladas,12);
 assert.equal(r.falhasDeFonte,0);
 assert.deepEqual(r.relatorio.resumo,report.resumo);
 assert.equal(r.relatorio.ciclos.at(-1)?.revisao,3);
});
test("adaptador nao autorizado nao pode ser ativado, nem uma vez",async()=>{
 const fontes=fontesSimuladas();
 let chamadas=0;
 fontes[0]={...fontes[0]!,modo:"live" as "fixture",coletar:async()=>{
  chamadas++;return [];
 }};
 await assert.rejects(()=>simularOrquestrador(fontes),/Somente três fontes fixture/);
 assert.equal(chamadas,0);
});
test("resposta contaminada de uma fonte é descartada sem afetar as outras",async()=>{
 const fontes=fontesSimuladas();
 fontes[0]={...fontes[0]!,coletar:async(i)=>{
  const rows=await fontesSimuladas()[0]!.coletar(i);
  return rows.map(o=>({...o,origem:"fixture-shopee-afiliados" as const}));
 }};
 const r=await simularOrquestrador(fontes);
 assert.equal(r.falhasDeFonte,4);
 assert.equal(r.relatorio.resumo.enviosRealizados,0);
 assert.ok(r.relatorio.resumo.aceitas<41);
 assert.ok(r.relatorio.ciclos.at(-1)?.avaliacoes.every(x=>x.canal!=="Amazon"));
});
