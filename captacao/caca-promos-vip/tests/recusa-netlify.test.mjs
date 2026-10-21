import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {iniciarContatos} from '../src/contatos.mjs';
import {iniciarDenuncias} from '../src/denuncias.mjs';
import {iniciarConvitesUnicos,MENSAGEM_PADRAO} from '../src/convites-unicos.mjs';
import {obterConfigMeta} from '../src/meta-cloud.mjs';
import {iniciarSincronizacaoNetlify,lerConfigNetlify} from '../src/netlify-denuncia-sync.mjs';
import {assinatura,validarToken,receberRecusa,receberDenuncia,sincronizarDenuncias}
  from '../denuncias-netlify/lib/denuncia-core.mjs';

const DOMAIN='https://site-teste.netlify.app';
const SECRET=randomBytes(32).toString('hex');
const require=createRequire(new URL('../../../package.json',import.meta.url));
const {chromium}=require('playwright');
function storeFake(){
  const pending=new Map();
  return {
    get:async(key)=>pending.get(key)||null,
    setJSON:async(key,value)=>{pending.set(key,value);},
    list:async({prefix})=>({blobs:[...pending.keys()]
      .filter(key=>key.startsWith(prefix)).map(key=>({key}))}),
    delete:async(key)=>{pending.delete(key);},
    total:()=>pending.size,
  };
}
const req=(path,{method='GET',body,secret,origin=DOMAIN}={})=>
  new Request(DOMAIN+path,{method,
    headers:{...(body?{'content-type':'application/json'}:{}),
      ...(secret?{authorization:'Bearer '+secret}:{}),
      ...(origin?{origin}:{})},
    body:body?JSON.stringify(body):undefined});
function storage(t){
  const dir=mkdtempSync(join(tmpdir(),'cpv-recusa-ficticia-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const contatos=iniciarContatos(dir);
  contatos.importarConsentimentosExternos({
    pessoas:[{nome:'Contato voluntario teste',telefone:'11988887777'}],
    origemAutorizacao:'Teste local ficticio',
    referenciaAutorizacao:'Simulação técnica de aceite',
    dataAutorizacao:'2026-10-10',declaracao:true,
  });
  const c=contatos.listar()[0],denuncias=iniciarDenuncias(dir,contatos);
  return {dir,contatos,denuncias,c};
}

test('Não tenho interesse usa token distinto e nunca registra denúncia por engano',async()=>{
  const store=storeFake(),id=randomUUID();
  const optout=id+'.'+assinatura(id,SECRET,'saida-solicitada');
  const legacy=id+'.'+assinatura(id,SECRET,'denuncia-convite');
  assert.equal(validarToken(optout,SECRET,'saida-solicitada'),id);
  assert.equal(validarToken(optout,SECRET,'denuncia-convite'),null);
  assert.equal(validarToken(legacy,SECRET,'saida-solicitada'),null);
  const malformed=await receberRecusa(req('/api/recusar',{
    method:'POST',body:{token:legacy},
  }),{store,secret:SECRET});
  assert.equal(malformed.status,404);
  const invalidOrigin=await receberRecusa(req('/api/recusar',{
    method:'POST',body:{token:optout},origin:'https://falso.invalid',
  }),{store,secret:SECRET});
  assert.equal(invalidOrigin.status,403);
  assert.equal(store.total(),0);
  const resposta=await receberRecusa(req('/api/recusar',{
    method:'POST',body:{token:optout},
  }),{store,secret:SECRET});
  assert.equal(resposta.status,202);
  assert.match((await resposta.json()).mensagem,/não receber novos convites/);
  assert.equal(store.total(),1);
  assert.equal((await receberRecusa(req('/api/recusar',{
    method:'POST',body:{token:optout},
  }),{store,secret:SECRET})).status,202);
  assert.equal(store.total(),1);
  const fila=await sincronizarDenuncias(req('/api/denuncias-pendentes',{
    secret:SECRET,
  }),{store,secret:SECRET});
  assert.equal(fila.status,200);
  const eventos=(await fila.json()).eventos;
  assert.equal(eventos.length,1);
  assert.equal(eventos[0].motivo,'saida-solicitada');
  // Não permite confirmar como denúncia outro tipo de solicitação.
  assert.equal((await sincronizarDenuncias(req('/api/denuncias-pendentes',{
    method:'POST',body:{token:optout,motivo:'denuncia-convite'},secret:SECRET,
  }),{store,secret:SECRET})).status,400);
  const ack=await sincronizarDenuncias(req('/api/denuncias-pendentes',{
    method:'POST',body:{token:optout,motivo:'saida-solicitada'},secret:SECRET,
  }),{store,secret:SECRET});
  assert.equal(ack.status,200);
  assert.equal(store.total(),0);
  // Links antigos continuam sendo denúncias, sem afetar a categoria nova.
  const antiga=await receberDenuncia(req('/api/denunciar',{
    method:'POST',body:{token:legacy},
  }),{store,secret:SECRET});
  assert.equal(antiga.status,202);
  const lista=(await (await sincronizarDenuncias(req('/api/denuncias-pendentes',{
    secret:SECRET,
  }),{store,secret:SECRET})).json()).eventos;
  assert.equal(lista[0].motivo,'denuncia-convite');
});

test('Netlify → ACER classifica preferência como pedido de saída, bloqueia e confirma',async t=>{
  const {contatos,denuncias,c}=storage(t);
  const store=storeFake();
  const token=denuncias.tokenNetlify(c,SECRET,'saida-solicitada');
  const old=denuncias.tokenNetlify(c,SECRET);
  assert.equal(validarToken(token,SECRET,'saida-solicitada'),c.id);
  assert.notEqual(token,old);
  assert.doesNotMatch(token,/11988887777|Contato voluntario/);
  assert.equal((await receberRecusa(req('/api/recusar',{
    method:'POST',body:{token},
  }),{store,secret:SECRET})).status,202);
  assert.equal(contatos.listar()[0].status,'ativo');
  const simularFetch=async(url,opts={})=>sincronizarDenuncias(
    new Request(url,opts),{store,secret:SECRET});
  const sync=iniciarSincronizacaoNetlify({
    config:{publicBaseUrl:DOMAIN,segredo:SECRET},
    denuncias,fetchImpl:simularFetch,
  });
  const result=await sync.sincronizar();
  assert.equal(result.ok,true);
  assert.equal(result.novas,1);
  assert.equal(store.total(),0);
  assert.equal(denuncias.resumo().saidas,1);
  assert.equal(denuncias.resumo().denuncias,0);
  assert.equal(denuncias.estaBloqueado(c.telefone),true);
  assert.equal(contatos.listar()[0].status,'descadastrado');
  assert.equal(denuncias.listar()[0].origem,'clique-nao-tenho-interesse-netlify');
  const novamente=contatos.importarConsentimentosExternos({
    pessoas:[{nome:'Teste de reimportação',telefone:'11988887777'}],
    origemAutorizacao:'Teste local ficticio',
    referenciaAutorizacao:'Simulação técnica de aceite anterior',
    dataAutorizacao:'2026-10-10',declaracao:true,
    verificarBloqueio:phone=>denuncias.estaBloqueado(phone),
  });
  assert.equal(novamente.bloqueados,1);
});

test('convite gratuito mostra Não tenho interesse sem denunciar; ação manual não inventa denúncia',t=>{
  const {dir,contatos,denuncias,c}=storage(t);
  const convites=iniciarConvitesUnicos({
    dataDir:dir,contatos,bloqueios:denuncias,configMeta:obterConfigMeta({}),
    grupoInicial:'https://chat.whatsapp.com/GrupoFicticioParaTeste99',
    publicBaseUrl:DOMAIN,netlifySecret:SECRET,
  });
  assert.match(MENSAGEM_PADRAO,/SAIR/);
  assert.doesNotMatch(MENSAGEM_PADRAO,/Denunciar/i);
  convites.salvarConfiguracao({
    mensagem:'Olá! Você autorizou receber ofertas do Caça Promos VIP. '+
      'A entrada é opcional. Para não receber convites, toque em Denunciar convite ou responda SAIR.',
    grupoUrl:'https://chat.whatsapp.com/GrupoFicticioParaTeste99',
    nomeModelo:'convite_ofertas_v1',
  });
  assert.doesNotMatch(convites.configuracao().mensagem,/denunciar/i);
  assert.match(convites.configuracao().mensagem,/Não tenho interesse/);
  const fila=convites.criarFila({nome:'Campanha ficticia',modo:'web',contatoIds:[c.id]});
  const conversa=convites.prepararManual({campanhaId:fila.id,contatoId:c.id});
  const text=conversa.mensagem;
  assert.match(text,/Não tenho interesse \(parar convites\)/);
  assert.doesNotMatch(text,/denunciar|denúncia|DENUNCIAR/i);
  assert.match(text,/responda SAIR/);
  const link=text.match(/https:\/\/site-teste\.netlify\.app\/nao-tenho-interesse\/\?token=([^\s]+)/)?.[1];
  assert.ok(link);
  assert.equal(validarToken(link,SECRET,'saida-solicitada'),c.id);
  assert.equal(convites.marcarManual({
    campanhaId:fila.id,contatoId:c.id,acao:'nao-interessado',
  }).status,'bloqueado');
  assert.equal(denuncias.resumo().saidas,1);
  assert.equal(denuncias.resumo().denuncias,0);
  assert.equal(convites.detalhesFila(fila.id).bloqueados,1);
});

test('novo site móvel não registra por GET ou prévia; somente após confirmar',async t=>{
  const publicDir=join(import.meta.dirname,'..','denuncias-netlify','public');
  const store=storeFake(),id=randomUUID();
  const token=id+'.'+assinatura(id,SECRET,'saida-solicitada');
  const web=createServer(async(req,res)=>{
    if(req.url.startsWith('/api/recusar')){
      let body='';
      for await(const chunk of req)body+=String(chunk);
      const response=await receberRecusa(new Request(
        'http://127.0.0.1:'+web.address().port+req.url,{
          method:req.method,headers:req.headers,body,
        }),{store,secret:SECRET});
      res.writeHead(response.status,{'content-type':'application/json'});
      res.end(await response.text());return;
    }
    const file=req.url.startsWith('/assets/recusar.js')
      ?join(publicDir,'assets','recusar.js')
      :join(publicDir,'nao-tenho-interesse','index.html');
    res.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':'text/html'});
    res.end(readFileSync(file));
  });
  await new Promise(resolve=>web.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>web.close(resolve)));
  const browser=await chromium.launch({headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  const base='http://127.0.0.1:'+web.address().port;
  await page.goto(base+'/nao-tenho-interesse/?token='+token);
  assert.equal(store.total(),0);
  assert.match(await page.locator('main').innerText(),/Não tenho interesse/);
  assert.doesNotMatch(await page.locator('main').innerText(),/Confirmar denúncia/);
  await page.locator('#confirmarRecusa').click();
  await page.locator('#resultado').waitFor({state:'visible'});
  assert.match(await page.locator('#resultado').innerText(),/preferência foi registrada/);
  assert.equal(store.total(),1);
  assert.equal(await page.locator('#confirmarRecusa').isHidden(),true);
  const sizes=await page.evaluate(()=>({
    w:document.documentElement.clientWidth,
    scroll:document.documentElement.scrollWidth,
  }));
  assert.ok(sizes.scroll<=sizes.w+2,JSON.stringify(sizes));
  assert.deepEqual(errors,[]);
});

test('configuração mantém novos links desligados até publicação pública confirmada',t=>{
  const dir=mkdtempSync(join(tmpdir(),'cpv-recusa-flags-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=join(dir,'denuncias-netlify-config.json');
  writeFileSync(file,JSON.stringify({publicBaseUrl:DOMAIN,segredo:SECRET}));
  assert.equal(lerConfigNetlify(dir,{}).recusaAtiva,false);
  writeFileSync(file,JSON.stringify({
    publicBaseUrl:DOMAIN,segredo:SECRET,recusaAtiva:true,
  }));
  assert.equal(lerConfigNetlify(dir,{}).recusaAtiva,true);
});
