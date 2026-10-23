import { createInterface } from 'node:readline';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';

const teste=process.env.CPV_WHATSAPP_MOCK_TEST==='true';
const perfil=resolve(process.cwd(),'data',
  teste?'whatsapp-profile-conexao-teste-'+process.pid:'whatsapp-profile');
const entrada=createInterface({input:process.stdin,crlfDelay:Infinity});
let iniciar=false;
let fechar=false;
let entradaFechada=false;

function evento(tipo:string) {
  process.stdout.write(JSON.stringify({tipo})+'\n');
}

entrada.on('line',linha=>{
  let comando;
  try{comando=JSON.parse(linha);}catch{return;}
  if(comando?.tipo==='ABRIR')iniciar=true;
  else if(comando?.tipo==='FECHAR')fechar=true;
});
entrada.on('close',()=>{
  entradaFechada=true;
  fechar=true;
});

async function aguardarInicio(){
  const inicio=Date.now();
  while(!iniciar && !entradaFechada && Date.now()-inicio<12_000){
    await new Promise(r=>setTimeout(r,80));
  }
  if(!iniciar)throw new Error('inicio-indisponivel');
}

async function identificar(page:Page):Promise<string>{
  try {
    if(page.isClosed())return 'FECHADO';
    const conversa=page.locator('#pane-side, [data-testid="chat-list"]').first();
    if(await conversa.isVisible({timeout:350}).catch(()=>false))return 'CONECTADO';
    const qr=page.locator('canvas, [data-testid="qrcode"]').first();
    if(await qr.isVisible({timeout:350}).catch(()=>false))return 'QR';
  }catch{/* Whatsapp pode estar carregando a interface */}
  return 'AGUARDANDO';
}

async function executar():Promise<void>{
  await aguardarInicio();
  let contexto:BrowserContext|null=null;
  try {
    evento('ABRINDO');
    contexto=await chromium.launchPersistentContext(perfil,{
      channel:process.env.WHATSAPP_BROWSER_CHANNEL||'chrome',
      headless:teste,
      viewport:teste?{width:1200,height:850}:null,
      args:teste?[]:['--start-maximized','--window-position=0,0'],
    });
    const pagina=contexto.pages()[0]||await contexto.newPage();
    if(teste){
      await pagina.setContent(`<!doctype html><html lang="pt-BR"><body>
        <main id="app"><h1>WhatsApp simulado</h1>
          <canvas id="qr-teste" width="100" height="100"></canvas>
        </main>
        <script>
          setTimeout(()=>{
            document.querySelector('#qr-teste')?.remove();
            const conversas=document.createElement('aside');
            conversas.id='pane-side';
            conversas.textContent='Conversas fictícias conectadas';
            document.querySelector('#app').append(conversas);
          },1200);
        </script>
      </body></html>`);
    } else {
      await pagina.goto('https://web.whatsapp.com/',{
        waitUntil:'domcontentloaded',timeout:75_000,
      });
      await pagina.bringToFront();
    }
    evento('ABERTO');
    let ultimo='';
    while(!fechar && !pagina.isClosed()){
      const atual=await identificar(pagina);
      if(atual!==ultimo){
        evento(atual);
        ultimo=atual;
      }
      await new Promise(r=>setTimeout(r,550));
    }
    evento('FECHADO');
  }finally{
    await contexto?.close().catch(()=>undefined);
    if(teste)await rm(perfil,{recursive:true,force:true}).catch(()=>undefined);
  }
}

executar().catch(error=>{
  const codigo=error instanceof Error?error.message:'desconhecido';
  const permitidos=['inicio-indisponivel'];
  evento(permitidos.includes(codigo)?'INICIO_ERRO':'ERRO');
  process.exitCode=1;
}).finally(()=>{
  entrada.close();
  process.stdin.pause();
});
