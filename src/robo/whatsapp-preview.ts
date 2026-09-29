import "dotenv/config";
import { formatarOfertaWhatsapp } from "../mensagens/whatsapp.js";
import { PublicadorArquivo } from "../publicadores/arquivo.js";
import { buscarMelhorOferta } from "./pipeline.js";

const resultado = await buscarMelhorOferta();

console.log(
  `Produtos analisados: ${resultado.analisadas} | Elegíveis: ${resultado.elegiveis} | Melhor desconto encontrado: ${resultado.melhorDesconto}%`
);

if (!resultado.melhor) {
  const minimo = Number(process.env.MIN_DISCOUNT_PERCENT ?? 20);
  console.log(
    `Nenhuma oferta atingiu o desconto mínimo de ${minimo}%. Tente aumentar AMAZON_LIMIT, alterar AMAZON_QUERY ou usar AMAZON_QUERIES.`
  );
  process.exit(0);
}

const mensagem = formatarOfertaWhatsapp(resultado.melhor);

console.log("\n--- PREVIA WHATSAPP ---\n");
console.log(mensagem);
console.log("\n------------------------\n");

await new PublicadorArquivo().publicar(mensagem);
