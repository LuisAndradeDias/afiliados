import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { formatarOfertaWhatsapp } from "../mensagens/whatsapp.js";
import { lerOfertaMercadoLivre } from "../afiliados/mercadolivre.js";
import { registrarOfertaVista } from "../ofertas/historico.js";
import { PublicadorArquivo } from "../publicadores/arquivo.js";
import { salvarPacoteWhatsapp } from "../publicadores/pacote-whatsapp.js";
import { revalidarCupomMercadoLivre } from "../afiliados/mercadolivre-cupons.js";

let oferta = await lerOfertaMercadoLivre();

if (!oferta.urlAfiliado) {
  throw new Error(
    "Gere o link oficial do Mercado Livre, cole no painel e salve antes de preparar o WhatsApp."
  );
}

if (oferta.cupomCodigo) {
  const codigoAnterior = oferta.cupomCodigo;
  oferta = await revalidarCupomMercadoLivre(oferta);

  if (oferta.cupomCodigo) {
    console.log(
      `Cupom ${oferta.cupomCodigo} revalidado no catálogo oficial imediatamente antes do WhatsApp.`
    );
  } else {
    console.warn(
      `Cupom ${codigoAnterior} não está mais disponível; a oferta será reavaliada sem o cupom.`
    );
  }

  await writeFile(
    "data/ultima-oferta-mercadolivre.json",
    JSON.stringify(oferta, null, 2),
    "utf8"
  );
}

const minimo = Number(process.env.MIN_DISCOUNT_PERCENT ?? 20);
const beneficioEfetivo =
  oferta.descontoEfetivoPercentual ??
  oferta.descontoPercentual ??
  0;

if (beneficioEfetivo < minimo) {
  throw new Error(
    `A oferta perdeu elegibilidade após revalidar o cupom: benefício efetivo ${beneficioEfetivo}% abaixo do mínimo de ${minimo}%.`
  );
}

const mensagem = formatarOfertaWhatsapp(oferta);

console.log("\n--- PREVIA WHATSAPP · MERCADO LIVRE ---\n");
console.log(mensagem);
console.log("\n----------------------------------------\n");

await new PublicadorArquivo().publicar(mensagem);
await salvarPacoteWhatsapp(oferta, mensagem);
await registrarOfertaVista(oferta);

console.log("Oferta do Mercado Livre pronta para abrir no WhatsApp.");
