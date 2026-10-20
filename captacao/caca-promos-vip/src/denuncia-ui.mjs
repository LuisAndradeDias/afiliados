export function renderDenuncia() {
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#071f29"><meta name="referrer" content="no-referrer">
<title>Denunciar convite | Caça Promos VIP</title>
<style>
:root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#eefcf6;background:#071f29;color-scheme:dark}
*{box-sizing:border-box}
body{min-height:100vh;margin:0;padding:22px;display:grid;place-items:center;
  background:radial-gradient(circle at 80% 0%,#12493f 0,transparent 48%),#071f29}
main{width:min(480px,100%);background:#0b2c36;border:1px solid #37665f;border-radius:17px;padding:27px}
.logo{font-size:12px;font-weight:800;color:#70e8bd;letter-spacing:.06em}
h1{font-size:clamp(27px,5vw,36px);letter-spacing:-.04em;line-height:1.18;margin:18px 0}
p{font-size:14px;line-height:1.65;color:#c8e3dc}
button{font:inherit;border:0;border-radius:10px;background:#70e8bd;color:#053326;
  font-size:15px;font-weight:800;padding:14px 20px;cursor:pointer;margin:12px 0 0;width:100%}
button:disabled{opacity:.6;cursor:not-allowed}
button:focus-visible{outline:3px solid #fff;outline-offset:4px}
#complaintMessage{font-size:14px;line-height:1.55;background:#144040;border:1px solid #458879;
  border-radius:11px;padding:15px;margin-top:16px;color:#edfff7}
#complaintMessage.error{border-color:#b56a65;background:#422b2b}
.note{font-size:12px}
</style>
<script defer src="/assets/denuncia.js"></script></head>
<body><main>
<div class="logo">CAÇA PROMOS VIP 👑</div>
<h1>Denunciar este convite</h1>
<p>Se você não quer mais receber convites, registre uma reclamação diretamente conosco.
Após confirmar, seu número será bloqueado para novos convites do Caça Promos VIP.</p>
<p class="note">Esta é uma denúncia <strong>interna</strong> ao Caça Promos VIP.
Ela <strong>não</strong> é enviada ao WhatsApp ou à Meta e não denuncia uma conta nessas plataformas.</p>
<button id="complaintButton" type="button">Confirmar denúncia e bloquear convites</button>
<div id="complaintMessage" role="status" aria-live="polite" hidden></div>
</main></body></html>`;
}
