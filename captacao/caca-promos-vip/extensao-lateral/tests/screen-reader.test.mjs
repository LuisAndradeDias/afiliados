import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base=join(dirname(fileURLToPath(import.meta.url)),'..');

function preparar() {
  const eventos=[];
  const ctx = {
    imageSmoothingEnabled:false,imageSmoothingQuality:'',
    drawImage(...args){eventos.push(args);}
  };
  const canvas={width:0,height:0,getContext(){return ctx;}};
  const doc={createElement(tag){assert.equal(tag,'canvas');return canvas;}};
  const opts=[];
  const progress=[];
  let terminated=0, recognised=0;
  const worker = {
    async setParameters(settings){opts.push(settings);},
    async recognize(imagem){recognised++;assert.equal(imagem,canvas);
      return {data:{text:'  Pessoa Teste A\r\n+55 11 98888-7777  ',confidence:93}};},
    async terminate(){terminated++;}
  };
  const context={
    document:doc,
    chrome:{runtime:{getURL(path){return 'chrome-extension://teste/'+path;}}},
    Tesseract:{async createWorker(lang,oem,options){
      assert.equal(lang,'por');assert.equal(oem,1);
      assert.equal(options.workerBlobURL,false);
      assert.match(options.workerPath,/^chrome-extension:\/\/teste\/ocr\/worker\.min\.js$/);
      assert.match(options.corePath,/\/ocr\/core$/);
      assert.match(options.langPath,/\/ocr\/lang$/);
      options.logger({status:'recognizing text',progress:.75});
      return worker;
    }}
  };
  context.globalThis=context;
  runInNewContext(readFileSync(join(base,'screen-reader.js'),'utf8'),context);
  return {
    reader:context.CPVScreenReader,events:()=>eventos,opts,
    progress,counts:()=>({recognised,terminated}),
    doc,
  };
}

test('normaliza a seleção e não lê pixels fora da área', () => {
  const {reader,events,doc}=preparar();
  const r=reader.normalizarSelecao(260,120,-10,10,300,150);
  assert.equal(r.left,0);assert.equal(r.top,10);
  assert.equal(r.width,260);assert.equal(r.height,110);
  const imagem={naturalWidth:1200,naturalHeight:600};
  const c=reader.recortar(imagem,{left:20,top:10,width:100,height:80},300,150,doc);
  assert.equal(c.width,800);assert.equal(c.height,640);
  const draw=events()[0];
  assert.equal(draw[1],80);assert.equal(draw[2],40);
  assert.equal(draw[3],400);assert.equal(draw[4],320);
});

test('rejeita seleção vazia e imagens sem dimensões', () => {
  const {reader,doc}=preparar();
  const img={naturalWidth:1200,naturalHeight:600};
  assert.throws(()=>reader.recortar(img,{left:0,top:0,width:5,height:9},300,150,doc),/Selecione/);
  assert.throws(()=>reader.recortar({naturalWidth:0,naturalHeight:0},
    {left:0,top:0,width:100,height:80},300,150,doc),/não terminou/);
});

test('OCR usa apenas arquivos locais e libera worker', async () => {
  const {reader,opts,counts}=preparar();
  const img={naturalWidth:1200,naturalHeight:600};
  const progresso=[];
  const result=await reader.reconhecer(img,{left:0,top:0,width:250,height:130},
    300,150,(etapa,pc)=>progresso.push([etapa,pc]));
  assert.match(result.texto,/Pessoa Teste/);
  assert.equal(result.confianca,93);
  assert.equal(opts[0].tessedit_pageseg_mode,'6');
  assert.equal(counts().recognised,1);
  assert.equal(progresso[0][1],75);
  await reader.liberar();
  assert.equal(counts().terminated,1);
});
