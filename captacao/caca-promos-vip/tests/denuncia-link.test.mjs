import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {iniciarServidor} from '../src/server.mjs';
import {iniciarDenuncias} from '../src/denuncias.mjs';

const require=createRequire(new URL('../../../package.json',import.meta.url));
const {chromium}=require('playwright');
const FALSO1='21988887777';
const FALSO2='31999997777';
const GRUPO='https://chat.whatsapp.com/GrupoFicticioTeste123';
const PUBLICA='https://convites.example.test';

async function fixture(t,basePublica=PUBLICA){
  const dir=mkdtempSync(join(tmpdir(),'cpv-denuncia-link-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const app=await iniciarServidor({dataDir:dir,port:0,metaAmbiente:{},
    publicBaseUrl:basePublica});
  t.after(()=>new Promise(resolve=>app.servidor.close(resolve)));
  const contatos=app.contatos;
  const pessoas=[{nome:'Contato ficticio 1',telefone:FALSO1},
    {nome:'Contato ficticio 2',telefone:FALSO2}];
  contatos.importarConsentimentosExternos({
    pessoas,origemAutorizacao:'Conversa ficticia autorizada',
    referenciaAutorizacao:'Registro de teste verificavel para o fluxo',
    dataAutorizacao:'2026-10-10',declaracao:true,
  });
  const base=app.base;
  const post=(route,payload,headers={})=>fetch(base+route,{
    method:'POST',
    headers:{'content-type':'application/json','origin':base,
      'x-cpv-local':'1',...headers},
    body:JSON.stringify(payload),
  });
  const dados=await (await fetch(base+'/api/local/campanhas/destinatarios')).json();
  const ids=dados.destinatarios.map(c=>c.id);
  assert.equal(ids.length,2);
  const modelo=await post('/api/local/campanhas/convite/modelo',{
    mensagem:'Olá, você autorizou receber convites do Caça Promos VIP. '+
      'Deseja conhecer nosso grupo de promoções? Para recusar, responda SAIR.',
    grupoUrl:GRUPO,nomeModelo:'convite_ofertas_v1',
  });
  assert.equal(modelo.status,200);
  const created=await post('/api/local/campanhas/convite/fila',{
    nome:'Fila de convite ficticia',modo:'web',contatoIds:ids,
  });
  assert.equal(created.status,200);
  const fila=(await created.json()).fila;
  const preparada=await post('/api/local/campanhas/convite/manual/preparar',{
    campanhaId:fila.id,contatoId:ids[0],
  });
  assert.equal(preparada.status,200);
  const msg=(await preparada.json()).conversa.mensagem;
  return {app,base,post,fila,ids,msg,contatos,dir};
}

test('link HTTPS individual nao registra denuncia por GET, bloqueia so depois do POST',async t=>{
  const f=await fixture(t);
  assert.match(f.msg,/responda SAIR/);
  assert.doesNotMatch(f.msg,/Denunciar mensagem|\/denunciar\?token/);
  // Endpoints antigos continuam funcionando para links já distribuídos,
  // mas novas mensagens não geram denúncia por engano.
  const c=f.contatos.listar().find(x=>x.id===f.ids[0]);
  const token=iniciarDenuncias(f.dir,f.contatos).tokenDenuncia(c);
  const visit=await fetch(f.base+'/denunciar?token='+token,
    {headers:{'user-agent':'WhatsApp/2.0 preview'}});
  assert.equal(visit.status,200);
  const html=await visit.text();
  assert.match(html,/denúncia interna|denúncia <strong>interna/);
  assert.match(html,/não.*enviada.*WhatsApp/si);
  assert.doesNotMatch(html,/21988887777|31999997777|token=[a-f0-9]{64}/);
  assert.equal((await (await fetch(f.base+'/api/local/campanhas/denuncias')).json()).ocorrencias.length,0);
  const invalid=await f.post('/api/denunciar',{token:'a'.repeat(64)});
  assert.equal(invalid.status,404);
  const csrf=await f.post('/api/denunciar',{token},{
    origin:'https://outro-site.invalid',
  });
  assert.equal(csrf.status,403);
  const res=await f.post('/api/denunciar',{token});
  assert.equal(res.status,200);
  assert.deepEqual(await res.json(),{ok:true,registrada:true,bloqueado:true});
  const eventos=(await (await fetch(f.base+'/api/local/campanhas/denuncias')).json()).ocorrencias;
  assert.equal(eventos.length,1);
  assert.equal(eventos[0].origem,'clique-confirmado-pagina-publica');
  assert.equal(eventos[0].motivo,'denuncia-convite');
  assert.equal(eventos[0].telefoneMascarado.includes('7777'),true);
  const elegiveis=(await (await fetch(f.base+'/api/local/campanhas/destinatarios')).json()).destinatarios;
  assert.equal(elegiveis.length,1);
  assert.equal(elegiveis[0].telefone,'5521988887777');
  const estados=(await (await fetch(f.base+'/api/local/campanhas/convite/fila?id='+f.fila.id)).json()).fila;
  assert.equal(estados.bloqueados,1);
  assert.equal(estados.manuais,0);
  assert.equal((await f.post('/api/denunciar',{token})).status,200);
  assert.equal((await (await fetch(f.base+'/api/local/campanhas/denuncias')).json()).ocorrencias.length,1);
  const resposta=await f.post('/api/local/campanhas/importar-autorizados',{
    pessoas:[{telefone:FALSO2,nome:'Retentativa ficticia'}],
    origemAutorizacao:'Conversa ficticia autorizada',
    referenciaAutorizacao:'Registro ficticio do consentimento anterior',
    dataAutorizacao:'2026-10-10',declaracao:true,
  });
  assert.equal(resposta.status,200);
  assert.equal((await resposta.json()).resultado.bloqueados,1);
  const dados=f.contatos.listar().find(c=>c.nome==='Contato ficticio 2');
  assert.equal(dados.status,'descadastrado');
  assert.equal(dados.descadastroEm!==null,true);
});

test('sem HTTPS público convite mantém resposta SAIR/DENUNCIAR sem link inseguro',async t=>{
  const f=await fixture(t,'');
  assert.match(f.msg,/responda SAIR/);
  assert.doesNotMatch(f.msg,/DENUNCIAR|Denunciar mensagem/);
  assert.doesNotMatch(f.msg,/denunciar\?token/);
  const estat=(await (await fetch(f.base+
    '/api/local/campanhas/convite/manual/estatisticas')).json()).controle;
  assert.equal(estat.denunciaPorCliqueConfigurada,false);
});

test('não aceita http, localhost ou URL com segredo, mesmo com porta de teste',async t=>{
  const temporarias=[];
  t.after(()=>temporarias.forEach(dir=>rmSync(dir,{recursive:true,force:true})));
  for(const bad of ['http://denuncias.exemplo.com','https://127.0.0.1:3045',
    'https://usuario:senha@exemplo.com','https://exemplo.com/path',
    'https://exemplo.com/?senha=exposta']){
    const dir=mkdtempSync(join(tmpdir(),'cpv-invalid-url-'));
    temporarias.push(dir);
    await assert.rejects(iniciarServidor({port:0,
      dataDir:dir,publicBaseUrl:bad}),
      /HTTPS pública|endereço público HTTPS válido/);
  }
});

test('no navegador o clique explícito registra uma única reclamação interna',async t=>{
  const f=await fixture(t);
  const contato=f.contatos.listar().find(c=>c.id===f.ids[0]);
  const token=iniciarDenuncias(f.dir,f.contatos).tokenDenuncia(contato);
  const browser=await chromium.launch({headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(f.base+'/denunciar?token='+token,{waitUntil:'domcontentloaded'});
  assert.equal((await (await fetch(f.base+'/api/local/campanhas/denuncias')).json()).ocorrencias.length,0);
  assert.match(await page.locator('main').innerText(),/não é enviada ao WhatsApp/i);
  await page.locator('#complaintButton').click();
  await page.locator('#complaintMessage').waitFor({state:'visible',timeout:6000});
  assert.match(await page.locator('#complaintMessage').innerText(),/registrada no Caça Promos VIP/);
  assert.equal(await page.locator('#complaintButton').isHidden(),true);
  const admin=await browser.newPage();
  await admin.goto(f.base+'/campanhas',{waitUntil:'domcontentloaded'});
  await admin.waitForFunction(()=>document.querySelector('#complaintsCount')?.textContent==='(1)');
  await admin.locator('#complaintsDetail > summary').click();
  assert.match(await admin.locator('#complaintsList').innerText(),/Confirmado pelo link/);
  const sizes=await page.evaluate(()=>({
    viewport:document.documentElement.clientWidth,
    scroll:document.documentElement.scrollWidth,
  }));
  assert.ok(sizes.scroll<=sizes.viewport+2,JSON.stringify(sizes));
  assert.deepEqual(errors,[]);
});
