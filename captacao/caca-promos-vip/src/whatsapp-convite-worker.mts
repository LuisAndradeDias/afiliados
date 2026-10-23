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
// A espera curta permite observar envios feitos DIRETAMENTE no WhatsApp,
// sem precisar de outro clique no painel. Nunca devolve comandos fictícios.
function receber(timeoutMs=0):Promise<Comando|null> {
  const proximo=comandos.shift();
  if(proximo)return Promise.resolve(proximo);
  return new Promise(resolve=>{
    let timeout:ReturnType<typeof setTimeout>|null=null;
    const concluido=(cmd:Comando)=>{
      if(timeout)clearTimeout(timeout);
      resolve(cmd);
    };
    esperando.push(concluido);
    if(timeoutMs>0){
      timeout=setTimeout(()=>{
        const index=esperando.indexOf(concluido);
        if(index>=0)esperando.splice(index,1);
        resolve(null);
      },timeoutMs);
    }
  });
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
  if(!comando || comando.tipo!=='INICIAR')throw new Error('inicio-invalido');
  const telefone=String(comando.telefone||'');
  const mensagem=String(comando.mensagem||'').trim();
  if(!/^55\d{10,11}$/.test(telefone) ||
      mensagem.length<40 || mensagem.length>3000 ||
      !mensagem.includes('chat.whatsapp.com/') ||
      !mensagem.includes('SAIR')) {
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
          document.querySelector('footer [contenteditable]').addEventListener('keydown',e=>{
            if(e.key==='Enter'&&!e.shiftKey){
              e.preventDefault();
              document.querySelector('button').click();
            }
          });
          document.querySelector('button').addEventListener('click',()=>{
            const campo=document.querySelector('footer [contenteditable]');
            const texto=campo.innerText;
            if(!texto.trim())return;
            // Diagnostico simulado: WhatsApp limpou o rascunho mas nao
            // criou balão de saida. NUNCA executado em sessao verdadeira.
            if(${process.env.CPV_WHATSAPP_MOCK_DROP_DRAFT==='true'}) {
              campo.innerText='';
              return;
            }
            const balão=document.createElement('div');
            balão.className='message-out';
            balão.setAttribute('data-id','true_' + Math.random());
            balão.innerText=texto;
            document.querySelector('#mensagens').append(balão);
            campo.innerText='';
          });
        </script></body></html>`);
    } else {
      // A URL abre APENAS a conversa. O texto e colocado depois de o DOM
      // estabilizar e de o observador registrar as mensagens anteriores.
      // O parametro &text podia disputar com a re-renderizacao do WhatsApp,
      // fazendo o rascunho desaparecer sem comprovacao de envio.
      const destino='https://web.whatsapp.com/send?phone='+telefone+
        '&app_absent=0';
      await page.goto(destino,{waitUntil:'domcontentloaded',timeout:90_000});
      await page.locator('#main header').first().waitFor({
        state:'visible',timeout:150_000,
      });
      await page.bringToFront();
      await trazerWhatsappParaTelaPrincipal().catch(()=>undefined);
    }
    const campo=await compositor(page);
    const titulo=await page.locator('#main header [title]').first()
      .getAttribute('title').catch(()=>null);
    if(!titulo)throw new Error('destinatario-nao-confirmavel');
    // Capturar ANTES do primeiro caractere: um clique manual muito rapido
    // nao pode acabar incorporado ao baseline e desaparecer do historico.
    const baseline=await captureSendBaseline(page,mensagem);
    await campo.fill(mensagem);
    // Aguardar o estado controlado do WhatsApp estabilizar, sem enviar.
    if(!testMode)await page.waitForTimeout(850);
    const confirmado=(await campo.innerText().catch(()=>'')).trim();
    if(textoComparavel(confirmado)!==textoComparavel(mensagem))
      throw new Error('texto-nao-conferiu');
    const botao=await botaoEnviar(page);
    if(await botao.isDisabled())throw new Error('botao-desabilitado');
    evento('PRONTO');

    // Apenas teste ficticio: permitir simular um clique manual no WhatsApp.
    if(testMode && process.env.CPV_WHATSAPP_MOCK_SEND_IN_BROWSER==='true'){
      setTimeout(()=>{
        const action=process.env.CPV_WHATSAPP_MOCK_SEND_WITH_ENTER==='true'
          ?campo.press('Enter'):botao.click();
        void action.catch(()=>undefined);
      },550);
    }
    // Mesmo sem ENVIAR pelo painel, observar a conversa a cada 400 ms.
    // Campo vazio NAO e prova de envio; somente um novo balao de saida
    // com referencia ao convite pode confirmar a operacao.
    let campoVazioDesde:number|null=null;
    while(true){
      const acao=await receber(400);
      if(page.isClosed())throw new Error('janela-fechada');
      if(await detectManualSend(page,baseline).catch(()=>false)){
        evento('CONFIRMADO');return;
      }
      const tituloAtual=await page.locator('#main header [title]').first()
        .getAttribute('title').catch(()=>null);
      if(tituloAtual!==titulo)throw new Error('conversa-alterada');
      const textoAtual=await campo.innerText().catch(()=>null);
      if(textoAtual===null)throw new Error('campo-indisponivel');
      const textoNormal=textoComparavel(textoAtual);
      const igual=textoNormal===textoComparavel(mensagem);
      // Um clique no Chrome (botao OU Enter) pode limpar o texto sem produzir
      // nova mensagem. Aguardar renderizacao e registrar INCERTO sem retry.
      if(!textoNormal){
        campoVazioDesde??=Date.now();
      }else{
        campoVazioDesde=null;
      }
      if(acao?.tipo==='CANCELAR'){
        if(!igual){
          evento('INCERTO','rascunho-alterado-antes-de-cancelar');
          return;
        }
        evento('CANCELADO');return;
      }
      if(!acao){
        if(campoVazioDesde && Date.now()-campoVazioDesde >=
          (testMode?2100:6500)){
          if(await detectManualSend(page,baseline).catch(()=>false)){
            evento('CONFIRMADO');return;
          }
          evento('INCERTO','texto-sumiu-sem-envio-confirmado');
          return;
        }
        continue;
      }
      if(acao.tipo!=='ENVIAR')continue;
      if(!igual){
        // Nao clicar novamente se o usuario pode ter enviado pelo Chrome.
        // A observacao da mensagem pode estar atrasada.
        const inicio=Date.now();
        while(Date.now()-inicio<(testMode?1800:6500)){
          if(await detectManualSend(page,baseline).catch(()=>false)){
            evento('CONFIRMADO');return;
          }
          await new Promise(resolve=>setTimeout(resolve,300));
        }
        evento('INCERTO','rascunho-nao-confere-com-convite');
        return;
      }
      evento('ENVIANDO');
      try {
        if(testMode)await botao.click();
        else await clicarComPonteiro(page,botao);
      } catch {
        // Nunca usar Enter como fallback. O clique pode ter ocorrido.
        throw new Error('clique-nao-confirmado');
      }
      // Somente Chrome FICTICIO: simula interrupcao depois do clique.
      if(testMode && process.env.CPV_WHATSAPP_MOCK_FAIL_AFTER_CLICK==='true'){
        throw new Error('resultado-incerto');
      }
      const inicio=Date.now();
      while(Date.now()-inicio<(testMode?3500:18_000)){
        if(await detectManualSend(page,baseline).catch(()=>false)){
          evento('CONFIRMADO');return;
        }
        await new Promise(resolve=>setTimeout(resolve,300));
      }
      // Campo vazio sozinho nao valida envio. Jamais clicar pela 2a vez.
      evento('INCERTO','sem-balao-confirmado-apos-clique');
      return;
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
