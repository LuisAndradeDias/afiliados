import "dotenv/config";
import { aplicarAfiliadoAmazon } from "../afiliados/amazon.js";
import { AmazonBrowserFonte } from "../fontes/amazon/browser.js";
import { formatarOfertaWhatsapp } from "../mensagens/whatsapp.js";
import { calcularScore } from "../ofertas/score.js";
import { PublicadorArquivo } from "../publicadores/arquivo.js";

const consulta = process.env.AMAZON_QUERY ?? "ofertas";
const limite = Number(process.env.AMAZON_LIMIT ?? 10);
const tag = process.env.AMAZON_ASSOCIATE_TAG;
const descontoMinimo = Number(process.env.MIN_DISCOUNT_PERCENT ?? 20);

const fonte = new AmazonBrowserFonte(consulta, limite);
const ofertas = await fonte.buscar();

const melhores = ofertas
  .filter(
    (oferta) =>
      (oferta.descontoPercentual ?? 0) >= descontoMinimo
  )
  .map((oferta) => ({ oferta, score: calcularScore(oferta) }))
  .sort((a, b) => b.score - a.score);

if (melhores.length === 0) {
  console.log("Nenhuma oferta encontrada.");
  process.exit(0);
}

const escolhida = aplicarAfiliadoAmazon(melhores[0].oferta, tag);
const mensagem = formatarOfertaWhatsapp(escolhida);

console.log("\n--- PREVIA WHATSAPP ---\n");
console.log(mensagem);
console.log("\n------------------------\n");

await new PublicadorArquivo().publicar(mensagem);
