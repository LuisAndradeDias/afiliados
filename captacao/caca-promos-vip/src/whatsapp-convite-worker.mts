import { createInterface } from 'node:readline';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type BrowserContext, type Locator, type Page } from 'playwright';
import { clicarComPonteiro, trazerWhatsappParaTelaPrincipal } from '../../../src/robo/whatsapp-pointer.js';
import { captureSendBaseline, detectManualSend } from '../../../src/robo/whatsapp-envio-observer.js';

// Este processo controla SOMENTE uma conversa, apos acao explicita no painel.
// O perfil Chrome e o observador sao os mesmos do robo de promocoes.
// Nao existe laço de disparos, navegacao por lista ou retry automatico.
type Comando = {tipo:'INICIAR';telefone:string;mensagem:string} |
  {tipo:'ENVIAR'} | {tipo:'CANCELAR'};
const testMode=process.env.CPV_WHATSAPP_MOCK_TEST==='true';
const comandos:Comando[]=[];
const esperando:Array<(c:Comando)=>void>=[];
let entradaRecebida=false;
function evento(tipo:string, detalhe?:string) {
  process.stdout.write(JSON.stringify({tipo,detalhe})+'\n');
}
function receber():Promise<Comando> {
  const proximo=comandos.shift();
  if(proximo)return Promise.resolve(proximo);
  return new Promise(resolve=>esperando.push(resolve));
}
const linhas=createInterface({input:process.stdin,crlfDelay:Infinity});
linhas.on('line',(linha)=>{
  let comando:Comando;
  try {comando=JSON.parse(linha);}catch{return;}
  if (!['INICIAR','ENVIAR','CANCELAR'].includes(comando?.tipo))return;
  const waiter=esperando.shift();
  if(waiter)waiter(comando);else comandos.push(comando);
});
linhas.on('close',()=>{
  const waiter=esperando.shift();
  if(waiter)waiter({tipo:'CANCELAR'});
  else comandos.push({tipo:'CANCELAR'});
});

function textoComparavel(texto:string):string {
  return texto.normalize('NFC').replace(/\s+/g,' ').trim();
}

async function compositor(page:Page):Promise<Locator> {
  const candidatos=[
    page.locator('#main footer div[contenteditable="true"][role="textbox"]').first(),
    page.locator('footer div[contenteditable="true"][role="textbox"]').first(),
    page.getByRole('textbox',{name:/^digite uma mensagem$|^type a message$/i}).first(),
  ];
  for(const candidato of candidatos){
    try {await candidato.waitFor({state:'visible',timeout:2000});return candidato;}
    catch {/* tenta outro seletor */}
  }
  throw new Error('campo-indisponivel');
}
async function botaoEnviar(page:Page):Promise<Locator>{
  const candidatos=[
    page.locator('#main footer button:has([data-icon*="send"])').first(),
    page.locator('#main footer [role="button"]:has([data-icon*="send"])').first(),
    page.locator('#main footer button[aria-label*="Enviar"]').first(),
    page.locator('#main footer button[aria-label*="Send"]').first(),
    page.getByRole('button',{name:/^enviar$|^send$/i}).first(),
  ];
  for(const candidato of candidatos){
    try {await candidato.waitFor({state:'visible',timeout:1800});return candidato;}
    catch {/* tenta outro seletor */}
  }
  throw new Error('botao-indisponivel');
}
function numerosIguais(a:string,b:string):boolean{
  return a.replace(/\D/g,'')===b.replace(/\D/g,'');
}

async function executar():Promise<void> {
  const comando=await receber();
  if(comando.tipo!=='INICIAR')throw new Error('inicio-invalido');
  const telefone=String(comando.telefone||'');
  const mensagem=String(comando.mensagem||'').trim();
  if(!/^55\d{10,11}$/.test(telefone) ||
      mensagem.length<40 || mensagem.length>3000 ||
      !mensagem.includes('chat.whatsapp.com/') ||
      !mensagem.includes('SAIR') || !mensagem.includes('DENUNCIAR')) {
    throw new Error('destino-ou-mensagem-invalido');
  }
  entradaRecebida=true;
  const perfil=resolve(process.cwd(),'data',
    testMode?'whatsapp-profile-convite-teste-'+process.pid:'whatsapp-profile');
  let ctx:BrowserContext|null=null;
  try {
    evento('ABRINDO');
    ctx=await chromium.launchPersistentContext(perfil,{
      channel:process.env.WHATSAPP_BROWSER_CHANNEL||'chrome',
      headless:testMode,
      viewport:testMode?{width:1280,height:850}:null,
      args:testMode?[]:['--start-maximized','--window-position=0,0'],
    });
    const page=ctx.pages()[0]||await ctx.newPage();
    if(testMode) {
      await page.setContent(`<!doctype html><html><body>
        <div id="main">
          <header><span title="Contato ficticio">Contato ficticio</span></header>
          <div id="mensagens"></div>
          <footer>
            <div role="textbox" contenteditable="true" aria-label="Digite uma mensagem"></div>
            <button type="button" aria-label="Enviar"><span data-icon="send">Enviar</span></button>
          </footer>
        </div>
        <script>
          document.querySelector('button').addEventListener('click',()=>{
            const campo=document.querySelector('footer [contenteditable]');
            const texto=campo.innerText;
            if(!texto.trim())return;
            const balão=document.createElement('div');
            balão.className='message-out';
            balão.setAttribute('data-id','true_' + Math.random());
            balão.innerText=texto;
            document.querySelector('#mensagens').append(balão);
            campo.innerText='';
          });
        </script></body></html>`);
    } else {
      // A URL da conversa e fornecida pelo WhatsApp; usuario deve revisar
      // o destinatario visualmente ANTES de confirmar Enviar no painel.
      const destino='https://web.whatsapp.com/send?phone='+telefone+
        '&text='+encodeURIComponent(mensagem)+'&app_absent=0';
      await page.goto(destino,{waitUntil:'domcontentloaded',timeout:90_000});
      await page.locator('#main header').first().waitFor({
        state:'visible',timeout:150_000,
      });
      await page.bringToFront();
      await trazerWhatsappParaTelaPrincipal().catch(()=>undefined);
    }
    const campo=await compositor(page);
    const escrito=(await campo.innerText().catch(()=>'')).trim();
    if(textoComparavel(escrito)!==textoComparavel(mensagem))await campo.fill(mensagem);
    const confirmado=(await campo.innerText().catch(()=>'')).trim();
    if(textoComparavel(confirmado)!==textoComparavel(mensagem))
      throw new Error('texto-nao-conferiu');
    const botao=await botaoEnviar(page);
    if(await botao.isDisabled())throw new Error('botao-desabilitado');
    const titulo=await page.locator('#main header [title]').first()
      .getAttribute('title').catch(()=>null);
    if(!titulo)throw new Error('destinatario-nao-confirmavel');
    const baseline=await captureSendBaseline(page,mensagem);
    evento('PRONTO');

    // Somente um comando ENVIAR por conversa. Nunca ha tentativa repetida.
    while(true){
      const acao=await receber();
      if(acao.tipo==='CANCELAR'){
        if(await detectManualSend(page,baseline).catch(()=>false)){
          evento('CONFIRMADO');return;
        }
        evento('CANCELADO');return;
      }
      if(acao.tipo!=='ENVIAR')continue;
      if(page.isClosed())throw new Error('janela-fechada');
      const tituloAtual=await page.locator('#main header [title]').first()
        .getAttribute('title').catch(()=>null);
      if(tituloAtual!==titulo)throw new Error('conversa-alterada');
      // Se a pessoa clicou Enviar diretamente no Chrome enquanto o painel
      // estava aberto, reconhecer primeiro o balão novo, sem um segundo clique.
      if(await detectManualSend(page,baseline).catch(()=>false)){
        evento('CONFIRMADO');
        return;
      }
      const textoAtual=(await campo.innerText().catch(()=>'')).trim();
      if(textoComparavel(textoAtual)!==textoComparavel(mensagem))
        throw new Error('texto-alterado');
      evento('ENVIANDO');
      let clicado=false;
      try {
        if(testMode)await botao.click();
        else await clicarComPonteiro(page,botao);
        clicado=true;
      } catch {
        // Nao tentar Enter como fallback: poderia enviar 2 vezes.
        throw new Error('clique-nao-confirmado');
      }
      if(!clicado)throw new Error('clique-nao-confirmado');
      // Somente em Chrome FICTÍCIO: simula a queda após o clique para testar
      // o estado incerto, sem repetir a mensagem no WhatsApp real.
      if(testMode && process.env.CPV_WHATSAPP_MOCK_FAIL_AFTER_CLICK==='true'){
        throw new Error('resultado-incerto');
      }
      const inicio=Date.now();
      while(Date.now()-inicio<18_000){
        if(await detectManualSend(page,baseline).catch(()=>false)){
          evento('CONFIRMADO');
          return;
        }
        await new Promise(resolve=>setTimeout(resolve,300));
      }
      // Podera ter sido enviado: manter pendente de conciliacao, sem retry.
      throw new Error('resultado-incerto');
    }
  } finally {
    await ctx?.close().catch(()=>undefined);
    if(testMode)await rm(perfil,{recursive:true,force:true}).catch(()=>undefined);
  }
}

executar().catch(erro=>{
  const codigo=erro instanceof Error?erro.message:'erro';
  const conhecidos=[
    'inicio-invalido','destino-ou-mensagem-invalido','campo-indisponivel',
    'botao-indisponivel','botao-desabilitado','texto-nao-conferiu',
    'destinatario-nao-confirmavel','janela-fechada','conversa-alterada',
    'texto-alterado','clique-nao-confirmado','resultado-incerto',
  ];
  evento('ERRO',conhecidos.includes(codigo)?codigo:'falha-whatsapp');
  process.exitCode=1;
}).finally(()=>{
  linhas.close();
  process.stdin.pause();
});
