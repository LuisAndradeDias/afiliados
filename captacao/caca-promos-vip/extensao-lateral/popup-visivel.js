'use strict';
function lerTextoDoPopupVisivel() {
  if (location.origin !== 'https://web.whatsapp.com') {
    return { ok: false, mensagem: 'Abra o WhatsApp Web.' };
  }
  const titulos = [...document.querySelectorAll('span,div,h1,h2,h3')];
  const titulo = titulos.find(el => el.children.length === 0 &&
    /^Pesquisar membros$/i.test((el.textContent || '').trim()) &&
    el.getBoundingClientRect().height > 0);
  if (!titulo) return { ok: false, mensagem: 'Abra Pesquisar membros antes de continuar.' };
  let popup = null;
  for (let pai = titulo.parentElement; pai && pai !== document.body; pai = pai.parentElement) {
    const rect = pai.getBoundingClientRect();
    if (rect.width > 300 && rect.width < 750 && rect.height > 250 &&
        pai.querySelector('input,[role="textbox"]')) {
      popup = pai;
      break;
    }
  }
  if (!popup) return { ok: false, mensagem: 'Não encontrei a área de membros do popup.' };
  const clip = (a,b) => a.right > b.left && a.left < b.right &&
    a.bottom > b.top && a.top < b.bottom;
  const viewport = {left:0,top:0,right:innerWidth,bottom:innerHeight};
  const textos = [];
  const walker = document.createTreeWalker(popup, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode()) && textos.length < 500) {
    const texto = (node.textContent || '').trim();
    if (!texto || texto.length > 160) continue;
    let pai = node.parentElement;
    if (!pai || pai.closest('[hidden],[aria-hidden="true"]')) continue;
    const cortes = [popup.getBoundingClientRect(),viewport];
    let visivel = true;
    for (; pai; pai = pai.parentElement) {
      const css = getComputedStyle(pai);
      if (css.display === 'none' || css.visibility === 'hidden' || Number(css.opacity) === 0) {
        visivel = false;break;
      }
      if (/(hidden|scroll|auto|clip)/.test(css.overflowX + ' ' + css.overflowY))
        cortes.push(pai.getBoundingClientRect());
      if (pai === popup) break;
    }
    if (!visivel) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    if (![...range.getClientRects()].some(r =>
      r.width > 0 && r.height > 0 && cortes.every(c => clip(r,c)))) continue;
    textos.push(texto);
  }
  return {ok:true, texto:textos.join('\n').slice(0,25000),
    quantidadeLinhas:textos.length };
}
globalThis.CPVPopup = { lerTextoDoPopupVisivel };
