/** Executa o preview real com fetch isolado, sem acessar APIs ou credenciais reais. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.cwd(),tmp=await mkdtemp(join(tmpdir(),'cpv-meli07-preview-'));
const stub=join(tmp,'fetch-isolado.mjs');
await writeFile(stub,`globalThis.fetch=async(input,init={})=>{
  const url=new URL(String(input));
  if((init.method??'GET')!=='GET')throw Error('No writes permitted');
  if(url.hostname==='api.mercadolibre.com')return new Response('{}',{
    status:Number(process.env.STUB_HTTP),headers:{'retry-after':'720'}
  });
  if(url.hostname==='mercadolivre.com.br'||url.hostname.endsWith('.mercadolivre.com.br'))
    return new Response('<html></html>',{status:200});
  throw Error('External network blocked');
};`,'utf8');
try{
 for(const code of [403,429]){
  const env:NodeJS.ProcessEnv={PATH:process.env.PATH,Path:process.env.Path,SystemRoot:process.env.SystemRoot,
   WINDIR:process.env.WINDIR,TEMP:tmp,TMP:tmp,LOCALAPPDATA:tmp,
   MERCADOLIVRE_ACCESS_TOKEN:'token-falso',MERCADOLIVRE_REFRESH_TOKEN:'',
   MERCADOLIVRE_TOKEN_EXPIRES_AT:String(Date.now()+3600000),
   MERCADOLIVRE_QUERIES_PER_RUN:'1',MERCADOLIVRE_EXTRA_QUERIES_ON_EMPTY:'0',STUB_HTTP:String(code)};
  const child=spawn(process.execPath,['--import',pathToFileURL(resolve(root,'node_modules/tsx/dist/loader.mjs')).href,
    '--import',pathToFileURL(stub).href,resolve(root,'src/robo/mercadolivre-preview.ts')],
    {cwd:tmp,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  let logs='';child.stdout.on('data',x=>{logs+=String(x)});child.stderr.on('data',x=>{logs+=String(x)});
  const timer=setTimeout(()=>child.kill(),20000);
  const exit=await new Promise<number|null>((ok,no)=>{child.on('error',no);child.on('close',ok)});
  clearTimeout(timer);
  assert.equal(exit,code===403?4:5,logs.slice(-1000));
  assert.match(logs,code===403?/MERCADOLIVRE_PERMISSION_REQUIRED/:/MERCADOLIVRE_RATE_LIMIT/);
  if(code===429)assert.match(logs,/retry_after_ms=720000/);
  assert.doesNotMatch(logs,/Nenhuma oferta/,'Falha de acesso nao e busca vazia');
  for(const f of ['ultima-oferta-mercadolivre.json','ultima-oferta-whatsapp.json','rotacao-mercadolivre.json']){
    await assert.rejects(readFile(join(tmp,'data',f)),(e:any)=>e.code==='ENOENT');
  }
  console.log('PASS PREVIEW_HTTP_'+code+'_EXIT_'+exit);
 }
 console.log('MELI07_PREVIEW_OK: códigos propagados, sem oferta/rotação artificial, zero rede real.');
}finally{await rm(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
