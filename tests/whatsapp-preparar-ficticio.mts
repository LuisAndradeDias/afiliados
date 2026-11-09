import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const repo=process.cwd();
const dir=await mkdtemp(join(tmpdir(),"whatsapp-preparacao-ficticia-"));
try {
 const data=join(dir,"data");
 await mkdir(data);
 const message="MENSAGEM DE TESTE INTERNO — NADA DEVE SER ENVIADO";
 const offer={plataforma:"Amazon Brasil",produtoId:"B000000000",titulo:"Produto fictício",precoAtual:25,precoAnterior:50,descontoPercentual:50};
 await writeFile(join(data,"ultima-mensagem-whatsapp.txt"),message,"utf8");
 await writeFile(join(data,"ultima-oferta-whatsapp.json"),JSON.stringify(offer),"utf8");
 const cmd=spawnSync(process.execPath,[
  resolve(repo,"node_modules","tsx","dist","cli.mjs"),
  resolve(repo,"src","robo","whatsapp-preparar.ts")
 ],{
  cwd:dir,
  env:{...process.env,WHATSAPP_PREPARE_TEST:"true",
   WHATSAPP_GROUP_NAME:"Grupo fictício 🟢",
   WHATSAPP_AUTO_SEND_ENABLED:"true"},
  encoding:"utf8",timeout:45_000,windowsHide:true
 });
 const full=(cmd.stdout||"")+"\n"+(cmd.stderr||"");
 assert.equal(cmd.status,0,"Simulação deve preparar sem erro: "+full.slice(-1600));
 assert.match(full,/Teste concluído: busca, abertura do grupo e preenchimento funcionaram/i);
 assert.ok(!/ENVIO_CONFIRMADO_AUTO|AUTO_ENVIO_INICIADO/.test(full));
 assert.equal(await readFile(join(data,"ultima-mensagem-whatsapp.txt"),"utf8"),message);
 assert.equal(await readFile(join(data,"ultima-oferta-whatsapp.json"),"utf8"),JSON.stringify(offer));
 assert.ok(!cmd.error,"Processo não deve expirar");
 console.log("WHATSAPP_PREPARAR_TESTE_FICTICIO_OK: pesquisa atual, compositor, nenhuma mensagem enviada.");
}finally{await rm(dir,{recursive:true,force:true});}
