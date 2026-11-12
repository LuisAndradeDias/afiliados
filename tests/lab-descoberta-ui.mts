import assert from "node:assert/strict";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {chromium} from "playwright";
import {readFile} from "node:fs/promises";
const html=join(process.cwd(),"test-results","lab-descoberta","radar-laboratorio.html");
const dados=join(process.cwd(),"test-results","lab-descoberta","resultado.json");
const report=JSON.parse(await readFile(dados,"utf8"));
assert.equal(report.resumo.origensAutomaticasReais,0);
const browser=await chromium.launch({headless:true,channel:"chrome"});
try{
 for(const width of [1440,768,390]){
  const ctx=await browser.newContext({viewport:{width,height:900},
   locale:"pt-BR",deviceScaleFactor:1,reducedMotion:"reduce"});
  const page=await ctx.newPage();
  const errors:string[]=[],external:string[]=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("console",message=>{
   if(message.type()==="error")errors.push(message.text());
  });
  page.on("request",request=>{
   if(/^https?:/i.test(request.url()))external.push(request.url());
  });
  const response=await page.goto(pathToFileURL(html).href,{waitUntil:"load"});
  assert.equal(response?.status(),200);
  assert.match(await page.title(),/Laboratório de Descoberta/);
  assert.match(await page.locator(".notice").innerText(),/fictícios/i);
  assert.equal(await page.locator("#cycle-controls button").count(),4);
  assert.equal(await page.locator("#k-review").innerText(),"03");
  assert.equal(await page.locator("#k-blocked").innerText(),"06");
  assert.equal(await page.locator("#k-invalid").innerText(),"03");
  assert.equal(await page.locator("#k-received").innerText(),"14");
  assert.equal(await page.locator("#rows tr").count(),12);
  assert.match(await page.locator("#baseline").innerText(),/R\$\s*239,90/u);
  assert.match(await page.locator("#total").innerText(),/R\$\s*179,90/u);
  assert.equal(await page.locator("#drop").innerText(),"25,0%");
  assert.ok(await page.locator("#chart circle").count()>=4);
  const full=await page.screenshot({path:join(process.cwd(),
    "test-results","lab-descoberta","radar-"+width+".png"),
    fullPage:true,animations:"disabled"});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<=2,"Rolar horizontalmente na pagina width="+width+" over="+overflow);
  if(width===1440){
    const h=await page.evaluate(()=>document.documentElement.scrollHeight);
    assert.ok(h>900);
    const inspector=await ctx.newPage();
    try{
      const pixel=await inspector.evaluate(async ({base64,y})=>{
        const img=new Image();img.src="data:image/png;base64,"+base64;await img.decode();
        const canvas=document.createElement("canvas");canvas.width=canvas.height=1;
        const context=canvas.getContext("2d");if(!context)throw Error("canvas unavailable");
        context.drawImage(img,-20,-y);
        return [...context.getImageData(0,0,1,1).data].slice(0,3);
      },{base64:full.toString("base64"),y:h-18});
      assert.deepEqual(pixel,[23,35,51],"Barra lateral deve chegar ao rodape");
    }finally{await inspector.close();}
  }
  await page.locator("#cycle-controls button").first().click();
  assert.equal(await page.locator("#k-review").innerText(),"00");
  assert.equal(await page.locator("#k-received").innerText(),"10");
  await page.locator("#cycle-controls button").last().click();
  assert.equal(await page.locator("#k-review").innerText(),"03");
  await page.locator("[data-filter='revisar']").click();
  assert.equal(await page.locator("#rows tr").count(),3);
  await page.locator("[data-filter='bloqueado']").click();
  assert.equal(await page.locator("#rows tr").count(),6);
  await page.locator("[data-filter='acompanhar']").click();
  assert.equal(await page.locator("#rows tr").count(),3);
  await page.locator("[data-filter='todos']").click();
  assert.equal(await page.locator("#rows tr").count(),12);
  await page.getByRole("button",{name:/Analisar Smartphone de entrada/}).click();
  assert.match(await page.locator("#detail-name").innerText(),/Smartphone/);
  assert.match(await page.locator("#coupon").innerText(),/1\.269,00/);
  assert.match(await page.locator("#reasons").innerText(),/checkout/);
  const after=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(after<=2,"Overflow apos interacao");
  assert.deepEqual(errors,[],"JS/console errors "+width);
  assert.deepEqual(external,[],"No external requests "+width);
  console.log("LAB_CHROME_OK="+width+" read_only=TRUE screenshot=TRUE");
  await ctx.close();
 }
 console.log("LAB_UI_PASS=3 widths, cycle replay, filters, histories, coupons, sidebar pixel");
}finally{await browser.close();}
