import "dotenv/config";
import { formatarOfertaWhatsapp } from "../mensagens/whatsapp.js";
import { lerOfertaMercadoLivre } from "../afiliados/mercadolivre.js";
import { registrarOfertaVista } from "../ofertas/historico.js";
import { PublicadorArquivo } from "../publicadores/arquivo.js";
import { salvarPacoteWhatsapp } from "../publicadores/pacote-whatsapp.js";

const oferta = await lerOfertaMercadoLivre();

if (!oferta.urlAfiliado) {
  throw new Error(
    "Gere o link oficial do Mercado Livre, cole no painel e salve antes de preparar o WhatsApp."
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
