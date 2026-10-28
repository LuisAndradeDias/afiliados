import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  investigarCatalogoSemVencedor
} from "../src/fontes/mercadolivre/investigacao-sem-vencedor.js";
import type { DetalheCatalogoDisponibilidade }
  from "../src/fontes/mercadolivre/disponibilidade.js";

const produtoId = "MLB38053317";
const semVencedor: DetalheCatalogoDisponibilidade = {
  id: produtoId, status: "active", buy_box_winner: null
};
const valid = (id: string, seller_id = 111, price = 140.60, stock: number | null = 3) => ({
  item_id: id, seller_id, price, status:"active",
  condition:"new", currency_id:"BRL",
  available_quantity: stock
});
const headers = {"content-type":"application/json"};
const reply = (body:unknown,status=200) => new Response(JSON.stringify(body),{
  status,headers
});
const sample = [
  valid("MLB1111111111",111,140.60,3),
  valid("MLB2222222222",222,148.00,0),
  valid("MLB3333333333",333,179.90,null)
];

test("CATALOGO ativo com 3 anuncios: apenas pistas, jamais escolhe vendedor",async()=>{
  const seen: string[]=[];
  const probe = await investigarCatalogoSemVencedor(
    produtoId,semVencedor,"TOKEN_FICTICIO",{
      fetchImpl: (async(url:RequestInfo|URL, init?:RequestInit)=>{
        seen.push(String(url));
        assert.equal(init?.method,"GET");
        assert.equal(new Headers(init?.headers).get("authorization"),"Bearer TOKEN_FICTICIO");
        assert.ok(init?.signal);
        return reply({results:sample,paging:{total:3}});
      }) as typeof fetch
    }
  );
  assert.deepEqual(seen,["https://api.mercadolibre.com/products/"+produtoId+"/items"]);
  assert.equal(probe.status,"pendente_revisao");
  assert.equal(probe.motivo,"PUBLICACOES_SEM_VENCEDOR");
  assert.equal(probe.publicacoesObservadas,3);
  assert.equal(probe.candidatasComDadosMinimos,2,
    "Anuncio com estoque zero nao tem dados minimos validos");
  assert.equal(probe.candidatasComEstoqueDeclarado,1);
  assert.equal(probe.vencedorConfirmado,false);
  assert.equal(probe.precoConfirmado,false);
  assert.equal(probe.estoqueNaPaginaConfirmado,false);
  assert.equal(probe.modalidadePagamentoConfirmada,false);
  assert.equal(probe.cupomAplicavelConfirmado,false);
  assert.equal(probe.envioPermitido,false);
  const serialized=JSON.stringify(probe);
  assert.doesNotMatch(serialized,/TOKEN_FICTICIO|MLB1111|MLB2222|MLB3333|seller_id|Bearer|http/);
  assert.doesNotMatch(serialized,/140\.60|148|179\.90/);
});

test("sem resultados: nao presumir indisponibilidade do site",async()=>{
  const probe=await investigarCatalogoSemVencedor(produtoId,semVencedor,"TESTE",{
    fetchImpl:(async()=>reply({results:[]})) as typeof fetch
  });
  assert.equal(probe.motivo,"NENHUMA_PUBLICACAO_OBSERVADA");
  assert.equal(probe.publicacoesObservadas,0);
  assert.equal(probe.envioPermitido,false);
  assert.equal(probe.estoqueNaPaginaConfirmado,false);
});

test("dados invalidos, duplicados, novos e estoques sao classificados sem preco inventado",async()=>{
  const entries=[
    valid("MLB1111111111",111,140.60,2),
    valid("MLB1111111111",111,140.60,2),
    valid("MLB2222222222",222,148,null),
    valid("MLB3333333333",333,148.005,3),
    valid("MLB4444444444",444,148,0),
    valid("MLB5555555555",555,148,2),
    {...valid("MLB6666666666"),condition:"used"},
    {...valid("MLB7777777777"),currency_id:"USD"},
    {...valid("MLB8888888888"),seller_id:1.5},
    {...valid("MLB9999999999"),status:"paused"}
  ];
  const result=await investigarCatalogoSemVencedor(produtoId,semVencedor,"TESTE",{
    fetchImpl:(async()=>reply({results:entries})) as typeof fetch
  });
  assert.equal(result.publicacoesObservadas,9);
  assert.equal(result.candidatasComDadosMinimos,3);
  assert.equal(result.candidatasComEstoqueDeclarado,2);
  assert.equal(result.amostraLimitada,false);
  assert.equal(result.envioPermitido,false);
});

test("listagem de itens ruins nunca resulta em vendedor confirmado",async()=>{
  const result=await investigarCatalogoSemVencedor(produtoId,semVencedor,"TESTE",{
    fetchImpl:(async()=>reply({results:[
      {...valid("MLB1111111111"),seller_id:null},
      {...valid("MLB2222222222"),price:NaN},
      {...valid("MLB3333333333"),condition:"used"}
    ]})) as typeof fetch
  });
  assert.equal(result.motivo,"PUBLICACOES_DADOS_INCOMPLETOS");
  assert.equal(result.candidatasComDadosMinimos,0);
  assert.equal(result.envioPermitido,false);
});

test("429 nunca repete nem tenta contornar limite",async()=>{
  let count=0;
  const r=await investigarCatalogoSemVencedor(produtoId,semVencedor,"TESTE",{
    fetchImpl:(async()=>{count++;return reply({error:"429"},429);}) as typeof fetch
  });
  assert.equal(count,1);
  assert.equal(r.motivo,"LISTAGEM_LIMITE_429");
  assert.equal(r.publicacoesObservadas,undefined);
  assert.equal(r.envioPermitido,false);
});

test("403, 401, 404, 500, json malformado e erro de rede sao inconclusivos",async()=>{
  const cases=[
    [401,"LISTAGEM_SEM_PERMISSAO"],
    [403,"LISTAGEM_SEM_PERMISSAO"],
    [404,"LISTAGEM_NAO_ENCONTRADA"],
    [500,"LISTAGEM_HTTP_INDISPONIVEL"]
  ] as const;
  for(const [status,reason]of cases) {
    const r=await investigarCatalogoSemVencedor(produtoId,semVencedor,"TESTE",{
      fetchImpl:(async()=>reply({error:"sensivel"},status)) as typeof fetch
    });
    assert.equal(r.motivo,reason);
    assert.equal(r.envioPermitido,false);
  }
  const badJson=await investigarCatalogoSemVencedor(produtoId,semVencedor,"TESTE",{
    fetchImpl:(async()=>new Response("INVALIDO", {status:200,headers})) as typeof fetch
  });
  assert.equal(badJson.motivo,"LISTAGEM_FORMATO_INVALIDO");
  for(const input of [null,[],{}, {results:null}, {results:"fake"}]) {
    const r=await investigarCatalogoSemVencedor(produtoId,semVencedor,"TESTE",{
      fetchImpl:(async()=>reply(input)) as typeof fetch
    });
    assert.equal(r.motivo,"LISTAGEM_FORMATO_INVALIDO",JSON.stringify(input));
  }
  const fail=await investigarCatalogoSemVencedor(produtoId,semVencedor,"TESTE",{
    fetchImpl:(async()=>{throw new Error("Bearer SEGREDO_EXPOSICAO");}) as typeof fetch
  });
  assert.equal(fail.motivo,"LISTAGEM_REDE_INDISPONIVEL");
  assert.doesNotMatch(JSON.stringify(fail),/SEGREDO_EXPOSICAO|Bearer/);
});

test("catálogo invalido, ativo com vencedor, token invalido: nenhum GET externo",async()=>{
  const forbidden=(async()=>{throw new Error("NAO_DEVE_CHAMAR");}) as typeof fetch;
  const invalid=await investigarCatalogoSemVencedor(
    "MLB1010101010",semVencedor,"TESTE",{fetchImpl:forbidden}
  );
  assert.equal(invalid.motivo,"CATALOGO_INCONSISTENTE");
  const hasWinner=await investigarCatalogoSemVencedor(produtoId,{
    ...semVencedor,
    buy_box_winner:{item_id:"MLB1111111111",seller_id:123,price:148,
      condition:"new",available_quantity:1}
  },"TESTE",{fetchImpl:forbidden});
  assert.equal(hasWinner.motivo,"VENCEDOR_PRESENTE_NAO_APLICAVEL");
  const noToken=await investigarCatalogoSemVencedor(produtoId,semVencedor,"",{
    fetchImpl:forbidden
  });
  assert.equal(noToken.motivo,"LISTAGEM_SEM_PERMISSAO");
});

test("limite de amostra nao confunde contagem parcial com total",async()=>{
  const big=Array.from({length:70},(_,i)=>valid("MLB"+String(1_000_000_000+i),i+1));
  const r=await investigarCatalogoSemVencedor(produtoId,semVencedor,"TESTE",{
    fetchImpl:(async()=>reply({results:big,paging:{total:99999}})) as typeof fetch
  });
  assert.equal(r.amostraLimitada,true);
  assert.equal(r.publicacoesObservadas,60);
  assert.equal(r.candidatasComDadosMinimos,60);
  assert.equal(r.envioPermitido,false);
});

test("o diagnostico continua sem selecao automatica nem mensagem",async()=>{
  const script=await readFile("src/robo/mercadolivre-preco-diagnostico.ts","utf8");
  const core=await readFile("src/fontes/mercadolivre/investigacao-sem-vencedor.ts","utf8");
  assert.doesNotMatch(core,/sort\(|price_to_win|Whatsapp|click\(|checkout|writeFile\(/i);
  assert.match(core,/buy_box_winner/);
  assert.match(script,/CATALOGO_ATIVO_SEM_VENCEDOR_OFICIAL/);
  assert.match(script,/await investigarCatalogoSemVencedor\(/);
  assert.match(script,/investigacaoSemVencedor,/);
  assert.match(script,/catalogoProdutoCorrespondente:criteriosCatalogo\?\.idCatalogoCorrespondente === true/);
  assert.doesNotMatch(script,/enviarWhatsApp\(|publicarOferta\(|checkout\(/);
});

test("descoberta periodica contabiliza buy box ausente sem criar oferta",async()=>{
  const source=await readFile("src/fontes/mercadolivre/api.ts","utf8");
  assert.match(source,/catalogosAtivosSemVencedor\s*\+=\s*1/);
  assert.match(source,/!catalogo\.buy_box_winner/);
  assert.match(source,/catalogos-ativos-sem-vencedor=/);
  assert.match(source,/if \(catalogo\.id === produto\.id && catalogo\.status === "active"/);
});
