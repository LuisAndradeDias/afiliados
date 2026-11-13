import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  memoriaClaude,pontuarAchadinhoClaude,titulosParecidosClaude,
  regrasOriginaisClaude,type ObservacaoClaude
} from "../src/ofertas/cacador-claude.js";
import {executar} from "../labs/descoberta/motor.js";
import {ciclosDeLaboratorio} from "../labs/descoberta/fixtures.js";
import {compararComClaude} from "../labs/descoberta/cacador-claude-adapter.js";

const fonte=(ts:string,preco:number,parcial:Partial<ObservacaoClaude>={}):ObservacaoClaude=>({
  id:"MLB_TESTE_123",vendedor:"V1",variante:"A",pagamento:"pix",
  precoCentavos:preco,observadoEmUtc:ts,...parcial
});
const historico=[
  fonte("2026-11-08T12:00:00Z",10000),
  fonte("2026-11-09T12:00:00Z",10000),
  fonte("2026-11-10T12:00:00Z",10000)
];
const atual=fonte("2026-11-12T12:00:00Z",7500);

test("memória do Claude: menor preço comparando somente períodos anteriores",()=>{
  const mem=memoriaClaude(historico,atual);
  assert.equal(mem.periodos,3);
  assert.equal(mem.observacoes,3);
  assert.equal(mem.precoNormalCentavos,10000);
  assert.equal(mem.menorPrecoCentavos,10000);
  assert.equal(mem.veredito,"menor_preco");
  assert.equal(mem.quedaHistoricaPercentual,25);
});
test("não mistura vendedor, variante, pagamento nem observa o próprio preço",()=>{
  const extras=[
    fonte("2026-11-06T12:00:00Z",100,{vendedor:"OUTRO"}),
    fonte("2026-11-07T12:00:00Z",100,{variante:"B"}),
    fonte("2026-11-08T12:00:00Z",100,{pagamento:"cartao"}),
    fonte("2026-11-13T12:00:00Z",100),
    {...atual,precoCentavos:2}
  ];
  const mem=memoriaClaude([...historico,...extras],atual);
  assert.equal(mem.periodos,3);
  assert.equal(mem.observacoes,3);
  assert.equal(mem.precoNormalCentavos,10000);
});
test("janela de 6 h usa o mínimo observado em cada janela",()=>{
  const rows=[
    fonte("2026-11-08T06:00:00Z",14000),
    fonte("2026-11-08T08:00:00Z",12000),
    fonte("2026-11-08T14:00:00Z",16000)
  ];
  const mem=memoriaClaude(rows,fonte("2026-11-09T12:00:00Z",12500));
  assert.equal(mem.periodos,2);
  assert.equal(mem.precoNormalCentavos,14000);
  assert.equal(mem.menorPrecoCentavos,12000);
  assert.equal(mem.veredito,"bom_preco");
});
test("histórico insuficiente nunca afirma queda comprovada",()=>{
  const mem=memoriaClaude(
    [fonte("2026-11-09T12:00:00Z",9000)],
    fonte("2026-11-12T12:00:00Z",3000)
  );
  assert.equal(mem.veredito,"aprendendo");
  assert.equal(mem.periodos,1);
});
test("memória classifica acima do habitual",()=>{
  const mem=memoriaClaude(historico,fonte("2026-11-12T12:00:00Z",11000));
  assert.equal(mem.veredito,"acima");
  const r=pontuarAchadinhoClaude(
    {titulo:"Produto teste",precoCentavos:11000,descontoAnunciadoPercentual:30},mem,
    {...regrasOriginaisClaude,precoMaxCentavos:20000}
  );
  assert.equal(r.podeRevisar,false);
  assert.match(r.motivo,/Acima do preço/);
  assert.equal(r.podePublicar,false);
});
test("desconto inflado de 85% é descartado mesmo com memória boa",()=>{
  const mem=memoriaClaude(historico,atual);
  const r=pontuarAchadinhoClaude({
    titulo:"Produto teste",precoCentavos:7500,descontoAnunciadoPercentual:90
  },mem,{...regrasOriginaisClaude,precoMaxCentavos:20000});
  assert.equal(r.podeRevisar,false);
  assert.match(r.motivo,/suspeito/);
});
test("cupom somente acrescenta pontos se explicitamente confirmado",()=>{
  const mem=memoriaClaude(historico,atual);
  const base={titulo:"Produto teste",precoCentavos:7500,
    descontoAnunciadoPercentual:25,nota:4.8,avaliacoes:300};
  const cfg={...regrasOriginaisClaude,precoMaxCentavos:20000};
  const a=pontuarAchadinhoClaude({...base,cupomConfirmado:false},mem,cfg);
  const b=pontuarAchadinhoClaude({...base,cupomConfirmado:true},mem,cfg);
  assert.equal(b.pontuacao-a.pontuacao,3);
  assert.equal(a.podePublicar,false);
  assert.equal(b.podePublicar,false);
});
test("deduplicação por título é só sugestão, não elimina identidade comercial",()=>{
  assert.equal(titulosParecidosClaude("Furadeira Impacto 21V com Maleta","Furadeira de Impacto 21V Maleta"),true);
  assert.equal(titulosParecidosClaude("Furadeira impacto 21V","Panela de arroz elétrica 5L"),false);
});
test("integração real com LAB-01 fica em simulação e mantém bloqueios",()=>{
  const radar=executar(ciclosDeLaboratorio()).ciclos.at(-1)!;
  const comparativo=compararComClaude(radar.avaliacoes);
  assert.equal(comparativo.etiqueta,"LABORATORIO_OFFLINE_NAO_PUBLICAR");
  assert.equal(comparativo.resumo.total,radar.avaliacoes.length);
  assert.equal(comparativo.resumo.coletasExternas,0);
  assert.equal(comparativo.resumo.mensagensEnviadas,0);
  assert.ok(comparativo.linhas.every(x=>x.podePublicar===false));
  assert.equal(comparativo.resumo.revisar,3);
  for(const x of comparativo.linhas){
    const original=radar.avaliacoes.find(a=>a.chave===x.chave)!;
    if(original.status==="bloqueado")assert.equal(x.estadoComparativo,"bloqueado");
    if(x.estadoComparativo==="revisar")assert.equal(original.status,"revisar");
  }
});
test("pontuação sem sinais de avaliação não inventa rating ou cupom",()=>{
  const m=memoriaClaude(historico,atual);
  const res=pontuarAchadinhoClaude(
    {titulo:"Produto teste",precoCentavos:7500},m,
    {...regrasOriginaisClaude,precoMaxCentavos:20000,pontuacaoMinima:0}
  );
  assert.equal(res.podePublicar,false);
  assert.ok(res.alertas.some(x=>x.includes("Cupom")));
});
test("rejeita sinais comerciais inválidos em vez de alterar nota silenciosamente",()=>{
  const mem=memoriaClaude(historico,atual);
  const cfg={...regrasOriginaisClaude,precoMaxCentavos:20000};
  for(const entrada of [{nota:-1},{nota:6},{avaliacoes:-10},{vendidos:-2}]){
    const r=pontuarAchadinhoClaude({
      titulo:"Produto",precoCentavos:7500,descontoAnunciadoPercentual:20,...entrada
    },mem,cfg);
    assert.equal(r.podeRevisar,false);
  }
});
test("arquivos da ponte offline não contêm execução externa",async()=>{
  for(const arq of [
    "src/ofertas/cacador-claude.ts",
    "labs/descoberta/cacador-claude-adapter.ts"
  ]){
    const txt=await readFile(arq,"utf8");
    assert.ok(!/\bfetch\s*\(|\bspawn\s*\(|\bexec\s*\(|https?:\/\/|\bchromium\b/i.test(txt));
  }
});
