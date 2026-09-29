import "dotenv/config";
import { rm } from "node:fs/promises";
import { formatarOfertaWhatsapp } from "../mensagens/whatsapp.js";
import { PublicadorArquivo } from "../publicadores/arquivo.js";
import { salvarPacoteWhatsapp } from "../publicadores/pacote-whatsapp.js";
import { buscarMelhorOferta } from "./pipeline.js";
import { registrarOfertaVista } from "../ofertas/historico.js";

await rm("data/ultima-mensagem-whatsapp.txt", { force: true });

const resultado = await buscarMelhorOferta();

console.log(
  `Produtos analisados: ${resultado.analisadas} | Elegíveis: ${resultado.elegiveis} | Bloqueadas: ${resultado.bloqueadas} | Disponíveis: ${resultado.disponiveis} | Categoria: ${resultado.categoriaEscolhida ?? "-"} | Melhor desconto encontrado: ${resultado.melhorDesconto}%`
);

if (!resultado.melhor) {
  const minimo = Number(process.env.MIN_DISCOUNT_PERCENT ?? 20);

  if (resultado.elegiveis > 0 && resultado.disponiveis === 0) {
    console.log(
      "Todas as ofertas elegíveis já foram enviadas recentemente. Aguarde novas opções ou limpe o histórico no painel."
    );
  } else {
    console.log(
      `Nenhuma oferta atingiu o desconto mínimo de ${minimo}%. Tente aumentar AMAZON_LIMIT, alterar AMAZON_QUERY ou usar AMAZON_QUERIES.`
    );
  }

  process.exit(2);
}

const mensagem = formatarOfertaWhatsapp(resultado.melhor);

console.log("\n--- PREVIA WHATSAPP ---\n");
console.log(mensagem);
console.log("\n------------------------\n");

await new PublicadorArquivo().publicar(mensagem);
await salvarPacoteWhatsapp(resultado.melhor, mensagem);
await registrarOfertaVista(resultado.melhor);
