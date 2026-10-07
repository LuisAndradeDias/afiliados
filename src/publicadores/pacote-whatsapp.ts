import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Oferta } from "../fontes/types.js";
import {
  gerarConteudoInstagramSeElegivel
} from "../instagram/pacote.js";

export interface PacoteWhatsapp {
  mensagem: string;
  imagemUrl?: string;
  plataforma: string;
  produtoId: string;
  titulo: string;
  precoAtual: number;
  precoAnterior?: number;
  descontoPercentual?: number;
  categoria?: string;
  comissaoEstimadaPercentual?: number;
  scoreOferta?: number;
  cupomCodigo?: string;
  cupomPercentual?: number;
  cupomValor?: number;
  cupomCompraMinima?: number;
  cupomDescontoMaximo?: number;
  precoComCupomEstimado?: number;
  descontoEfetivoPercentual?: number;
  urlProduto: string;
  urlAfiliado?: string;
}

export async function salvarPacoteWhatsapp(
  oferta: Oferta,
  mensagem: string,
  caminho = "data/ultima-oferta-whatsapp.json"
): Promise<void> {
  const pacote: PacoteWhatsapp = {
    mensagem,
    imagemUrl: oferta.imagem,
    plataforma: oferta.plataforma,
    produtoId: oferta.produtoId,
    titulo: oferta.titulo,
    precoAtual: oferta.precoAtual,
    precoAnterior: oferta.precoAnterior,
    descontoPercentual: oferta.descontoPercentual,
    categoria: oferta.categoria,
    comissaoEstimadaPercentual: oferta.comissaoEstimadaPercentual,
    scoreOferta: oferta.scoreOferta,
    cupomCodigo: oferta.cupomCodigo,
    cupomPercentual: oferta.cupomPercentual,
    cupomValor: oferta.cupomValor,
    cupomCompraMinima: oferta.cupomCompraMinima,
    cupomDescontoMaximo: oferta.cupomDescontoMaximo,
    precoComCupomEstimado: oferta.precoComCupomEstimado,
    descontoEfetivoPercentual: oferta.descontoEfetivoPercentual,
    urlProduto: oferta.urlProduto,
    urlAfiliado: oferta.urlAfiliado
  };

  await mkdir(dirname(caminho), { recursive: true });
  await writeFile(caminho, JSON.stringify(pacote, null, 2), "utf8");

  try {
    const instagram =
      await gerarConteudoInstagramSeElegivel(oferta);

    if (instagram) {
      console.log(
        `INSTAGRAM_CONTEUDO_GERADO: ${instagram.classificacao} · score ${instagram.instagramScore}/100 · ${instagram.produtoId}`
      );
    } else {
      console.log(
        "Instagram: oferta avaliada, mas não selecionada para geração de conteúdo."
      );
    }
  } catch (error) {
    const mensagem =
      error instanceof Error
        ? error.message
        : String(error);

    console.warn(
      `Instagram: falha ao gerar conteúdo; WhatsApp continuará normalmente: ${mensagem}`
    );
  }
}
