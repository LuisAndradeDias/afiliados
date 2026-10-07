import { mkdir, writeFile } from "node:fs/promises";
import {
  dirname,
  relative,
  resolve
} from "node:path";
import type { Oferta } from "../fontes/types.js";
import {
  avaliarOfertaInstagram,
  type AvaliacaoInstagram,
  type ClassificacaoInstagram
} from "./classificador.js";
import {
  criarCopyInstagram,
  type CopyInstagram
} from "./copy.js";
import {
  chaveInstagram,
  diretorioInstagram,
  registrarConteudoInstagram,
  verificarCooldownInstagram
} from "./historico.js";
import {
  renderizarCapaReelInstagram,
  renderizarStoryInstagram
} from "./render.js";

export interface AvaliacaoInstagramPersistida
  extends AvaliacaoInstagram {
  gerado: boolean;
  classificacaoFinal?: ClassificacaoInstagram;
  motivoGeracao?: string;
}

export interface PacoteInstagram
  extends CopyInstagram {
  produtoId: string;
  plataforma: string;
  titulo: string;
  precoAtual: number;
  precoAnterior?: number;
  descontoPercentual: number;
  imagemUrl?: string;
  urlProduto: string;
  urlAfiliado?: string;
  instagramScore: number;
  classificacao: ClassificacaoInstagram;
  motivos: string[];
  storyArquivo: string;
  reelCapaArquivo?: string;
  roteiroArquivo?: string;
  legendaArquivo?: string;
  hashtagsArquivo?: string;
  geradoEm: string;
}

function caminhoRelativo(caminho: string): string {
  return relative(process.cwd(), caminho)
    .replaceAll("\\", "/");
}

function nomeDiretorioOferta(oferta: Oferta): string {
  return chaveInstagram(oferta)
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function salvarJson(
  caminho: string,
  dados: unknown
): Promise<void> {
  await mkdir(dirname(caminho), {
    recursive: true
  });
  await writeFile(
    caminho,
    JSON.stringify(dados, null, 2),
    "utf8"
  );
}

async function salvarAvaliacao(
  avaliacao: AvaliacaoInstagramPersistida
): Promise<void> {
  await salvarJson(
    resolve(
      diretorioInstagram(),
      "ultima-avaliacao.json"
    ),
    avaliacao
  );
}

export async function gerarConteudoInstagramSeElegivel(
  oferta: Oferta
): Promise<PacoteInstagram | undefined> {
  const avaliacao = avaliarOfertaInstagram(oferta);

  if (
    process.env.INSTAGRAM_CONTENT_ENABLED ===
    "false"
  ) {
    await salvarAvaliacao({
      ...avaliacao,
      gerado: false,
      motivoGeracao:
        "geração de conteúdo Instagram desativada"
    });
    return undefined;
  }

  if (
    !avaliacao.elegivel ||
    avaliacao.classificacao === "normal"
  ) {
    await salvarAvaliacao({
      ...avaliacao,
      gerado: false,
      motivoGeracao:
        avaliacao.bloqueios[0] ??
        "score abaixo do mínimo para conteúdo"
    });
    return undefined;
  }

  const cooldown =
    await verificarCooldownInstagram(oferta);

  if (cooldown.bloquearTudo) {
    await salvarAvaliacao({
      ...avaliacao,
      gerado: false,
      motivoGeracao:
        cooldown.motivo ??
        "produto em cooldown de conteúdo"
    });
    return undefined;
  }

  let classificacaoFinal =
    avaliacao.classificacao;

  if (
    !cooldown.permitirReel &&
    (classificacaoFinal === "premium" ||
      classificacaoFinal === "destaque")
  ) {
    classificacaoFinal = "story";
  }

  const raizConteudo = resolve(
    diretorioInstagram(),
    nomeDiretorioOferta(oferta)
  );
  await mkdir(raizConteudo, {
    recursive: true
  });

  const storyPath = resolve(
    raizConteudo,
    "story.jpg"
  );
  const reelPath = resolve(
    raizConteudo,
    "reel-capa.jpg"
  );
  const roteiroPath = resolve(
    raizConteudo,
    "roteiro.txt"
  );
  const legendaPath = resolve(
    raizConteudo,
    "legenda.txt"
  );
  const hashtagsPath = resolve(
    raizConteudo,
    "hashtags.txt"
  );
  const pacotePath = resolve(
    raizConteudo,
    "pacote.json"
  );

  await renderizarStoryInstagram(
    oferta,
    {
      ...avaliacao,
      classificacao: classificacaoFinal
    },
    storyPath
  );

  let reelCapaArquivo: string | undefined;
  if (
    classificacaoFinal === "premium" ||
    classificacaoFinal === "destaque"
  ) {
    await renderizarCapaReelInstagram(
      oferta,
      {
        ...avaliacao,
        classificacao: classificacaoFinal
      },
      reelPath
    );
    reelCapaArquivo = caminhoRelativo(reelPath);
  }

  const copy = criarCopyInstagram(
    oferta,
    avaliacao
  );

  await Promise.all([
    writeFile(
      roteiroPath,
      copy.roteiro,
      "utf8"
    ),
    writeFile(
      legendaPath,
      copy.legenda,
      "utf8"
    ),
    writeFile(
      hashtagsPath,
      copy.hashtags.join(" "),
      "utf8"
    )
  ]);

  const geradoEm = new Date().toISOString();
  const pacote: PacoteInstagram = {
    ...copy,
    produtoId: oferta.produtoId,
    plataforma: oferta.plataforma,
    titulo: oferta.titulo,
    precoAtual: oferta.precoAtual,
    precoAnterior: oferta.precoAnterior,
    descontoPercentual:
      avaliacao.descontoConsiderado,
    imagemUrl: oferta.imagem,
    urlProduto: oferta.urlProduto,
    urlAfiliado: oferta.urlAfiliado,
    instagramScore: avaliacao.score,
    classificacao: classificacaoFinal,
    motivos: [
      ...avaliacao.motivos,
      ...(cooldown.motivo
        ? [cooldown.motivo]
        : [])
    ],
    storyArquivo: caminhoRelativo(storyPath),
    reelCapaArquivo,
    roteiroArquivo: caminhoRelativo(
      roteiroPath
    ),
    legendaArquivo: caminhoRelativo(
      legendaPath
    ),
    hashtagsArquivo: caminhoRelativo(
      hashtagsPath
    ),
    geradoEm
  };

  await salvarJson(pacotePath, pacote);
  await salvarJson(
    resolve(
      diretorioInstagram(),
      "ultimo-pacote.json"
    ),
    pacote
  );
  await salvarAvaliacao({
    ...avaliacao,
    gerado: true,
    classificacaoFinal,
    motivoGeracao:
      classificacaoFinal === "story"
        ? "Story gerado automaticamente"
        : "pacote Instagram completo gerado automaticamente"
  });
  await registrarConteudoInstagram(
    oferta,
    classificacaoFinal,
    avaliacao.score
  );

  return pacote;
}
