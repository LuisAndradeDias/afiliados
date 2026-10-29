import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const entry=join(root,"src","robo","whatsapp-preparar.ts");

test("WhatsApp nunca abre se mensagem antiga contem cupom sem prova de checkout",()=>{
  const cwd=mkdtempSync(join(tmpdir(),"coupon-wa-safety-"));
  try{
    mkdirSync(join(cwd,"data"));
    const message=[
      "*OFERTA MERCADO LIVRE*",
      "*Parafusadeira The Black Tools*",
      "Por R$ 142,74",
      "🎟️ Cupom: *INVENTADO1*",
      "Comprar: https://www.mercadolivre.com.br/p/MLB38053317"
    ].join("\n");
    writeFileSync(join(cwd,"data","ultima-mensagem-whatsapp.txt"),message,"utf8");
    writeFileSync(join(cwd,"data","ultima-oferta-whatsapp.json"),JSON.stringify({
      plataforma:"Mercado Livre",produtoId:"MLB38053317",
      anuncioId:"MLB3771505959",titulo:"Parafusadeira The Black Tools",
      precoAtual:142.74, cupomCodigo:"INVENTADO1",
      cupomValidacao:"produto-confirmado",
      cupomConfirmadoEm:new Date(Date.now()-15*60_000).toISOString(),
      cupomProdutoIdConfirmado:"MLB38053317",
      cupomAnuncioIdConfirmado:"MLB3771505959",
      cupomFonteConfirmacao:"checkout",
      precoComCupomEstimado:130
    }),"utf8");
    const loader=pathToFileURL(join(root,"node_modules","tsx","dist","loader.mjs")).href;
    const child=spawnSync(process.execPath,["--import",loader,entry],{
      cwd,encoding:"utf8",timeout:16000,
      env:{
        ...process.env,NODE_ENV:"test",WHATSAPP_GROUP_NAME:"GRUPO TESTE NAO REAL",
        WHATSAPP_PREPARE_TEST:"false",WHATSAPP_AUTO_SEND_ENABLED:"false",
        ALTERNATING_MONITOR_ENABLED:"false",MERCADOLIVRE_MONITOR_ENABLED:"false"
      }
    });
    assert.notEqual(child.status,0,"invalid coupon must stop process");
    assert.match(child.stderr+child.stdout,/CUPOM_SEM_COMPROVACAO/);
    assert.equal(readFileSync(join(cwd,"data","ultima-mensagem-whatsapp.txt"),"utf8"),message);
    assert.ok(!child.signal,"Process must exit on guard before using Chrome");
  }finally{
    rmSync(cwd,{recursive:true,force:true});
  }
});

test("o codigo protege o momento imediatamente anterior ao clique",()=>{
  const text=readFileSync(entry,"utf8");
  const guard=text.indexOf("CUPOM_CONFIRMADO_EXPIRADO_ENVIO_BLOQUEADO");
  const send=text.indexOf("await enviarOfertaNoWhatsapp(");
  assert.ok(guard>0 && send>guard,"Coupon guard must run before clicking Send");
  assert.match(text,/await rm\(enviarSignalPath, \{ force: true \}\)/);
});
