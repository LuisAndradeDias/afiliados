import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const base = join(dirname(fileURLToPath(import.meta.url)), '..');

function criarPainel() {
  const ids = [
    'capture','readPopup','consent','statusText','statusDot','screenshot',
    'selection','read','preview','previewPanel','imageFile','recognized',
    'copyText','analyze','resultItems','resultNote','count','clear',
    'export','group','close',
  ];
  function elemento(id) {
    return {
      id, value:'', textContent:'', checked:false, disabled:false,
      hidden:false, className:'', children:[], listeners:{}, style:{},
      files:[], focus(){}, scrollIntoView(){}, select(){},
      addEventListener(tipo, fn) { this.listeners[tipo] = fn; },
      replaceChildren(){this.children=[];},
      append(el){this.children.push(el);},
      removeAttribute(){},
      remove(){},
    };
  }
  const nodes=Object.fromEntries(ids.map(id=>[id,elemento(id)]));
  nodes.consent.checked=false;
  const exportPanel={open:false};
  const page={url:'https://web.whatsapp.com'};
  let payload='Pesquisar membros\n~ Pessoa Exemplo A\n+55 11 98888-7777';
  let injectionCount=0;
  let createdBlob=null, fileName='';
  const context={
    TextEncoder,Blob,setTimeout(){},
    window:{addEventListener() {},close(){}},
    document:{
      getElementById(id){return nodes[id];},
      querySelector(selector) {
        assert.equal(selector,'details.export-area');
        return exportPanel;
      },
      createElement(tag){
        const el=elemento(tag);
        if(tag==='a') el.click=()=>{fileName=el.download;};
        return el;
      },
      body:{append(){}},
    },
    navigator:{clipboard:{writeText:async()=>{}}},
    chrome:{
      tabs:{query:async()=>[{id:123,windowId:1,url:page.url}]},
      scripting:{executeScript:async(options)=>{
        injectionCount++;
        if(options.files) {
          assert.deepEqual([...options.files],['popup-visivel.js']);
          return [{result:null}];
        }
        return [{result:{ok:true,texto:payload,quantidadeLinhas:3}}];
      }},
    },
    URL:class LocalUrl extends URL {
      static createObjectURL(blob) {createdBlob=blob;return 'blob:local';}
      static revokeObjectURL(){}
    },
    CPVScreenReader:{
      normalizarSelecao(){return {};},
      reconhecer:async()=>({texto:'',confianca:0}),
      liberar:async()=>{},
    }
  };
  context.globalThis=context;
  for(const file of ['extractor-core.js','sidepanel.js']) {
    runInNewContext(readFileSync(join(base,file),'utf8'),context);
  }
  return {
    nodes,exportPanel,page,
    click:async id=>{await nodes[id].listeners.click?.();},
    change:id=>nodes[id].listeners.change?.(),
    setPayload:texto=>{payload=texto;},
    get injections(){return injectionCount;},
    get fileName(){return fileName;},
    csv:async()=>createdBlob?.text(),
  };
}

test('não acessa a página sem confirmação do operador',async()=>{
  const ui=criarPainel();
  await ui.click('readPopup');
  assert.equal(ui.injections,0);
  assert.match(ui.nodes.statusText.textContent,/Confirme/);
  assert.equal(ui.nodes.recognized.value,'');
});

test('rejeita outra aba mesmo depois do consentimento',async()=>{
  const ui=criarPainel();
  ui.nodes.consent.checked=true;
  ui.page.url='https://example.com';
  await ui.click('readPopup');
  assert.equal(ui.injections,0);
  assert.match(ui.nodes.statusText.textContent,/WhatsApp Web/);
});

test('somente clique lê popup e dois trechos viram CSV sem duplicação',async()=>{
  const ui=criarPainel();
  ui.nodes.consent.checked=true;
  ui.nodes.group.value='Grupo teste';
  await ui.click('readPopup');
  assert.equal(ui.injections,2);
  assert.match(ui.nodes.recognized.value,/Pessoa Exemplo A/);
  ui.setPayload('Pesquisar membros\n~ Pessoa Exemplo A\n+55 11 98888-7777\n~ Pessoa Exemplo B\n+55 21 99999-7777');
  await ui.click('readPopup');
  assert.equal(ui.injections,4);
  await ui.click('analyze');
  assert.equal(ui.nodes.count.textContent,'2');
  assert.equal(ui.exportPanel.open,true);
  assert.equal(ui.nodes.export.disabled,false);
  await ui.click('export');
  const csv=await ui.csv();
  assert.equal(ui.fileName,'cpv-contatos-grupo-teste.csv');
  assert.match(csv,/nome;telefone/);
  assert.match(csv,/5511988887777/);
  assert.match(csv,/5521999997777/);
  assert.equal(csv.split(/\r?\n/).filter(Boolean).length,3);
});

test('cancelar consentimento descarta texto e contatos',async()=>{
  const ui=criarPainel();
  ui.nodes.consent.checked=true;
  await ui.click('readPopup');
  await ui.click('analyze');
  assert.equal(ui.nodes.count.textContent,'1');
  ui.nodes.consent.checked=false;
  ui.change('consent');
  assert.equal(ui.nodes.recognized.value,'');
  assert.equal(ui.nodes.export.disabled,true);
  assert.equal(ui.nodes.count.textContent,'0');
});
