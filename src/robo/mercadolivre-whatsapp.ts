import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { formatarOfertaWhatsapp } from "../mensagens/whatsapp.js";
import { lerOfertaMercadoLivre } from "../afiliados/mercadolivre.js";
import { registrarOfertaVista } from "../ofertas/historico.js";
import { PublicadorArquivo } from "../publicadores/arquivo.js";
import { salvarPacoteWhatsapp } from "../publicadores/pacote-whatsapp.js";
import { revalidarCupomMercadoLivre } from "../afiliados/mercadolivre-cupons.js";
import { descontoMinimoOferta, avaliarQualidadeOferta } from "../ofertas/qualidade.js";

let oferta = await lerOfertaMercadoLivre();

if (!oferta.urlAfiliado) {
  throw new Error(
    "Gere o link oficial do Mercado Livre, cole no painel e salve antes de preparar o WhatsApp."
  );
}

if (oferta.cupomCodigo) {
  const codigoAnterior = oferta.cupomCodigo;
  oferta = await revalidarCupomMercadoLivre(oferta);
  if (oferta.cupomCodigo && oferta.cupomValidacao !== "produto-confirmado") {
    console.warn("Cupom publico nao confirmado para este produto; o codigo nao sera publicado.");
    oferta = {
      ...oferta,
      cupom: undefined, cupomCodigo: undefined, cupomPercentual: undefined,
      cupomValor: undefined, cupomCompraMinima: undefined,
      cupomDescontoMaximo: undefined, cupomValidoAte: undefined,
      cupomValidacao: undefined, precoComCupomEstimado: undefined,
      descontoEfetivoPercentual: oferta.descontoPercentual ?? 0
    };
  }

  if (oferta.cupomCodigo) {
    console.log(
      `Cupom ${oferta.cupomCodigo} revalidado no cat�logo oficial imediatamente antes do WhatsApp.`
    );
  } else {
    console.warn(
      `Cupom ${codigoAnterior} n�o est� mais dispon�vel; a oferta ser� reavaliada sem o cupom.`
    );
  }

  await writeFile(
    "data/ultima-oferta-mercadolivre.json",
    JSON.stringify(oferta, null, 2),
    "utf8"
  );
}

const minimo = descontoMinimoOferta();
const beneficioEfetivo =
  oferta.descontoEfetivoPercentual ??
  oferta.descontoPercentual ??
  0;

if (beneficioEfetivo < minimo) {
  throw new Error(
    `A oferta perdeu elegibilidade ap�s revalidar o cupom: benef�cio efetivo ${beneficioEfetivo}% abaixo do m�nimo de ${minimo}%.`
  );
}

const qualidade = avaliarQualidadeOferta(oferta);
if (!qualidade.elegivel) {
  throw new Error("Oferta reprovada antes do envio: " + qualidade.motivo +
    ". Nenhuma mensagem sera enviada.");
}
const mensagem = formatarOfertaWhatsapp(oferta);

console.log("\n--- PREVIA WHATSAPP � MERCADO LIVRE ---\n");
console.log(mensagem);
console.log("\n----------------------------------------\n");

await new PublicadorArquivo().publicar(mensagem);
await salvarPacoteWhatsapp(oferta, mensagem);
await registrarOfertaVista(oferta);

console.log("Oferta do Mercado Livre pronta para abrir no WhatsApp.");
