/** MELI-07: servidor real isolado; filhos ficticios; zero APIs/WhatsApp. */
import assert from 'node:assert/strict';
import {spawn, type ChildProcess} from 'node:child_process';
import {cp,mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:net';
import {chromium} from 'playwright';
const root=process.cwd(), temp=await mkdtemp(join(tmpdir(),'cpv-meli07-'));
const outputs=join(root,'test-results','meli07'); await mkdir(outputs,{recursive:true});
await mkdir(join(temp,'node_modules','tsx','dist'),{recursive:true});
await mkdir(join(temp,'data'),{recursive:true});
await cp(join(root,'src','painel','public'),join(temp,'src','painel','public'),{recursive:true});
await writeFile(join(temp,'node_modules','tsx','dist','cli.mjs'),[
  "import {readFileSync,writeFileSync,existsSync} from 'node:fs';",
  "const meli=String(process.argv[2]).includes('mercadolivre');",
  "const file='data/'+(meli?'meli':'amazon')+'-runs.txt';",
  "writeFileSync(file,String((existsSync(file)?Number(readFileSync(file,'utf8')):0)+1));",
  "if(!meli)process.exit(2);",
  "const mode=readFileSync('data/scenario.txt','utf8');",
  "if(mode==='permissao'){console.error('MERCADOLIVRE_PERMISSION_REQUIRED: HTTP 403 acesso negado');process.exitCode=4;}",
  "else{process.stderr.write('MERCADOLIVRE_RATE_LIMIT: HTTP 429 retry_af');setTimeout(()=>process.stderr.write('ter_ms=720'),40);setTimeout(()=>{process.stderr.write('000.');process.exitCode=5;},80);}"
].join('\n'),'utf8');
const net=createServer();await new Promise<void>(ok=>net.listen(0,'127.0.0.1',ok));
const addr=net.address();assert.ok(addr&&typeof addr!=='string');const port=addr.port;
await new Promise<void>(ok=>net.close(()=>ok()));const base='http://127.0.0.1:'+port;
const env:NodeJS.ProcessEnv={PATH:process.env.PATH,Path:process.env.Path,SystemRoot:process.env.SystemRoot,
 WINDIR:process.env.WINDIR,LOCALAPPDATA:temp,TMP:temp,TEMP:temp,NODE_ENV:'test',PAINEL_PORT:String(port),
 ALTERNATING_MONITOR_ENABLED:'false',MERCADOLIVRE_MONITOR_ENABLED:'false',WHATSAPP_AUTO_SEND_ENABLED:'false',
 MERCADOLIVRE_ACCESS_TOKEN:'token-ficticio',MERCADOLIVRE_REFRESH_TOKEN:'',AMAZON_ASSOCIATE_TAG:'teste-20'};
let child:ChildProcess|null=null;let browser:Awaited<ReturnType<typeof chromium.launch>>|null=null;
async function stop(){if(!child)return;const p=child;child=null;if(p.exitCode!==null)return;
 const exited=new Promise<void>(ok=>p.once('exit',()=>ok()));p.kill();await Promise.race([exited,new Promise<void>(ok=>setTimeout(ok,3000))]);}
async function start(){child=spawn(process.execPath,['--import',pathToFileURL(resolve(root,'node_modules/tsx/dist/loader.mjs')).href,resolve(root,'src/painel/server.ts')],{cwd:temp,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
 let logs='';child.stderr?.on('data',x=>{logs+=String(x)});
 for(let i=0;i<65;i++){if(child.exitCode!==null)throw Error('SERVER_EXIT '+logs);try{if((await fetch(base+'/api/status',{signal:AbortSignal.timeout(500)})).ok)return;}catch{}await new Promise(ok=>setTimeout(ok,150));}
 throw Error('START_TIMEOUT '+logs);
}
async function state(){return await (await fetch(base+'/api/status')).json() as any;}
async function action(name:string){return await fetch(base+'/api/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:name})});}
async function idle(){for(let i=0;i<60;i++){const s=await state();if(s.executando.length===0)return s;await new Promise(ok=>setTimeout(ok,100));}throw Error('NOT_IDLE');}
let failures=0;
try{
 for(const tipo of ['permissao','limite']){
  try{
   await writeFile(join(temp,'data','scenario.txt'),tipo);await rm(join(temp,'data','meli-runs.txt'),{force:true});
   await start();const before=await state();assert.equal(before.monitorAlternadoAtivo,false);
   assert.equal((await action('mercadolivre-buscar')).status,200);
   const s=await idle();
   assert.ok(s.mercadoLivreBuscaBloqueio,'Erro nao pode desaparecer como busca vazia');
   assert.equal(s.mercadoLivreBuscaBloqueio.tipo,tipo);
   assert.ok(s.mercadoLivreBuscaBloqueio.ate-Date.now()>=(tipo==='limite'?720000:480000)-5000,
     'Respeitar Retry-After inteiro mesmo quando stdout vem fragmentado');
   assert.equal(s.operacaoEstado,'error');assert.equal(s.ofertaPreparada,false);
   assert.equal(s.whatsappEnvioPendente,false);assert.equal(s.monitorAlternadoAtivo,false);
   assert.equal(s.descontoMinimo,20);assert.equal(s.cooldownHoras,24);assert.equal(s.previewCooldownMinutos,120);
   assert.equal((await action('mercadolivre-buscar')).status,409,'Nao martelar API bloqueada');
   assert.equal((await action('mercadolivre-fluxo')).status,409);
   assert.equal(await readFile(join(temp,'data','meli-runs.txt'),'utf8'),'1');
   assert.equal((await action('buscar')).status,200,'Amazon nao depende da permissao Meli');await idle();
   browser??=await chromium.launch({channel:'chrome',headless:true});
   for(const width of [1595,390]){
    const ctx=await browser.newContext({viewport:{width,height:950},locale:'pt-BR',reducedMotion:'reduce'});
    let writes=0;await ctx.route('**/*',async route=>{if(route.request().method()!=='GET'||new URL(route.request().url()).origin!==base){writes++;await route.abort();}else await route.continue();});
    const page=await ctx.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/ofertas',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.getElementById('cpvLiveTitle')?.textContent?.includes('Mercado Livre'));
    const title=await page.locator('#cpvLiveTitle').innerText();
    assert.match(title,tipo==='permissao'?/acesso negado/i:/limite da API/i);
    assert.equal(await page.locator('#meliDot.warn').count(),1);
    assert.equal(await page.locator('button[data-action="mercadolivre-buscar"]').isDisabled(),true);
    assert.equal(await page.locator('#cpvOpsPanel').getAttribute('data-state'),'attention');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=1));
    assert.deepEqual(errors,[]);assert.equal(writes,0);
    await page.screenshot({path:join(outputs,tipo+'-'+width+'.png'),fullPage:true,animations:'disabled'});
    await ctx.close();
   }
   console.log('PASS BLOQUEIO_'+tipo.toUpperCase()+'_HTTP_UI');
  }catch(e){failures++;console.error('FAIL '+tipo+': '+String(e));}
  finally{await stop();}
 }
}finally{await browser?.close();await stop();await rm(temp,{recursive:true,force:true,maxRetries:5,retryDelay:150});}
if(failures)process.exitCode=1;
else console.log('MELI07_BLOQUEIO_OK: 403/429, espera real, Amazon independente, 4 capturas, zero envios.');
