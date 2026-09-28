import "dotenv/config";
import { FonteMock } from "../fontes/mock.js";
import { calcularScore } from "../ofertas/score.js";

export async function executarBusca(): Promise<void> {
  const fontes = [new FonteMock()];
  const minScore = Number(process.env.MIN_SCORE ?? 40);

  for (const fonte of fontes) {
    const ofertas = await fonte.buscar();

    for (const oferta of ofertas) {
      const score = calcularScore(oferta);
      if (score < minScore) continue;

      console.log({
        titulo: oferta.titulo,
        preco: oferta.precoAtual,
        desconto: oferta.descontoPercentual,
        score
      });
    }
  }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  executarBusca().catch(console.error);
}
