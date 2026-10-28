import test from "node:test";
import assert from "node:assert/strict";
import { auditarDestinoLinkMercadoLivre } from "../src/afiliados/mercadolivre-destino.js";

const short="https://meli.la/ABCD1234";
const target="MLB38053317";
function redirect(location:string,status=302): Response {
  return new Response(null,{status,headers:{location}});
}
test("redirect HEAD manual em dominio oficial confirma apenas o mesmo catalogo",async()=>{
  const called:string[]=[];
  const result=await auditarDestinoLinkMercadoLivre(short,target,{
    fetcher:(async(input: RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);
      called.push(url);
      assert.equal(init?.method,"HEAD");
      assert.equal(init?.redirect,"manual");
      assert.equal(init?.credentials,"omit");
      if(url===short) return redirect("https://www.mercadolivre.com.br/parafusadeira-e-furadeira-impacto/p/MLB38053317?utm_source=partner");
      throw new Error("Unexpected fetch");
    }) as typeof fetch
  });
  assert.deepEqual(called,[short]);
  assert.equal(result.estado,"confirmado");
  assert.equal(result.atribuicaoComprovada,false);
  assert.equal(result.saltos,1);
  assert.ok(!JSON.stringify(result).includes(short));
});

test("catalogo divergente, host externo e protocolo nao HTTPS nunca sao consultados",async()=>{
  const cases=[
    "https://www.mercadolivre.com.br/qualquer-produto/p/MLB99999999",
    "https://phishing.example/roubo",
    "https://nao-oficial.meli.la/p/MLB38053317",
    "http://www.mercadolivre.com.br/p/MLB38053317"
  ];
  for(const url of cases){
    let calls=0;
    const result=await auditarDestinoLinkMercadoLivre(short,target,{
      fetcher:(async()=>{
        calls++;
        return redirect(url);
      }) as typeof fetch
    });
    assert.equal(calls,1);
    assert.equal(result.estado,"divergente");
    assert.equal(result.atribuicaoComprovada,false);
  }
});

test("HTTP 403, timeout, URL opaca ou redirecionamento circular nunca comprovam",async()=>{
  for(const response of [
    new Response(null,{status:403}),
    new Response(null,{status:200}),
    redirect(short)
  ]){
    const result=await auditarDestinoLinkMercadoLivre(short,target,{
      fetcher:(async()=>response) as typeof fetch
    });
    assert.equal(result.estado,"inconclusivo");
    assert.equal(result.atribuicaoComprovada,false);
  }
  const expired=await auditarDestinoLinkMercadoLivre(short,target,{
    fetcher:(async()=>{throw new Error("network blocked")}) as typeof fetch
  });
  assert.equal(expired.estado,"inconclusivo");
});

test("shortlink sem produto identificavel nao comprova atribuição",async()=>{
  const result=await auditarDestinoLinkMercadoLivre(short,target,{
    fetcher:(async()=>redirect("https://www.mercadolivre.com.br/social/click?matt_tool=123")) as typeof fetch
  });
  assert.equal(result.estado,"inconclusivo");
  assert.equal(result.atribuicaoComprovada,false);
});
