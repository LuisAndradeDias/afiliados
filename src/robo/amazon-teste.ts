import "dotenv/config";
import { AmazonBrowserFonte } from "../fontes/amazon/browser.js";

const consulta = process.env.AMAZON_QUERY ?? "ofertas";
const limite = Number(process.env.AMAZON_LIMIT ?? 10);

console.log(`Amazon teste: buscando "${consulta}" (limite ${limite})`);

const fonte = new AmazonBrowserFonte(consulta, limite);
const ofertas = await fonte.buscar();

console.table(
  ofertas.map((oferta) => ({
    asin: oferta.produtoId,
    produto: oferta.titulo,
    preco: oferta.precoAtual,
    precoAnterior: oferta.precoAnterior ?? "-",
    desconto: oferta.descontoPercentual
      ? `${oferta.descontoPercentual}%`
      : "-"
  }))
);

console.log(`Encontrados: ${ofertas.length}`);
