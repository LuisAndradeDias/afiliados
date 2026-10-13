export const styles = `
:root { color-scheme:dark; --base:#031722; --deep:#00111d; --mint:#44e5b1; --gold:#e3c47c; --white:#f6fafc; --muted:#b6c5cc; }
* { box-sizing:border-box; }
html { min-height:100%; background:var(--deep); }
body { margin:0; min-height:100vh; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:var(--white); background:radial-gradient(ellipse 70% 52% at 82% 24%,#03453c70,transparent 70%),radial-gradient(ellipse 70% 70% at 0% 90%,#06293c 0%,transparent 66%),linear-gradient(138deg,#041a28,#00111b 75%); }
body:before {content:''; pointer-events:none; position:fixed; inset:0; opacity:.25; background:repeating-linear-gradient(140deg, transparent 0, transparent 65px, #348a830c 65px,#348a830c 66px); }
a {color:inherit;} .container {position:relative; width:min(1110px,calc(100% - 40px)); margin:0 auto; }
header {padding:32px 0 22px; display:flex; justify-content:space-between; align-items:center; gap:16px;}
.brand {display:flex;align-items:center;gap:15px;font-weight:700;letter-spacing:.09em;line-height:1.12; font-size:15px;}
.brand strong {color:var(--gold);font-size:19px;letter-spacing:.15em;} .mark {display:grid;place-items:center;width:56px;height:56px;border:2px solid var(--gold);border-radius:50%;color:var(--mint);font-size:29px;box-shadow:inset 0 0 0 7px #071e29;}
.tag {border:1px solid #57d7b755;border-radius:80px;padding:9px 14px;color:#d0e6df;font-size:12px;white-space:nowrap;}
.hero {display:grid;grid-template-columns:1.22fr .78fr;gap:50px;align-items:center;padding:88px 0 90px;}
.eyebrow {color:var(--gold);font-weight:700;text-transform:uppercase;letter-spacing:.16em;font-size:13px;margin:0 0 20px;}
h1 {font-size:clamp(42px,6.3vw,78px);line-height:1.07;letter-spacing:-.055em;max-width:700px;margin:0 0 25px;}
h1 span {color:var(--mint);} .lead {max-width:570px;color:#c0d1d4;font-size:clamp(16px,2vw,20px);line-height:1.65;margin:0 0 34px;}
.cta {display:inline-flex;align-items:center;justify-content:center;gap:14px;background:linear-gradient(122deg,#69fac2,#23d4a3);border-radius:50px;padding:20px 35px;color:#04231f;font-weight:800;font-size:17px;text-decoration:none;min-height:62px;box-shadow:0 17px 45px #16e1a023;transition:transform .2s,box-shadow .2s;}
.cta:hover {transform:translateY(-2px);box-shadow:0 18px 55px #16e1a03a;} .cta:focus-visible {outline:3px solid var(--gold);outline-offset:4px;}
.notes {margin-top:19px;font-size:13px;color:#9eb4be;line-height:1.6;}
.illustration {height:435px;position:relative;display:grid;place-items:center;}
.orbit {width:min(92%,415px); aspect-ratio:1; position:relative;border-radius:50%;border:1px solid #44e5b140; background:radial-gradient(circle at 50% 50%,#06232d 0 20%,#063d3d 21% 34%,#0a212b 35% 48%,#064e4670 49% 52%,transparent 53%);box-shadow:0 0 0 40px #44e5b10b,0 0 0 80px #44e5b109;}
.orbit:after {content:'✦';position:absolute;top:-28px;right:5%;color:var(--gold);font-size:45px;}
.center-icon {position:absolute;inset:0;display:grid;place-items:center;color:var(--gold);font-size:115px;text-shadow:0 10px 30px #0007;}
.pill {position:absolute;background:#062b33;border:1px solid #44e5b151;border-radius:999px;padding:13px 17px;font-size:13px;box-shadow:0 12px 35px #0005;} .pill.one {top:17%;left:-8%;}.pill.two {bottom:14%;right:-7%;}.pill strong{color:var(--gold);}
.features {padding:20px 0 70px;display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
.feature {border:1px solid #5de0b42d;border-radius:20px;background:#061e2a99;padding:24px 22px;min-height:165px;}
.feature-icon {font-size:26px;margin-bottom:12px;color:var(--gold);} .feature h2 {font-size:18px;margin:0 0 8px;} .feature p{color:#adc4c9;line-height:1.6;font-size:14px;margin:0;}
footer {border-top:1px solid #4edbb333;padding:22px 0 35px;color:#99b0bb;font-size:12px;line-height:1.75;display:flex;justify-content:space-between;gap:25px;}
footer strong {color:var(--mint);}
.dashboard {max-width:970px;margin:50px auto;padding-bottom:70px;}
.dashboard h1{font-size:clamp(32px,5vw,54px);margin-bottom:12px;}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:30px 0;}.stat{border:1px solid #3a907e66;padding:25px;border-radius:18px;background:#061f2b;}.stat b{display:block;font-size:34px;color:var(--mint);}.stat small{color:#b6c7cc;}table{width:100%;border-collapse:collapse;background:#061e2a;border-radius:14px;overflow:hidden;}td,th{text-align:left;padding:16px;border-bottom:1px solid #31544e;}th{color:var(--gold);}td{color:#e0eeeb;}pre{white-space:pre-wrap;}code{color:var(--gold);}

.signup-section {display:grid;grid-template-columns:.75fr 1.25fr;gap:30px;margin:0 0 55px;padding:28px;border:1px solid #4dbb9c55;border-radius:22px;background:linear-gradient(140deg,#082a34f5,#05202cfa);}
.signup-section h2{font-size:clamp(26px,3vw,36px);letter-spacing:-.04em;margin:8px 0 12px;line-height:1.18;}
.signup-section h2 span{color:var(--mint);}.signup-section p{font-size:14px;line-height:1.65;color:#c0d4d6;}
.form-column{background:#041b28;border-radius:17px;padding:24px;border:1px solid #3a685e;}
.lead-form {display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.lead-form .full{grid-column:1/-1;}.lead-form label{font-size:12px;color:#d9eee6;font-weight:700;display:block;margin-bottom:7px;}
.lead-form input[type=text],.lead-form input[type=tel] {display:block;width:100%;border-radius:11px;border:1px solid #45645e;background:#02131f;color:#fff;padding:13px 12px;outline:none;font:inherit;font-size:14px;}
.lead-form input:focus-visible {outline:3px solid var(--gold);outline-offset:2px;}
.lead-form input::placeholder {color:#91a7b1;}
.lead-form .check {display:flex;align-items:flex-start;gap:11px;padding:12px;border:1px solid #46745a;background:#0c3530;border-radius:11px;}
.lead-form .check input{width:20px;height:20px;min-width:20px;margin-top:2px;accent-color:var(--mint);}
.lead-form .check span{font-size:12px;line-height:1.6;color:#e2f3ec;}
.form-submit {border:0;border-radius:12px;background:var(--mint);font-weight:800;font:inherit;color:#031c16;cursor:pointer;min-height:50px;padding:14px 16px;}
.form-submit:disabled{opacity:.6;cursor:wait;}.form-status{margin-top:15px;border:1px solid #4b7767;background:#082c31;padding:14px;border-radius:12px;color:#c5f2df;line-height:1.6;font-size:13px;}
.form-status.error{border-color:#a65555;background:#3d222c;color:#ffd4ca;}
.form-status a{display:inline-block;background:#62eac0;color:#043026;padding:10px 16px;border-radius:9px;font-weight:800;margin-top:12px;text-decoration:none;}
.form-status strong{color:var(--gold);font-size:15px;letter-spacing:.05em;}
@media(max-width:840px){.signup-section{grid-template-columns:1fr;gap:15px;}}
@media(max-width:550px){.signup-section{padding:18px}.form-column{padding:18px}.lead-form{grid-template-columns:1fr}.lead-form .full{grid-column:1;}}

@media(max-width:820px){.hero{grid-template-columns:1fr;gap:20px;padding:49px 0 35px;}.illustration{height:270px;order:-1;}.orbit{width:225px;box-shadow:0 0 0 25px #44e5b10b,0 0 0 48px #44e5b109;}.center-icon{font-size:75px;}.pill.one{left:0;top:13%;}.pill.two{right:0;bottom:12%;}.features{grid-template-columns:1fr;gap:12px;padding:25px 0 45px;}.feature{min-height:auto;}footer{flex-direction:column;gap:5px;}h1{max-width:650px;}.stats{grid-template-columns:1fr;}}
@media(max-width:420px){.container{width:calc(100% - 36px);}header{padding-top:20px}.brand{font-size:11px}.brand strong{font-size:15px}.tag{font-size:10px;padding:8px}.mark{width:47px;height:47px;font-size:25px}.hero{padding-top:24px}.illustration{height:245px}.pill{font-size:10px;padding:10px}.orbit{width:195px}.eyebrow{font-size:11px}h1{font-size:42px}.cta{width:100%;padding:18px 15px;font-size:16px;}}
`;

function frame(content, title, description) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#031722"><meta name="description" content="${description}"><title>${title}</title><link rel="icon" type="image/svg+xml" href="/favicon.svg"><style>${styles}</style><script defer src="/assets/landing.js"></script></head><body>${content}</body></html>`;
}

const brand = `<div class="brand"><span class="mark" aria-hidden="true">◎</span><span>CAÇA PROMOS<br><strong>VIP 👑</strong></span></div>`;

export function renderLanding(origem) {
  const entrar = `/entrar?origem=${encodeURIComponent(origem)}`;
  return frame(`<div class="container"><header>${brand}<span class="tag">Amazon + Mercado Livre</span></header><main class="hero"><section><p class="eyebrow">O seu radar de boas oportunidades</p><h1>A gente caça.<br><span>Você economiza.</span></h1><p class="lead">Ofertas selecionadas de eletrônicos, fones, acessórios úteis, eletrodomésticos e muito mais — reunidas em um só grupo gratuito no WhatsApp.</p><a class="cta" href="${entrar}" rel="nofollow">Entrar no grupo VIP <span aria-hidden="true">↗</span></a><p class="notes">✅ Participação gratuita · 🔎 Ofertas selecionadas · 🛒 Amazon e Mercado Livre<br>Preços e disponibilidade podem mudar. A participação é voluntária.</p></section><div class="illustration" aria-hidden="true"><div class="orbit"><div class="center-icon">👑</div></div><div class="pill one">🎧 <strong>Fones e tecnologia</strong></div><div class="pill two">💚 <strong>Economia inteligente</strong></div></div></main><section class="signup-section" aria-label="Cadastro voluntário"><div><p class="eyebrow">Um convite a mais, só se você quiser</p><h2>Prefere receber <span>convites individuais?</span></h2><p>Entrar no grupo é gratuito e não exige cadastro. Você também pode solicitar mensagens individuais de promoções e novidades em seu WhatsApp, usando o formulário ao lado.</p><p>Para proteger o seu número, só consideramos a autorização confirmada depois que <strong>você mesmo iniciar uma conversa</strong> com nosso segundo WhatsApp e enviar um código.</p><p class="notes">Sem listas copiadas de outros grupos. Cancelamento a qualquer momento: responda SAIR.</p></div><div class="form-column"><form id="signupForm" class="lead-form"><div><label for="leadName">Seu nome (opcional)</label><input id="leadName" type="text" maxlength="80" autocomplete="given-name" placeholder="Como quer ser chamado?"></div><div><label for="leadPhone">Seu WhatsApp com DDD</label><input id="leadPhone" type="tel" inputmode="tel" autocomplete="tel-national" required placeholder="(11) 99999-9999"></div><div class="full" aria-hidden="true" style="display:none"><label for="leadWebsite">Site</label><input id="leadWebsite" type="text" tabindex="-1" autocomplete="off"></div><div class="full check"><input id="leadConsent" type="checkbox" required><span><label for="leadConsent" style="margin:0;color:inherit;font-weight:500">Quero receber mensagens <strong>individuais</strong> do Caça Promos VIP no WhatsApp sobre promoções da Amazon e Mercado Livre. Entendo que preciso confirmar minha solicitação e posso cancelar respondendo SAIR.</label></span></div><button id="signupButton" type="submit" class="full form-submit">Solicitar convite individual →</button></form><div id="signupStatus" class="form-status" role="status" aria-live="polite" hidden></div><p style="margin:11px 0 0;font-size:11px">Seus dados ficam armazenados somente para essa comunicação, com registro da autorização. <strong>O cadastro é opcional.</strong></p></div></section><section class="features"><article class="feature"><div class="feature-icon">◈</div><h2>Ofertas selecionadas</h2><p>Priorizamos produtos úteis e descontos que façam sentido.</p></article><article class="feature"><div class="feature-icon">⌖</div><h2>Mais variedade</h2><p>De fones acessíveis a eletrônicos e eletrodomésticos de maior valor.</p></article><article class="feature"><div class="feature-icon">♧</div><h2>Menos tempo procurando</h2><p>Veja oportunidades reunidas no grupo e decida se vale a compra.</p></article></section><footer><span><strong>Caça Promos VIP 👑</strong> · @caca.promos.ofc<br>Se você preencher o cadastro opcional, armazenaremos seu telefone e sua autorização para mensagens individuais. Sem cadastro, você pode apenas entrar no grupo. Consulte também a privacidade do WhatsApp.</span><span>Alguns links de produtos do grupo podem gerar comissão de afiliado, sem custo adicional para você.</span></footer></div>`, 'Caça Promos VIP 👑 | Ofertas selecionadas', 'Entre voluntariamente no Caça Promos VIP e acompanhe ofertas selecionadas da Amazon e do Mercado Livre.');
}

function inteiro(n) { return Intl.NumberFormat('pt-BR').format(n); }
function porcentagem(cliques, visitas) { return visitas ? `${(100 * cliques / visitas).toFixed(1).replace('.', ',')}%` : '0%'; }

export function renderRelatorio(dados, token) {
  const campanhas = Object.entries(dados.campanhas).sort((a,b)=>b[1].visitas-a[1].visitas);
  const total = campanhas.reduce((acc,[,val])=>({visitas:acc.visitas+val.visitas,cliques:acc.cliques+val.cliques}),{visitas:0,cliques:0});
  const linhas = campanhas.map(([nome, dados]) => `<tr><td>${nome}</td><td>${inteiro(dados.visitas)}</td><td>${inteiro(dados.cliques)}</td><td>${porcentagem(dados.cliques,dados.visitas)}</td></tr>`).join('') || '<tr><td colspan="4">Nenhum dado registrado.</td></tr>';
  const diaria = Object.entries(dados.dias).sort(([a],[b])=>b.localeCompare(a)).slice(0,14).map(([dia, val])=>`<tr><td>${dia}</td><td>${inteiro(val.visitas)}</td><td>${inteiro(val.cliques)}</td><td>${porcentagem(val.cliques,val.visitas)}</td></tr>`).join('');
  return frame(`<div class="container dashboard"><header>${brand}<span class="tag">Relatório privado</span></header><p class="eyebrow">Piloto de captação voluntária</p><h1>Resultados do <span>experimento</span></h1><p class="lead">Acompanhe visitas e cliques por origem. <strong>Cliques não representam necessariamente novas entradas no grupo.</strong> Confira novos participantes manualmente no WhatsApp.</p><section class="stats"><div class="stat"><b>${inteiro(total.visitas)}</b><small>Visitas</small></div><div class="stat"><b>${inteiro(total.cliques)}</b><small>Cliques no convite</small></div><div class="stat"><b>${porcentagem(total.cliques,total.visitas)}</b><small>Visitas que clicaram</small></div></section><h2>Origem das campanhas</h2><table><thead><tr><th>Canal</th><th>Visitas</th><th>Cliques</th><th>Taxa</th></tr></thead><tbody>${linhas}</tbody></table><p><a href="/relatorio.csv?chave=${token}">Baixar relatório CSV agregado</a></p><h2>Últimos dias</h2><table><thead><tr><th>Dia (UTC)</th><th>Visitas</th><th>Cliques</th><th>Taxa</th></tr></thead><tbody>${diaria}</tbody></table><p class="notes">Esta tela usa somente métricas agregadas. A central de contatos armazena números fornecidos voluntariamente em arquivo separado e restrito; abra /painel para gerenciá-los.</p></div>`, 'Relatório | Caça Promos VIP', 'Métricas agregadas de visitas e cliques do piloto.');
}

export function renderFavicon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#031722"/><circle cx="32" cy="33" r="23" fill="none" stroke="#e3c47c" stroke-width="4"/><circle cx="32" cy="33" r="15" fill="none" stroke="#44e5b1" stroke-width="5"/><circle cx="32" cy="33" r="5" fill="#e3c47c"/></svg>`;
}
