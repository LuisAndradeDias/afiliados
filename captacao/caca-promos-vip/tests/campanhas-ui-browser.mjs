import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarServidor } from '../src/server.mjs';
const require=createRequire('C:\\projeto01\\package.json');
const {chromium}=require('playwright');

test('fluxo no Chrome: planilha, campanha, prévia, confirmação, relatório',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cpv-campanhas-ui-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const app=await iniciarServidor({port:0,dataDir:dir});
  t.after(()=>new Promise(resolve=>app.servidor.close(resolve)));
  app.contatos.configurarRemetente('11999998888');
  const reg=app.contatos.cadastrar({nome:'Ana de Exemplo',
    telefone:'11988887777',origem:'origem-teste',consentimento:true});
  const autorizado=app.contatos.listar().find(c=>c.telefone==='5511988887777');
  app.contatos.confirmar({id:autorizado.id,codigo:reg.codigo,evidencia:'mensagem-recebida'});
  app.contatos.cadastrar({nome:'Contato Sem Optin',telefone:'21999997777',
    origem:'origem-teste',consentimento:true});

  const browser=await chromium.launch({headless:true,
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',msg=>{if(msg.type()==='error' && !msg.text().includes('401 (Unauthorized)'))errors.push(msg.text());});
  await page.goto(app.base+'/campanhas',{waitUntil:'domcontentloaded'});
  await page.locator('#adminKey').fill(app.chave);
  await page.locator('#loginForm button[type=submit]').click();
  await page.locator('#appView').waitFor({state:'visible',timeout:10000});
  await page.locator('#importFile').setInputFiles({
    name:'planilha-contatos.csv',mimeType:'text/csv',
    buffer:Buffer.from('\ufeffnome;telefone\n"Ana de Exemplo";"+55 (11) 98888-7777"\n"Contato Sem Optin";"55 21 99999-7777"\n"Duplicado";"11988887777"','utf8'),
  });
  await page.waitForFunction(()=>document.querySelector('#metricImported').textContent==='2');
  assert.equal(await page.locator('#metricEligible').innerText(),'1');
  assert.equal(await page.locator('#metricBlocked').innerText(),'1');
  await page.locator('#campaignName').fill('Ofertas de teste');
  await page.locator('#campaignGroup').fill('Clube da semana');
  await page.locator('#campaignText').fill('Olá {nome}! Confira novidades do {grupo}.');
  assert.match(await page.locator('#messagePreview').innerText(),/Olá Ana!/);
  assert.equal(await page.locator('#createCampaign').isEnabled(),true);
  await page.locator('#createCampaign').click();
  await page.locator('#queueSection').waitFor({state:'visible',timeout:10000});
  assert.match(await page.locator('#queueTitle').innerText(),/Ofertas de teste/);
  await page.getByRole('button',{name:'Preparar mensagem'}).click();
  await page.locator('#sendDialog').waitFor({state:'visible'});
  assert.match(await page.locator('#messageReady').inputValue(),/Olá Ana!/);
  const link=await page.locator('#openWhatsApp').getAttribute('href');
  assert.ok(link.startsWith('https://wa.me/5511988887777?text='));
  assert.equal(await page.locator('#recordSent').isDisabled(),true);
  // Não abrimos o link do WhatsApp: nenhum disparo é efetuado neste teste.
  await page.locator('#sentConfirm').check();
  await page.locator('#recordSent').click();
  await page.locator('#sendDialog').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelector('#metricSent').textContent==='1');
  await page.screenshot({path:'C:\\projeto01\\captacao\\caca-promos-vip\\dados\\previa-acer\\campanhas-ui-qa.png',fullPage:true});
  const downloadWait=page.waitForEvent('download');
  await page.locator('#reportCsv').click();
  const download=await downloadWait;
  const csv=readFileSync(await download.path(),'utf8');
  assert.match(csv,/nome;telefone_mascarado;status/);
  assert.match(csv,/enviado/);
  await page.setViewportSize({width:390,height:844});
  const size=await page.evaluate(()=>({
    viewport:document.documentElement.clientWidth,
    page:document.documentElement.scrollWidth,
  }));
  assert.ok(size.page<=size.viewport+2,'Rolagem horizontal indevida: '+JSON.stringify(size));
  assert.deepEqual(errors,[],'Erros JavaScript no painel');
  console.log(JSON.stringify({ok:true,importados:2,autorizados:1,bloqueados:1,
    enviadoRegistrado:1,simulado:true,webWhatsAppAberto:false,
    relatorio:download.suggestedFilename(),responsividade:size}));
});
