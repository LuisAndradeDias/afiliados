'use strict';
(() => {
  let workerPromise = null;

  function normalizarSelecao(x1, y1, x2, y2, maxW, maxH) {
    const limite = (v, max) => Math.max(0, Math.min(max, Number(v) || 0));
    const ax = limite(x1, maxW);
    const ay = limite(y1, maxH);
    const bx = limite(x2, maxW);
    const by = limite(y2, maxH);
    const left = Math.min(ax, bx), top = Math.min(ay, by);
    return {
      left, top,
      width: Math.max(0, Math.abs(bx - ax)),
      height: Math.max(0, Math.abs(by - ay)),
    };
  }

  function recortar(img, area, larguraTela, alturaTela, documento = document) {
    if (!img?.naturalWidth || !img?.naturalHeight) {
      throw new Error('A imagem ainda não terminou de carregar.');
    }
    if (larguraTela < 1 || alturaTela < 1) throw new Error('Imagem sem dimensões válidas.');
    const selecionada = normalizarSelecao(area.left, area.top,
      area.left + area.width, area.top + area.height, larguraTela, alturaTela);
    if (selecionada.width < 18 || selecionada.height < 18) {
      throw new Error('Selecione uma área maior que 18 × 18 pixels.');
    }
    const sx = img.naturalWidth / larguraTela;
    const sy = img.naturalHeight / alturaTela;
    const startX = Math.floor(selecionada.left * sx);
    const startY = Math.floor(selecionada.top * sy);
    const areaW = Math.min(img.naturalWidth - startX, Math.ceil(selecionada.width * sx));
    const areaH = Math.min(img.naturalHeight - startY, Math.ceil(selecionada.height * sy));
    if (areaW < 10 || areaH < 10) throw new Error('A seleção não contém imagem suficiente.');
    const fator = areaW < 900 ? Math.min(2, 1300 / areaW) : 1;
    const canvas = documento.createElement('canvas');
    canvas.width = Math.max(1, Math.round(areaW * fator));
    canvas.height = Math.max(1, Math.round(areaH * fator));
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) throw new Error('O navegador não permitiu preparar a imagem.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, startX, startY, areaW, areaH,
      0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function caminhoLocal(relativo) {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(relativo);
    }
    return new URL(relativo, location.href).href;
  }

  async function carregarMotor(progresso = () => {}) {
    if (!globalThis.Tesseract?.createWorker) {
      throw new Error('Motor OCR local indisponível. Recarregue a extensão.');
    }
    if (!workerPromise) {
      workerPromise = globalThis.Tesseract.createWorker('por', 1, {
        workerPath: caminhoLocal('ocr/worker.min.js'),
        corePath: caminhoLocal('ocr/core'),
        langPath: caminhoLocal('ocr/lang'),
        workerBlobURL: false,
        gzip: true,
        cacheMethod: 'none',
        logger: info => {
          if (typeof info?.progress === 'number') {
            progresso(info.status, Math.max(0, Math.min(100, Math.round(info.progress * 100))));
          }
        },
      }).then(async worker => {
        await worker.setParameters({
          tessedit_pageseg_mode: '6',
          preserve_interword_spaces: '1',
        });
        return worker;
      }).catch(error => {
        workerPromise = null;
        throw error;
      });
    }
    return workerPromise;
  }

  async function reconhecer(img, area, larguraTela, alturaTela, progresso) {
    const canvas = recortar(img, area, larguraTela, alturaTela);
    const worker = await carregarMotor(progresso);
    const resultado = await worker.recognize(canvas);
    const texto = String(resultado?.data?.text || '')
      .replace(/\r\n/g, '\n')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .trim();
    return {
      texto: texto.slice(0, 30000),
      confianca: Number(resultado?.data?.confidence ?? 0),
    };
  }

  async function liberar() {
    if (!workerPromise) return;
    const promise = workerPromise;
    workerPromise = null;
    try { (await promise)?.terminate?.(); } catch { /* worker ja finalizado */ }
  }

  globalThis.CPVScreenReader = {
    normalizarSelecao, recortar, reconhecer, liberar,
  };
})();
