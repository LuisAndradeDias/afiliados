import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.cwd(),tmp=await mkdtemp(join(tmpdir(),'meli10-preview-'));
const stub=join(tmp,'rede-simulada.mjs');
await writeFile(stub,`const price=Number(process.env.SAMPLE_PRICE);
const date=x=>new Date(Date.now()+x).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
globalThis.fetch=async(input,opts={})=>{
 const u=new URL(String(input));
 if((opts.method||'GET')!=='GET')throw Error('ESCRITA_PROIBIDA');
 const json=(body)=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
 if(u.host==='www.mercadolivre.com.br'&&u.pathname==='/l/promocoes')return new Response(
  'Cupom TESTE30 válido de '+date(-86400000)+' até '+date(86400000)+'. Desconto de 30%. Compra a partir de R$ 50,00. Itens elegíveis.',{status:200});
 if(u.host!=='api.mercadolibre.com')throw Error('REDE_FORA_DO_TESTE');
 if(u.pathname==='/products/search')return json({results:[{id:'MLB2001',name:'Fone bluetooth teste',status:'active'}],paging:{total:1}});
 if(u.pathname==='/products/MLB2001/items')return json({results:[{item_id:'MLB1001',seller_id:99,price,original_price:100,condition:'new'}]});
 if(u.pathname==='/users/bulk')return json([{status_code:200,body:{id:99,seller_reputation:{level_id:'5_green'}}}]);
 if(u.pathname==='/items/MLB1001')return json({id:'MLB1001',seller_id:99,status:'active',condition:'new',price,original_price:100,title:'Fone bluetooth teste',permalink:'https://produto.mercadolivre.com.br/MLB-1001-fone-bluetooth-_JM'});
 throw Error('ENDPOINT_NAO_SIMULADO '+u.pathname);
};`);
try{
 for(const [price,expected]of [[90,2],[75,0]]){
  const work=join(tmp,String(price));await mkdir(work);
  const env:NodeJS.ProcessEnv={PATH:process.env.PATH,Path:process.env.Path,SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,
   TEMP:work,TMP:work,LOCALAPPDATA:work,MERCADOLIVRE_ACCESS_TOKEN:'token-falso',MERCADOLIVRE_REFRESH_TOKEN:'',
   MERCADOLIVRE_TOKEN_EXPIRES_AT:String(Date.now()+3600000),MERCADOLIVRE_QUERIES_PER_RUN:'1',
   MERCADOLIVRE_EXTRA_QUERIES_ON_EMPTY:'0',MERCADOLIVRE_SEARCH_PAGES_PER_QUERY:'1',
   MERCADOLIVRE_PRODUCTS_CHECKED_PER_QUERY:'5',MERCADOLIVRE_REQUEST_INTERVAL_MS:'1',SAMPLE_PRICE:String(price)};
  const child=spawn(process.execPath,['--import',pathToFileURL(resolve(root,'node_modules/tsx/dist/loader.mjs')).href,
   '--import',pathToFileURL(stub).href,resolve(root,'src/robo/mercadolivre-preview.ts')],{cwd:work,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  let log='';child.stdout.on('data',b=>log+=String(b));child.stderr.on('data',b=>log+=String(b));
  const timer=setTimeout(()=>child.kill(),30000);
  const code=await new Promise<number|null>((ok,fail)=>{child.on('error',fail);child.on('close',ok)});clearTimeout(timer);
  assert.equal(code,expected,log.slice(-1600));
  const file=join(work,'data','ultima-oferta-mercadolivre.json');
  if(price===90)await assert.rejects(readFile(file),(e:any)=>e.code==='ENOENT');
  else{const offer=JSON.parse(await readFile(file,'utf8'));assert.equal(offer.precoAtual,75);assert.equal(offer.descontoEfetivoPercentual,25);assert.equal(offer.cupomCodigo,'TESTE30');}
  await assert.rejects(readFile(join(work,'data','ultima-oferta-whatsapp.json')),(e:any)=>e.code==='ENOENT');
  console.log('MELI10_PREVIEW_BASE_'+(100-price)+'_EXIT_'+code+'_SEM_ENVIO');
 }
}finally{await rm(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
