import {
  mkdir,
  readFile,
  rm,
  stat
} from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

function assert(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) throw new Error(message);
}

const raizTeste = resolve(
  "data",
  "test-instagram-content"
);
await rm(raizTeste, {
  recursive: true,
  force: true
});
await mkdir(raizTeste, {
  recursive: true
});

process.env.INSTAGRAM_DATA_DIR = raizTeste;
process.env.INSTAGRAM_CONTENT_ENABLED = "true";
process.env.INSTAGRAM_MIN_DISCOUNT_PERCENT =
  "35";
process.env.INSTAGRAM_STORY_COOLDOWN_DAYS =
  "3";
process.env.INSTAGRAM_REEL_COOLDOWN_DAYS =
  "14";

const {
  avaliarOfertaInstagram
} = await import(
  "../src/instagram/classificador.js"
);
const {
  gerarConteudoInstagramSeElegivel
} = await import(
  "../src/instagram/pacote.js"
);

const svg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"><rect width="1200" height="1200" fill="white"/><rect x="390" y="160" width="420" height="880" rx="90" fill="#f0c34f"/><circle cx="600" cy="620" r="150" fill="#f5e4a7"/></svg>'
)}`;

const oferta = {
  plataforma: "Amazon Brasil",
  produtoId: "TESTE-INSTAGRAM-001",
  titulo:
    "Shampoo Johnson's Baby 400ml oferta de teste",
  precoAtual: 18.08,
  precoAnterior: 45.2,
  descontoPercentual: 60,
  imagem: svg,
  urlProduto:
    "https://www.amazon.com.br/dp/TESTE",
  urlAfiliado:
    "https://www.amazon.com.br/dp/TESTE?tag=teste-20",
  categoria: "bebe",
  comissaoEstimadaPercentual: 13,
  scoreOferta: 90,
  encontradoEm: new Date()
};

const avaliacao =
  avaliarOfertaInstagram(oferta);
assert(
  avaliacao.elegivel,
  "Oferta forte deveria ser elegível."
);
assert(
  avaliacao.score >= 85,
  `Oferta deveria ser destaque; score recebido: ${avaliacao.score}.`
);
assert(
  avaliacao.classificacao === "destaque",
  "Oferta forte deveria ser classificada como destaque."
);

const fraca = avaliarOfertaInstagram({
  ...oferta,
  produtoId: "FRACA",
  titulo: "Produto genérico",
  descontoPercentual: 20
});
assert(
  !fraca.elegivel &&
    fraca.classificacao === "normal",
  "Oferta com 20% não deveria gerar conteúdo Instagram."
);

const pacote =
  await gerarConteudoInstagramSeElegivel(
    oferta
  );
assert(
  pacote,
  "Pacote Instagram não foi gerado."
);
assert(
  pacote.classificacao === "destaque",
  "Pacote deveria manter classificação destaque."
);
assert(
  Boolean(pacote.reelCapaArquivo),
  "Destaque deveria gerar capa de Reel."
);
assert(
  pacote.legenda.includes(
    "Publicidade/afiliado"
  ),
  "Legenda deve incluir transparência sobre afiliação."
);

const storyPath = resolve(
  pacote.storyArquivo
);
const reelPath = resolve(
  pacote.reelCapaArquivo!
);
assert(
  (await stat(storyPath)).size > 20_000,
  "Story gerado ficou pequeno demais."
);
assert(
  (await stat(reelPath)).size > 20_000,
  "Capa do Reel gerada ficou pequena demais."
);

const browser = await chromium.launch({
  channel: "chrome",
  headless: true
});
try {
  for (const caminho of [
    storyPath,
    reelPath
  ]) {
    const page = await browser.newPage();
    await page.goto(
      `file:///${caminho.replaceAll("\\", "/")}`
    );
    const dimensoes = await page
      .locator("img")
      .evaluate(
        (img: HTMLImageElement) => ({
          width: img.naturalWidth,
          height: img.naturalHeight
        })
      );
    assert(
      dimensoes.width === 1080 &&
        dimensoes.height === 1920,
      `Imagem deveria ser 1080x1920, recebeu ${dimensoes.width}x${dimensoes.height}.`
    );
    await page.close();
  }
} finally {
  await browser.close();
}

const salvo = JSON.parse(
  await readFile(
    resolve(
      raizTeste,
      "ultimo-pacote.json"
    ),
    "utf8"
  )
);
assert(
  salvo.instagramScore ===
    pacote.instagramScore,
  "Último pacote persistido está inconsistente."
);

const repetido =
  await gerarConteudoInstagramSeElegivel(
    oferta
  );
assert(
  repetido === undefined,
  "Cooldown deveria impedir geração repetida imediata."
);

await rm(raizTeste, {
  recursive: true,
  force: true
});

console.log("instagram-content: OK");
