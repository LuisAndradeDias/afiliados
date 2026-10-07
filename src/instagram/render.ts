import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium } from "playwright";
import type { Oferta } from "../fontes/types.js";
import {
  normalizarImagemAmazonAltaResolucao
} from "../imagens/oferta.js";
import type {
  AvaliacaoInstagram
} from "./classificador.js";

function escaparHtml(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function moeda(valor?: number): string {
  if (
    valor === undefined ||
    !Number.isFinite(valor)
  ) {
    return "";
  }

  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function tituloCurto(texto: string, maximo = 86): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= maximo) return limpo;
  return `${limpo.slice(0, maximo - 1).trim()}…`;
}

function htmlBase(
  oferta: Oferta,
  avaliacao: AvaliacaoInstagram,
  modo: "story" | "reel"
): string {
  const imagemUrl =
    normalizarImagemAmazonAltaResolucao(
      oferta.imagem
    ) ?? oferta.imagem ?? "";
  const titulo = escaparHtml(
    tituloCurto(oferta.titulo)
  );
  const imagem = escaparHtml(imagemUrl);
  const atual = escaparHtml(
    moeda(oferta.precoAtual)
  );
  const anterior = escaparHtml(
    moeda(oferta.precoAnterior)
  );
  const desconto = Math.round(
    avaliacao.descontoConsiderado
  );
  const plataforma = /mercado livre/i.test(
    oferta.plataforma
  )
    ? "MERCADO LIVRE"
    : "AMAZON";
  const headline =
    modo === "story"
      ? "OFERTA IMPERDÍVEL"
      : "ACHADO DO DIA";
  const sub =
    modo === "story"
      ? "Selecionada entre as melhores ofertas"
      : "Oferta que vale mostrar no Instagram";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
* { box-sizing: border-box; }
html, body {
  margin: 0;
  width: 1080px;
  height: 1920px;
  overflow: hidden;
  font-family: Arial, Helvetica, sans-serif;
  background: #061925;
}
body {
  background:
    radial-gradient(circle at 15% 10%, rgba(0,236,151,.18), transparent 28%),
    radial-gradient(circle at 90% 65%, rgba(255,194,38,.13), transparent 30%),
    linear-gradient(165deg, #04131e 0%, #062335 55%, #03121c 100%);
  color: white;
}
.canvas {
  width: 1080px;
  height: 1920px;
  padding: 82px 72px 72px;
  display: flex;
  flex-direction: column;
  gap: 34px;
  position: relative;
}
.orb {
  position: absolute;
  border: 3px solid rgba(0,236,151,.35);
  border-radius: 50%;
}
.orb.one { width: 340px; height: 340px; left: -190px; top: 130px; }
.orb.two { width: 420px; height: 420px; right: -250px; bottom: 180px; }
.topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 2;
}
.platform {
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 2px;
  padding: 16px 24px;
  border: 2px solid rgba(0,236,151,.45);
  background: rgba(0,28,44,.75);
  border-radius: 999px;
}
.score {
  font-size: 24px;
  color: #9df5d2;
  font-weight: 800;
}
.head {
  position: relative;
  z-index: 2;
}
.headline {
  font-size: 100px;
  line-height: .92;
  font-weight: 1000;
  letter-spacing: -4px;
  max-width: 900px;
  text-shadow: 0 12px 30px rgba(0,0,0,.35);
}
.headline .yellow { color: #ffc526; }
.sub {
  margin-top: 22px;
  font-size: 30px;
  color: #b9c8d4;
  font-weight: 700;
}
.discount {
  position: absolute;
  right: 65px;
  top: 285px;
  background: linear-gradient(145deg, #ffe15f, #ffb700);
  color: #081722;
  width: 210px;
  height: 210px;
  border-radius: 44px 44px 62px 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  transform: rotate(7deg);
  box-shadow: 0 22px 50px rgba(255,183,0,.25);
  z-index: 4;
}
.discount strong { font-size: 66px; line-height: .9; }
.discount span { font-size: 30px; font-weight: 900; margin-top: 8px; }
.product-card {
  flex: 1;
  min-height: 0;
  margin-top: 14px;
  position: relative;
  z-index: 2;
  border-radius: 52px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.98), rgba(246,249,250,.98));
  padding: 54px;
  box-shadow: 0 30px 80px rgba(0,0,0,.38);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.product-card::after {
  content: "";
  position: absolute;
  inset: auto 0 0 0;
  height: 18px;
  background: linear-gradient(90deg, #00ec97, #ffc526);
}
.product-card img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}
.details {
  position: relative;
  z-index: 2;
  background: rgba(4,22,34,.92);
  border: 2px solid rgba(0,236,151,.28);
  border-radius: 36px;
  padding: 34px 38px;
}
.title {
  font-size: 40px;
  line-height: 1.08;
  font-weight: 850;
  margin-bottom: 24px;
  max-height: 88px;
  overflow: hidden;
}
.price-row {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 30px;
}
.old {
  font-size: 28px;
  color: #93a5b0;
  text-decoration: line-through;
  min-height: 34px;
}
.current {
  font-size: 70px;
  line-height: .95;
  font-weight: 1000;
  color: #00ec97;
}
.tag {
  font-size: 22px;
  font-weight: 900;
  text-transform: uppercase;
  color: #061925;
  background: #ffc526;
  padding: 14px 18px;
  border-radius: 16px;
}
.cta {
  position: relative;
  z-index: 2;
  border-radius: 34px;
  background: linear-gradient(90deg, #00df8e, #08f1a1);
  color: #03141f;
  padding: 28px 34px;
  font-size: 36px;
  font-weight: 1000;
  text-align: center;
  box-shadow: 0 16px 40px rgba(0,236,151,.22);
}
.footer {
  text-align: center;
  position: relative;
  z-index: 2;
  font-size: 23px;
  color: #9fb2bd;
}
</style>
</head>
<body>
<main class="canvas">
  <div class="orb one"></div>
  <div class="orb two"></div>
  <div class="topline">
    <div class="platform">${plataforma}</div>
    <div class="score">Instagram score ${avaliacao.score}/100</div>
  </div>
  <div class="head">
    <div class="headline">${headline.split(" ").map((p, i) => i === 1 ? `<span class="yellow">${p}</span>` : p).join(" ")}</div>
    <div class="sub">${sub}</div>
  </div>
  <div class="discount">
    <strong>${desconto}%</strong>
    <span>OFF</span>
  </div>
  <div class="product-card">
    <img id="produto" src="${imagem}" alt="">
  </div>
  <section class="details">
    <div class="title">${titulo}</div>
    <div class="price-row">
      <div>
        <div class="old">${anterior}</div>
        <div class="current">${atual}</div>
      </div>
      <div class="tag">${avaliacao.classificacao}</div>
    </div>
  </section>
  <div class="cta">🔥 Mais ofertas no Grupo VIP — link na bio</div>
  <div class="footer">Preço e disponibilidade podem mudar.</div>
</main>
</body>
</html>`;
}

async function renderizar(
  oferta: Oferta,
  avaliacao: AvaliacaoInstagram,
  caminho: string,
  modo: "story" | "reel"
): Promise<string> {
  await mkdir(dirname(caminho), {
    recursive: true
  });

  const browser = await chromium.launch({
    channel:
      process.env.AMAZON_BROWSER_CHANNEL ??
      "chrome",
    headless: true
  });

  try {
    const page = await browser.newPage({
      viewport: {
        width: 1080,
        height: 1920
      },
      deviceScaleFactor: 1
    });

    await page.setContent(
      htmlBase(oferta, avaliacao, modo),
      {
        waitUntil: "load"
      }
    );

    await page
      .locator("#produto")
      .evaluate(async (img: HTMLImageElement) => {
        if (
          img.complete &&
          img.naturalWidth > 0
        ) {
          return;
        }

        await new Promise<void>(
          (resolve, reject) => {
            img.addEventListener(
              "load",
              () => resolve(),
              { once: true }
            );
            img.addEventListener(
              "error",
              () =>
                reject(
                  new Error(
                    "imagem do produto falhou"
                  )
                ),
              { once: true }
            );
            setTimeout(
              () =>
                reject(
                  new Error(
                    "timeout da imagem do produto"
                  )
                ),
              15_000
            );
          }
        );
      });

    await page.screenshot({
      path: caminho,
      type: "jpeg",
      quality: 94,
      fullPage: false
    });

    return caminho;
  } finally {
    await browser.close();
  }
}

export async function renderizarStoryInstagram(
  oferta: Oferta,
  avaliacao: AvaliacaoInstagram,
  caminho: string
): Promise<string> {
  return renderizar(
    oferta,
    avaliacao,
    caminho,
    "story"
  );
}

export async function renderizarCapaReelInstagram(
  oferta: Oferta,
  avaliacao: AvaliacaoInstagram,
  caminho: string
): Promise<string> {
  return renderizar(
    oferta,
    avaliacao,
    caminho,
    "reel"
  );
}
