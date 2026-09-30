import "dotenv/config";
import { MercadoLivreApiFonte } from "../fontes/mercadolivre/api.js";

const consulta = process.env.MERCADOLIVRE_QUERY ?? "beleza";
const limite = Number(process.env.MERCADOLIVRE_LIMIT ?? 10);

console.log(`Mercado Livre teste: buscando "${consulta}" (limite ${limite})`);

const ofertas = await new MercadoLivreApiFonte(consulta, limite).buscar();

console.table(
  ofertas.map((oferta) => ({
    id: oferta.produtoId,
    produto: oferta.titulo,
    preco: oferta.precoAtual,
    precoAnterior: oferta.precoAnterior ?? "-",
    desconto: oferta.descontoPercentual ? `${oferta.descontoPercentual}%` : "-"
  }))
);

console.log(`Encontrados: ${ofertas.length}`);
