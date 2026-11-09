import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {aplicarMelhorCupomMercadoLivre,obterCuponsMercadoLivre,
 registrarCuponsObservadosMercadoLivre,statusCuponsMercadoLivre,
 extrairCuponsMercadoLivre,type CupomMercadoLivre} from '../src/afiliados/mercadolivre-cupons.js';
import {calcularScorePromocao} from '../src/ofertas/score.js';
import {formatarOfertaWhatsapp} from '../src/mensagens/whatsapp.js';
import type {Oferta} from '../src/fontes/types.js';
const now=Date.now();
const offer:Oferta={plataforma:'Mercado Livre',produtoId:'MLB1001',titulo:'Fone bluetooth teste',
 precoAtual:90,precoAnterior:100,descontoPercentual:10,urlProduto:'https://www.mercadolivre.com.br/p/MLB1001',encontradoEm:new Date(now)};
const coupon:CupomMercadoLivre={codigo:'TESTE30',percentual:30,compraMinima:50,descontoMaximo:40,
 validoDe:new Date(now-3600000).toISOString(),validoAte:new Date(now+3600000).toISOString(),
 naoCumulativo:false,somenteItensElegiveis:true,termos:'Cupom apenas para itens elegíveis.',
 origem:'mercadolivre-promocoes',coletadoEm:new Date(now).toISOString()};

test('estimativa de cupom não aprova produto abaixo de 20%',()=>{
 const result=aplicarMelhorCupomMercadoLivre(offer,[coupon]);
 assert.equal(result.cupomCodigo,'TESTE30');
 assert.equal(result.precoComCupomEstimado,63);
 assert.equal(result.descontoEfetivoPercentual,10,'37% é hipótese, não benefício confirmado');
 assert.equal(result.descontoComCupomEstimadoPercentual,37);
 assert.ok((result.descontoEfetivoPercentual??0)<20);
 assert.equal(result.precoAtual,90);
 assert.equal(calcularScorePromocao(result),calcularScorePromocao(offer),
  'Cupom apenas observado não ganha pontos de qualidade');
 assert.match(formatarOfertaWhatsapp(result),/Se elegível no checkout/);
});
const invalid:Record<string,Partial<CupomMercadoLivre>>={
 vencido:{validoAte:new Date(now-1000).toISOString()},
 semValidade:{validoAte:undefined},
 validadeInvalida:{validoAte:'nunca'},
 inicioFuturo:{validoDe:new Date(now+600000).toISOString()},
 inicioInvalido:{validoDe:'ontem'},
 observadoAntigo:{coletadoEm:new Date(now-86400000).toISOString()},
 observadoFuturo:{coletadoEm:new Date(now+600000).toISOString()},
 observadoInvalido:{coletadoEm:'agora'},
 percentualInvalido:{percentual:130},
 negativo:{percentual:-20},
 limiteNegativo:{descontoMaximo:-1},
 minimoInvalido:{compraMinima:NaN}
};
for(const [name,patch] of Object.entries(invalid))test('não sugere cupom '+name,()=>{
 const result=aplicarMelhorCupomMercadoLivre(offer,[{...coupon,...patch}]);
 assert.equal(result.cupomCodigo,undefined);
 assert.equal(result.descontoEfetivoPercentual,10);
});
test('estimativa respeita mínimo, teto, não cumulatividade e centavos',()=>{
 assert.equal(aplicarMelhorCupomMercadoLivre(offer,[{...coupon,compraMinima:91}]).cupomCodigo,undefined);
 assert.equal(aplicarMelhorCupomMercadoLivre(offer,[{...coupon,descontoMaximo:15}]).precoComCupomEstimado,75);
 assert.equal(aplicarMelhorCupomMercadoLivre(offer,[{...coupon,naoCumulativo:true}]).precoComCupomEstimado,70);
 const price=aplicarMelhorCupomMercadoLivre({...offer,precoAtual:89.99},[{...coupon,percentual:17}]);
 assert.equal(price.precoComCupomEstimado,74.69);
 assert.equal(aplicarMelhorCupomMercadoLivre(offer,[coupon,{...coupon,codigo:'MELHOR40',percentual:40}]).cupomCodigo,'MELHOR40');
});
test('parser não transforma data impossível em validade real',()=>{
 const found=extrairCuponsMercadoLivre('Cupom TESTE30 válido de 31/02/2026 até 31/02/2026. Desconto de 30%.');
 assert.equal(found.length,1);
 assert.equal(found[0].validoAte,undefined);
});

test('observação recente sobrevive a falha de rede; cache antigo não vira ativo',async()=>{
 const cwd=process.cwd(),fetchOriginal=globalThis.fetch;
 const dir=await mkdtemp(join(tmpdir(),'meli10-coupon-'));
 try{
  process.chdir(dir);await mkdir('data');
  await writeFile('data/cupons-mercadolivre-observados.json',JSON.stringify({coletadoEm:new Date(now).toISOString(),fonte:'https://www.mercadolivre.com.br/cupons',cupons:[coupon]}));
  globalThis.fetch=(async(input:any,opts:any)=>{
   assert.equal(new URL(String(input)).hostname,'www.mercadolivre.com.br');
   assert.ok(!opts.method||opts.method==='GET');
   return new Response('{}',{status:403});
  }) as typeof fetch;
  const found=await obterCuponsMercadoLivre({forcarAtualizacao:true});
  assert.deepEqual(found.map(c=>c.codigo),['TESTE30']);
  await rm('data/cupons-mercadolivre-observados.json');
  await writeFile('data/cupons-mercadolivre.json',JSON.stringify({coletadoEm:new Date(now).toISOString(),fonte:'https://www.mercadolivre.com.br/l/promocoes',cupons:[{...coupon,coletadoEm:new Date(now-86400000).toISOString()}]}));
  assert.equal((await statusCuponsMercadoLivre()).ativos,0);
  assert.deepEqual(await obterCuponsMercadoLivre(),[]);
  await rm('data/cupons-mercadolivre.json');
  const n=await registrarCuponsObservadosMercadoLivre(['Cupom TESTE30 válido de 09/11/2026 até 10/11/2026. Desconto de 30%.'],'https://evil.test/ofertas');
  assert.equal(n,0);
  await assert.rejects(readFile('data/cupons-mercadolivre-observados.json'),(e:any)=>e.code==='ENOENT');
 }finally{globalThis.fetch=fetchOriginal;process.chdir(cwd);await rm(dir,{recursive:true,force:true});}
});
