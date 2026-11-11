import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  consultarSalePriceAutorizado,ErroMeli12,
  type DependenciasMeli12,type RespostaSalePriceTransporte
} from "../src/historico/mercadolivre-sale-price.js";

const NOW=Date.parse("2026-11-11T17:00:00Z");
const example={amount:289.90,regular_amount:309.90,
  currency_id:"BRL",reference_date:"2026-11-11T16:58:00Z",
  price_id:"price-1",
  metadata:{promotion_id:"PRIVADO_NAO_UTILIZAR"}};
const approval:NonNullable<DependenciasMeli12["aprovacao"]>={
  status:"confirmado_mercadolivre",appId:"1234567890123456",
  protocolo:"CONSULTA_FIXTURE_123",endpoint:"sale_price",
  escopo:"consulta_anuncios_terceiros_afiliados",permiteTerceiros:true,
  revisadoPorResponsavel:true,validoAteUtc:"2027-01-10T17:00:00Z"
};
const item:DependenciasMeli12["item"]={
  itemId:"MLB4709979065",titulo:"PRODUTO TESTE, NAO PUBLICAR",
  vendedorId:"vendedor_teste_1",varianteId:"padrao",
  origem:"catalogo_autorizado",protocoloFonte:approval.protocolo,
  verificadoEmUtc:"2026-11-11T16:50:00Z"
};
const base=(
  overrides:Partial<DependenciasMeli12>={},
  onRequest?:(input:{url:string;accessToken:string;metodo:string})=>void
):DependenciasMeli12=>({
  aprovacao:approval,item,
  token:async()=>"TOKEN_FIXTURE_NAO_REAL_0001",
  signal:new AbortController().signal,
  transporte:async request=>{
    onRequest?.(request);
    return {status:200,corpo:example};
  },agora:()=>NOW,...overrides
});
async function expectCode(
  props:DependenciasMeli12,
  code:string
):Promise<void>{
  await assert.rejects(()=>consultarSalePriceAutorizado(props),
    (error:unknown)=>error instanceof ErroMeli12 && error.code===code);
}
test("sem aprovacao da plataforma nao invoca token, transporte ou API",async()=>{
  let calls=0;
  await expectCode(base({
    aprovacao:null,
    token:async()=>{calls++;return "fake_token_12345";},
    transporte:async()=>{calls++;return {status:200,corpo:example}}
  }),"MELI12_AGUARDANDO_AUTORIZACAO");
  assert.equal(calls,0);
});
test("aprovacao generica de operador nao equivale a concessao do Mercado Livre",async()=>{
  let requests=0;
  const original=base({transporte:async()=>{requests++;return {status:200,corpo:example}}});
  await expectCode({...original,aprovacao:{...approval,permiteTerceiros:false as true}},
    "MELI12_AGUARDANDO_AUTORIZACAO");
  await expectCode({...original,aprovacao:{...approval,endpoint:"prices" as "sale_price"}},
    "MELI12_AGUARDANDO_AUTORIZACAO");
  await expectCode({...original,aprovacao:{...approval,validoAteUtc:"2026-11-10T17:00:00Z"}},
    "MELI12_AGUARDANDO_AUTORIZACAO");
  assert.equal(requests,0);
});
test("metadados sem proveniencia e item divergente sao barrados antes do token",async()=>{
  let calls=0;
  await expectCode(base({
    item:{...item,protocoloFonte:"OUTRO"},
    token:async()=>{calls++;return "test_token_0001"},
    transporte:async()=>{calls++;return {status:200,corpo:example}}
  }),"MELI12_CADASTRO_INCONSISTENTE");
  await expectCode(base({item:{...item,itemId:"http://localhost"}}),
    "MELI12_CADASTRO_INCONSISTENTE");
  await expectCode(base({item:{...item,verificadoEmUtc:"2026-10-20T00:00:00Z"}}),
    "MELI12_CADASTRO_INCONSISTENTE");
  assert.equal(calls,0);
});
test("monta so URL oficial fixa, GET, contexto marketplace e signal",async()=>{
  let calls=0;
  const input=base({},request=>{
    calls++;
    assert.equal(request.metodo,"GET");
    assert.equal(request.url,
      "https://api.mercadolibre.com/items/MLB4709979065/sale_price?context=channel_marketplace");
    assert.ok(request.accessToken.startsWith("TOKEN_FIXTURE"));
  });
  const value=await consultarSalePriceAutorizado(input);
  assert.equal(calls,1);
  assert.equal(value.centavos,28990);
  assert.equal(value.precoRegularCentavos,30990);
  assert.equal(value.referenciaOficialUtc,"2026-11-11T16:58:00.000Z");
  assert.equal(value.observadoEmUtc,"2026-11-11T17:00:00.000Z");
  assert.equal(value.modalidadePagamento,"nao_informada");
  assert.equal(value.disponibilidade,"indeterminada");
  assert.equal(value.podeCompararComoDesconto,false);
  assert.equal(value.podePublicar,false);
  assert.equal(value.contexto,"channel_marketplace");
  assert.equal("metadata" in value,false,"Metadata privado nao vaza");
});
test("preco marketplace NAO e equiparado automaticamente a Pix ou cartao",async()=>{
  const value=await consultarSalePriceAutorizado(base());
  assert.notEqual(value.modalidadePagamento,"pix");
  assert.notEqual(value.modalidadePagamento,"cartao");
  assert.notEqual(value.disponibilidade,"confirmada");
});
for(const [name,patch] of [
  ["moeda USD",{currency_id:"USD"}],
  ["valor zero",{amount:0}],
  ["valor subcentavo que arredonda a zero",{amount:0.00000001}],
  ["valor fracionario maior que centavo",{amount:299.999}],
  ["preco extremamente alto",{amount:1000000001}],
  ["data futura",{reference_date:"2026-11-12T17:00:00Z"}],
  ["data defasada",{reference_date:"2026-10-01T15:00:00Z"}],
  ["tipo invalido",{amount:"289.90"}]
] as const){
  test("rejeita resposta fora de contrato: "+name,async()=>{
    await expectCode(base({transporte:async()=>({
      status:200,corpo:{...example,...patch}
    })}),"MELI12_PRECO_NAO_VALIDADO");
  });
}
test("regular_amount ausente e permitido mas nunca indica desconto",async()=>{
  const v=await consultarSalePriceAutorizado(base({transporte:async()=>({
    status:200,corpo:{...example,regular_amount:null}
  })}));
  assert.equal(v.precoRegularCentavos,null);
  assert.equal(v.podeCompararComoDesconto,false);
});
for(const [status,codigo] of [
  [401,"MERCADOLIVRE_PERMISSION_REQUIRED"],
  [403,"MERCADOLIVRE_PERMISSION_REQUIRED"],
  [429,"MERCADOLIVRE_RATE_LIMIT"],
  [500,"MERCADOLIVRE_TEMPORARY_ERROR"]
] as const){
  test("mapeia HTTP "+status+" sem revelar o token",async()=>{
    const fakeToken="TOKEN_FIXTURE_NAO_REAL_0001";
    let caught:Error|undefined;
    try {
      await consultarSalePriceAutorizado(base({
        transporte:async()=>({status,corpo:{error:"backend_message",token:fakeToken}})
      }));
    } catch(error) { caught=error as Error; }
    assert.ok(caught instanceof ErroMeli12);
    assert.equal((caught as ErroMeli12).code,codigo);
    assert.doesNotMatch(caught.message,/TOKEN_FIXTURE|backend_message/);
  });
}
test("excecao de transporte sanitizada, mesmo quando contem token e response bruta",async()=>{
  let caught:Error|undefined;
  try{
    await consultarSalePriceAutorizado(base({transporte:async()=>{
      throw new Error("TOKEN_FIXTURE_NAO_REAL_0001 details internos");
    }}));
  }catch(error){caught=error as Error;}
  assert.ok(caught instanceof ErroMeli12);
  assert.equal((caught as ErroMeli12).code,"MERCADOLIVRE_TEMPORARY_ERROR");
  assert.doesNotMatch(caught.message,/TOKEN|details/);
});
test("signal abortado impede qualquer requisicao",async()=>{
  const ctrl=new AbortController();ctrl.abort();
  let calls=0;
  await expectCode(base({signal:ctrl.signal,
    transporte:async()=>{calls++;return {status:200,corpo:example}}
  }),"MELI12_PRECO_NAO_VALIDADO");
  assert.equal(calls,0);
});
test("nao aceita payload gigante nem objeto ilegivel",async()=>{
  for(const body of [{...example,text:"x".repeat(25_000)},[]] as unknown[]){
    const result:RespostaSalePriceTransporte={status:200,corpo:body};
    await expectCode(base({transporte:async()=>result}),"MELI12_PRECO_NAO_VALIDADO");
  }
});

test("a fonte MELI-12 nao e carregada pela Central em producao",async()=>{
  const server=await readFile("src/painel/server.ts","utf8");
  assert.doesNotMatch(server,/mercadolivre-sale-price/);
  const status=await readFile("src/painel/historico-http.ts","utf8");
  assert.doesNotMatch(status,/mercadolivre-sale-price/);
});
