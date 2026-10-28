import test from "node:test";
import assert from "node:assert/strict";
import type { Oferta } from "../src/fontes/types.js";
import {
  avaliarCupomParaDivulgacao,
  removerCupomNaoConfirmado
} from "../src/ofertas/cupons-politica.js";

const agora=Date.parse("2026-10-28T14:00:00.000Z");
const data=(minutos:number)=>new Date(agora+minutos*60_000).toISOString();

function oferta(parcial:Partial<Oferta>={}):Oferta {
  return {
    plataforma:"Mercado Livre",produtoId:"MLB38053317",
    anuncioId:"MLB3771505959",titulo:"Produto de teste",
    precoAtual:142.74,precoAnterior:299.90,descontoPercentual:52,
    urlProduto:"https://www.mercadolivre.com.br/p/MLB38053317",
    encontradoEm:new Date(agora),
    cupom:"Cupom TESTE2026: 10% OFF",cupomCodigo:"TESTE2026",
    cupomPercentual:10,cupomCompraMinima:100,
    cupomDescontoMaximo:30,cupomValidoAte:data(60),
    cupomColetadoEm:data(-4),cupomValidacao:"produto-confirmado",
    cupomConfirmadoEm:data(-2),cupomProdutoIdConfirmado:"MLB38053317",
    cupomAnuncioIdConfirmado:"MLB3771505959",cupomFonteConfirmacao:"checkout",
    precoComCupomEstimado:128.47,descontoEfetivoPercentual:57,
    ...parcial
  } as Oferta;
}

test("cupom com evidencia recente do mesmo produto/anuncio permite anuncio",()=>{
  const avaliacao=avaliarCupomParaDivulgacao(oferta(),agora);
  assert.equal(avaliacao.situacao,"confirmado");
  assert.equal(avaliacao.podeAnunciar,true);
  assert.equal(removerCupomNaoConfirmado(oferta(),agora).cupomCodigo,"TESTE2026");
});

test("cupom generico so e condicionado, nunca preco garantido",()=>{
  const item=oferta({
    cupomValidacao:"catalogo-oficial-estimado",
    cupomConfirmadoEm:undefined,
    cupomFonteConfirmacao:undefined
  });
  assert.equal(avaliarCupomParaDivulgacao(item,agora).situacao,"condicionado");
  const limpo=removerCupomNaoConfirmado(item,agora);
  assert.equal(limpo.cupomCodigo,undefined);
  assert.equal(limpo.precoComCupomEstimado,undefined);
  assert.equal(limpo.descontoEfetivoPercentual,52);
  assert.equal(limpo.precoAtual,142.74);
});

test("cupom expirado, identificador diferente ou checkout nao confirmado bloqueia",()=>{
  const falhas:Partial<Oferta>[]=[
    {cupomValidoAte:data(-1)},
    {cupomConfirmadoEm:data(-11)},
    {cupomConfirmadoEm:data(2)},
    {cupomProdutoIdConfirmado:"MLBOUTRO"},
    {cupomAnuncioIdConfirmado:"MLBOUTRO"},
    {cupomFonteConfirmacao:undefined},
    {cupomValidacao:"catalogo-oficial-estimado"},
    {cupomCodigo:"<>"},
    {precoComCupomEstimado:150},
    {precoComCupomEstimado:0}
  ];
  for(const falha of falhas){
    const item=oferta(falha);
    const status=avaliarCupomParaDivulgacao(item,agora);
    assert.equal(status.podeAnunciar,false,JSON.stringify(falha));
    const limpo=removerCupomNaoConfirmado(item,agora);
    assert.equal(limpo.cupomCodigo,undefined,JSON.stringify(falha));
    assert.equal(limpo.precoAtual,142.74);
  }
});

test("nenhum cupom e seguro por padrao",()=>{
 const item=oferta({cupomCodigo:undefined,cupom:undefined});
 assert.equal(avaliarCupomParaDivulgacao(item,agora).situacao,"ausente");
 assert.equal(avaliarCupomParaDivulgacao(item,agora).podeAnunciar,false);
});
