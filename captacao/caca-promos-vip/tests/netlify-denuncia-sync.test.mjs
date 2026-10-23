import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {iniciarContatos} from '../src/contatos.mjs';
import {iniciarDenuncias} from '../src/denuncias.mjs';
import {iniciarSincronizacaoNetlify,lerConfigNetlify} from '../src/netlify-denuncia-sync.mjs';
import {assinatura,validarToken,receberDenuncia,sincronizarDenuncias}
  from '../denuncias-netlify/lib/denuncia-core.mjs';

const origin='https://cpv-test.netlify.app';
function fakeStore(){
  const dados=new Map();
  return {
    async get(key){return dados.get(key)||null;},
    async setJSON(key,value){dados.set(key,value);},
    async list({prefix}){return {blobs:[...dados.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))};},
    async delete(key){dados.delete(key);},total:()=>dados.size,
  };
}
function req(path,{method='GET',body=null,secret='',originHeader=origin}={}){
  const headers={};
  if(body!==null){headers['content-type']='application/json';}
  if(originHeader)headers.origin=originHeader;
  if(secret)headers.authorization='Bearer '+secret;
  return new Request(origin+path,{method,headers,
    body:body===null?undefined:JSON.stringify(body)});
}

test('Netlify aceita somente um clique com token assinado e guarda até sincronizar',async()=>{
  const store=fakeStore(),secret=randomBytes(32).toString('hex'),id=randomUUID();
  const token=id+'.'+assinatura(id,secret);
  assert.equal(validarToken(token,secret),id);
  assert.equal(validarToken(id+'.'+'0'.repeat(64),secret),null);
  assert.equal(store.total(),0,'GET da página não deve registrar nada');
  const errado=await receberDenuncia(req('/api/denunciar',{
    method:'POST',body:{token:id+'.'+'0'.repeat(64)}}),{store,secret});
  assert.equal(errado.status,404);
  const csrf=await receberDenuncia(req('/api/denunciar',{
    method:'POST',body:{token},originHeader:'https://outro.invalid'}),{store,secret});
  assert.equal(csrf.status,403);
  assert.equal(store.total(),0);
  const ok=await receberDenuncia(req('/api/denunciar',{
    method:'POST',body:{token}}),{store,secret});
  assert.equal(ok.status,202);
  assert.equal(store.total(),1);
  assert.equal((await receberDenuncia(req('/api/denunciar',{
    method:'POST',body:{token}}),{store,secret})).status,202);
  assert.equal(store.total(),1);
  const naoAutorizado=await sincronizarDenuncias(req('/api/denuncias-pendentes'),{store,secret});
  assert.equal(naoAutorizado.status,401);
  const pend=await sincronizarDenuncias(req('/api/denuncias-pendentes',{secret}),{store,secret});
  assert.equal(pend.status,200);
  assert.deepEqual((await pend.json()).eventos.map(e=>e.token),[token]);
  const ack=await sincronizarDenuncias(req('/api/denuncias-pendentes',{
    method:'POST',body:{token},secret}),{store,secret});
  assert.equal(ack.status,200);
  assert.equal(store.total(),0);
});

test('ACER obtém denúncia assinada via saída HTTPS, bloqueia e confirma no Netlify',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cpv-netlify-sync-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const secret=randomBytes(32).toString('hex'),store=fakeStore();
  const contatos=iniciarContatos(dir);
  const denuncias=iniciarDenuncias(dir,contatos);
  const telefone='11988887777';
  contatos.importarConsentimentosExternos({
    pessoas:[{nome:'Pessoa Fictícia',telefone}],
    origemAutorizacao:'Conversa ficticia autorizada',
    referenciaAutorizacao:'Evidência fictícia de teste de consentimento',
    dataAutorizacao:'2026-10-10',declaracao:true,
  });
  const contato=contatos.listar()[0],token=denuncias.tokenNetlify(contato,secret);
  assert.equal(validarToken(token,secret),contato.id);
  assert.doesNotMatch(token,/55119|88887777/);
  assert.equal((await receberDenuncia(req('/api/denunciar',{
    method:'POST',body:{token}}),{store,secret})).status,202);
  const fetchImpl=async(url,opts={})=>{
    const request=new Request(url,opts);
    return sincronizarDenuncias(request,{store,secret});
  };
  const sync=iniciarSincronizacaoNetlify({
    config:{publicBaseUrl:origin,segredo:secret},denuncias,fetchImpl,
  });
  assert.equal((await sync.sincronizar()).ok,true);
  assert.equal(sync.estado().importadas,1);
  assert.equal(store.total(),0);
  assert.equal(denuncias.estaBloqueado(contato.telefone),true);
  assert.equal(contatos.listar()[0].status,'descadastrado');
  assert.equal(denuncias.listar().length,1);
  assert.equal(denuncias.listar()[0].origem,'clique-confirmado-netlify');
  assert.equal((await sync.sincronizar()).novas,0);
  assert.equal(denuncias.listar().length,1);
  const tentativa=contatos.importarConsentimentosExternos({
    pessoas:[{nome:'Reentrada fictícia',telefone}],
    origemAutorizacao:'Conversa ficticia autorizada',
    referenciaAutorizacao:'Registro anterior fictício para teste',
    dataAutorizacao:'2026-10-10',declaracao:true,
    verificarBloqueio:n=>denuncias.estaBloqueado(n),
  });
  assert.equal(tentativa.bloqueados,1);
});

test('Sem Netlify configurado nenhum link falso e nenhum pedido de sync',()=>{
  const dir=mkdtempSync(join(tmpdir(),'cpv-non-netlify-'));
  try{
    assert.equal(lerConfigNetlify(dir,{}),null);
    const s=iniciarSincronizacaoNetlify({config:null});
    assert.equal(s.estado().configurada,false);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('página estática Netlify exige clique explícito e funciona em celular',async t=>{
  const {createRequire}=await import('node:module');
  const {createServer}=await import('node:http');
  const {readFileSync}=await import('node:fs');
  const require=createRequire(new URL('../../../package.json',import.meta.url));
  const {chromium}=require('playwright');
  const site=join(import.meta.dirname,'..','denuncias-netlify','public');
  const store=fakeStore();
  const secret=randomBytes(32).toString('hex');
  const id=randomUUID(),token=id+'.'+assinatura(id,secret);
  const servidor=createServer(async(req,res)=>{
    if(req.url.startsWith('/api/denunciar')){
      let body='';
      for await(const chunk of req)body+=String(chunk);
      const result=await receberDenuncia(new Request('http://127.0.0.1:'+servidor.address().port+req.url,{
        method:req.method,headers:req.headers,body,
      }),{store,secret});
      res.writeHead(result.status,{'content-type':'application/json'});
      res.end(await result.text());
      return;
    }
    const file=req.url.startsWith('/assets/denuncia.js')
      ?join(site,'assets','denuncia.js')
      :join(site,'denunciar','index.html');
    res.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':'text/html'});
    res.end(readFileSync(file));
  });
  await new Promise(done=>servidor.listen(0,'127.0.0.1',done));
  t.after(()=>new Promise(done=>servidor.close(done)));
  const browser=await chromium.launch({headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const base='http://127.0.0.1:'+servidor.address().port;
  await page.goto(base+'/denunciar/?token='+encodeURIComponent(token));
  assert.equal(store.total(),0);
  assert.match(await page.locator('main').innerText(),/não envia denúncia ao WhatsApp/i);
  await page.locator('#denunciar').click();
  await page.locator('#resposta').waitFor({state:'visible'});
  assert.match(await page.locator('#resposta').innerText(),/internamente no Caça Promos VIP/);
  assert.equal(store.total(),1);
  assert.ok(await page.locator('#denunciar').isHidden());
  const dimensions=await page.evaluate(()=>({
    w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth,
  }));
  assert.ok(dimensions.s<=dimensions.w+2,JSON.stringify(dimensions));
  await page.screenshot({path:'C:\\projeto01\\captacao\\caca-promos-vip\\dados\\previa-acer\\qa-netlify-denuncia-mobile.png',
    fullPage:true});
  assert.deepEqual(errors,[]);
});
