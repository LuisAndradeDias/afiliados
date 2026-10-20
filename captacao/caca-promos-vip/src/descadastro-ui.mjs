export function renderDescadastro() {
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#071f29"><meta name="referrer" content="no-referrer">
<title>Cancelar convites | Caça Promos VIP</title>
<style>
:root{color-scheme:dark;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#e9faf3;background:#071f29}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;padding:24px;display:grid;place-items:center;
  background:radial-gradient(circle at 70% 0,#135048 0,transparent 39%),#071f29}
main{width:min(480px,100%);padding:28px;border:1px solid #3b6e68;border-radius:17px;background:#0b2c36}
.logo{color:#7befc8;font-size:12px;font-weight:900;letter-spacing:.08em}
h1{font-size:clamp(27px,5vw,36px);letter-spacing:-.04em;line-height:1.16;margin:16px 0}
p{color:#c4ded9;font-size:14px;line-height:1.7}
button{font:inherit;font-size:14px;font-weight:800;color:#063528;
  background:#7befc8;border:0;border-radius:10px;padding:13px 18px;cursor:pointer;margin-top:11px}
button:disabled{opacity:.5;cursor:not-allowed}
button:focus-visible{outline:3px solid #d9ffc6;outline-offset:3px}
#unsubscribeMessage{background:#143e3f;border:1px solid #3f8c77;padding:12px;
  border-radius:10px;color:#e6fff4;margin-top:14px}
#unsubscribeMessage.error{background:#432b2a;border-color:#b76a63}
</style>
<script defer src="/assets/descadastro.js"></script></head>
<body><main>
<div class="logo">CAÇA PROMOS VIP 👑</div>
<h1>Parar de receber convites</h1>
<p>Você pode cancelar o recebimento de mensagens individuais do Caça Promos VIP.
Sua participação em grupos do WhatsApp não será alterada.</p>
<button id="unsubscribeButton" type="button">Confirmar descadastro</button>
<div id="unsubscribeMessage" role="status" aria-live="polite" hidden></div>
</main></body></html>`;
}
