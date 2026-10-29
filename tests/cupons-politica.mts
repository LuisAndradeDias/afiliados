import assert from "node:assert/strict";
import test from "node:test";
import type { Oferta } from "../src/fontes/types.js";
import { avaliarCupomParaDivulgacao, removerCupomNaoConfirmado } from "../src/ofertas/cupons-politica.js";
import { aplicarMelhorCupomMercadoLivre, cupomAtivo,
  extrairCuponsMercadoLivre, type CupomMercadoLivre } from "../src/afiliados/mercadolivre-cupons.js";
import { formatarOfertaWhatsapp } from "../src/mensagens/whatsapp.js";
import { calcularScorePromocao } from "../src/ofertas/score.js";

const agora = Date.now();
const data = (offset: number) => new Date(agora + offset).toISOString();
const base: Oferta = {
  plataforma:"Mercado Livre", produtoId:"MLB38053317", anuncioId:"MLB3771505959",
  titulo:"Parafusadeira The Black Tools", precoAtual:142.74, precoAnterior:299.9,
  descontoPercentual:52, urlProduto:"https://www.mercadolivre.com.br/p/MLB38053317",
  encontradoEm:new Date()
};
const baseSemDesconto: Oferta = {
  ...base, precoAnterior: undefined, descontoPercentual: 0
};
const voucher: CupomMercadoLivre = {
  codigo:"PROMO2026", percentual:10, compraMinima:99, descontoMaximo:50,
  validoDe:data(-20*60_000), validoAte:data(60*60_000),
  coletadoEm:data(-5*60_000), naoCumulativo:true,
  somenteItensElegiveis:true, termos:"Cupom com condicoes",
  origem:"mercadolivre-promocoes"
};

test("cupom oficial permanece candidato, jamais premio confirmado automaticamente",()=>{
  assert.equal(cupomAtivo(voucher,agora),true);
  const candidato=aplicarMelhorCupomMercadoLivre(baseSemDesconto,[voucher]);
  assert.equal(candidato.cupomCodigo,"PROMO2026");
  assert.equal(candidato.cupomValidacao,"catalogo-oficial-estimado");
  assert.equal(avaliarCupomParaDivulgacao(candidato,agora).situacao,"condicionado");
  assert.equal(calcularScorePromocao(candidato),calcularScorePromocao(baseSemDesconto));
  const texto=formatarOfertaWhatsapp(candidato);
  assert.doesNotMatch(texto,/PROMO2026|Se eleg.vel no checkout|Cupom:/i);
  assert.match(texto,/142,74/);
  assert.equal(removerCupomNaoConfirmado(candidato).cupomCodigo,undefined);
});

test("cache antigo, periodo ausente ou data invalida nunca habilitam cupom",()=>{
  assert.equal(cupomAtivo({...voucher,coletadoEm:data(-31*60_000)},agora),false);
  assert.equal(cupomAtivo({...voucher,validoAte:undefined},agora),false);
  assert.equal(cupomAtivo({...voucher,validoDe:undefined},agora),false);
  assert.equal(cupomAtivo({...voucher,validoAte:data(-1)},agora),false);
  assert.equal(cupomAtivo({...voucher,coletadoEm:data(2000)},agora),false);
  assert.equal(aplicarMelhorCupomMercadoLivre(base,[
    {...voucher,coletadoEm:data(-31*60_000)}
  ]).cupomCodigo,undefined);
  assert.equal(aplicarMelhorCupomMercadoLivre(base,[
    {...voucher,validoAte:undefined}
  ]).cupomCodigo,undefined);
});

test("parser extrai validade, compra minima, limite e nao cumulatividade sem corrupcao",()=>{
  const html=[
    "<section><h2>Cupom TESTE2026</h2>",
    "Cupom v&aacute;lido de 28/10/26 at&eacute; &agrave;s 23h59 ou at&eacute; atingir",
    "o limite de 1.000 cupons.",
    "Desconto de at&eacute; 12% em compra a partir de R$ 129,00,",
    "desconto m&aacute;ximo de R$ 60,00 v&aacute;lido para itens eleg&iacute;veis.",
    "Cupom n&atilde;o cumulativo com outros benef&iacute;cios.</section>"
  ].join(" ");
  const parsed=extrairCuponsMercadoLivre(html);
  assert.equal(parsed.length,1);
  assert.equal(parsed[0].codigo,"TESTE2026");
  assert.equal(parsed[0].percentual,12);
  assert.equal(parsed[0].compraMinima,129);
  assert.equal(parsed[0].descontoMaximo,60);
  assert.equal(parsed[0].limiteCupons,1000);
  assert.equal(parsed[0].naoCumulativo,true);
  assert.equal(parsed[0].somenteItensElegiveis,true);
  assert.match(parsed[0].validoAte??"",/^2026-10-28T23:59:59-03:00$/);
  assert.doesNotMatch(parsed[0].termos,/\uFFFD/);
});

test("prova recente do proprio produto no checkout permite texto condicional",()=>{
  const confirmado: Oferta={
    ...base,
    cupomCodigo:"PROVA2026",
    cupomPercentual:10,
    cupomValidacao:"produto-confirmado",
    cupomConfirmadoEm:data(-2*60_000),
    cupomProdutoIdConfirmado:base.produtoId,
    cupomAnuncioIdConfirmado:base.anuncioId,
    cupomFonteConfirmacao:"checkout",
    cupomValidoAte:data(30*60_000),
    precoComCupomEstimado:130
  };
  assert.equal(avaliarCupomParaDivulgacao(confirmado,agora).situacao,"confirmado");
  assert.match(formatarOfertaWhatsapp(confirmado),/PROVA2026/);
  assert.match(formatarOfertaWhatsapp(confirmado),/Se eleg.vel no checkout/);
  for(const inseguro of [
    {...confirmado,cupomConfirmadoEm:data(-11*60_000)},
    {...confirmado,cupomProdutoIdConfirmado:"MLBOUTRO"},
    {...confirmado,cupomAnuncioIdConfirmado:"MLBOUTRO"},
    {...confirmado,cupomFonteConfirmacao:undefined},
    {...confirmado,cupomValidoAte:data(-1)},
    {...confirmado,precoComCupomEstimado:149}
  ]){
    assert.equal(avaliarCupomParaDivulgacao(inseguro,agora).podeAnunciar,false);
    assert.doesNotMatch(formatarOfertaWhatsapp(inseguro),/PROVA2026/);
  }
});

test("candidato nunca muda economia nem pontuacao usando preco simulado",()=>{
  const codigo=aplicarMelhorCupomMercadoLivre(baseSemDesconto,[{
    ...voucher,percentual:80,descontoMaximo:undefined
  }]);
  assert.equal(calcularScorePromocao(codigo),calcularScorePromocao(baseSemDesconto));
  assert.equal(avaliarCupomParaDivulgacao(codigo,agora).podeAnunciar,false);
});
