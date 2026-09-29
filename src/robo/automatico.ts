import "dotenv/config";
import { setTimeout as esperar } from "node:timers/promises";
import { formatarOfertaWhatsapp } from "../mensagens/whatsapp.js";
import { PublicadorArquivo } from "../publicadores/arquivo.js";
import { salvarPacoteWhatsapp } from "../publicadores/pacote-whatsapp.js";
import { buscarMelhorOferta } from "./pipeline.js";

const intervaloMinutos = Number(
  process.env.COLLECT_INTERVAL_MINUTES ?? 10
);
const executarUmaVez = process.env.RUN_ONCE === "true";

console.log("Robô automático iniciado em MODO PREVIEW (sem envio ao WhatsApp).");

async function ciclo(): Promise<void> {
  const inicio = new Date();
  console.log(`\n[${inicio.toLocaleString("pt-BR")}] Buscando ofertas...`);

  const resultado = await buscarMelhorOferta();

  console.log(
    `Analisadas: ${resultado.analisadas} | Elegíveis: ${resultado.elegiveis} | Bloqueadas: ${resultado.bloqueadas} | Disponíveis: ${resultado.disponiveis} | Melhor desconto: ${resultado.melhorDesconto}%`
  );

  if (!resultado.melhor) {
    if (resultado.elegiveis > 0 && resultado.disponiveis === 0) {
      console.log(
        "As ofertas elegíveis já foram enviadas recentemente. Aguardando novas opções."
      );
    } else {
      console.log("Nenhuma oferta atingiu os filtros neste ciclo.");
    }
    return;
  }
  const mensagem = formatarOfertaWhatsapp(resultado.melhor);
  await new PublicadorArquivo().publicar(mensagem);
  await salvarPacoteWhatsapp(resultado.melhor, mensagem);

  console.log("\nOferta candidata:");
  console.log(mensagem);
}

while (true) {
  try {
    await ciclo();
  } catch (error) {
    console.error("Falha no ciclo automático:", error);
  }

  if (executarUmaVez) break;

  const ms = Math.max(intervaloMinutos, 1) * 60_000;
  console.log(`Próxima busca em ${intervaloMinutos} minuto(s).`);
  await esperar(ms);
}
