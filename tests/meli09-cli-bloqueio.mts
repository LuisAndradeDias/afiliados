import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtemp,mkdir,readFile,rm,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {tmpdir} from "node:os";
const repo=process.cwd();
const dir=await mkdtemp(join(tmpdir(),"meli09-cli-block-"));
await mkdir(join(dir,"data"),{recursive:true});
const packageFile=join(dir,"data","ultima-oferta-whatsapp.json");
const messageFile=join(dir,"data","ultima-mensagem-whatsapp.txt");
await writeFile(packageFile,JSON.stringify({plataforma:"Mercado Livre",
 produtoId:"MLB999",titulo:"Produto teste fictício",precoAtual:100,
 precoAnterior:150,descontoPercentual:33.33}));
await writeFile(messageFile,"TESTE: NÃO ENVIAR");
const loader=resolve(repo,"node_modules","tsx","dist","cli.mjs");
const env={...process.env,
 WHATSAPP_GROUP_NAME:"Grupo Fictício Não Verificado",
 WHATSAPP_PREPARE_TEST:"false",
 WHATSAPP_AUTO_SEND_ENABLED:"true",
 MERCADOLIVRE_ACCESS_TOKEN:"",
 MERCADOLIVRE_REFRESH_TOKEN:""};
try{
 for(const [script,expected] of [
  ["src/robo/mercadolivre-whatsapp.ts","MELI_CANAL_NAO_CONFIRMADO"],
  ["src/robo/whatsapp-preparar.ts","CANAL_NAO_PERMITIDO"]
 ] as const){
  const child=spawnSync(process.execPath,[loader,resolve(repo,script)],{
   cwd:dir,env,encoding:"utf8",timeout:10000,windowsHide:true});
  const logs=(child.stdout||"")+" "+(child.stderr||"");
  assert.notEqual(child.status,0,"Envio proibido não pode ser concluído: "+script);
  assert.match(logs,new RegExp(expected),script+" deve recusar antes de abrir WhatsApp");
 }
 assert.equal(await readFile(packageFile,"utf8"),JSON.stringify({
  plataforma:"Mercado Livre",produtoId:"MLB999",titulo:"Produto teste fictício",
  precoAtual:100,precoAnterior:150,descontoPercentual:33.33
 }));
 assert.equal(await readFile(messageFile,"utf8"),"TESTE: NÃO ENVIAR");
 console.log("MELI09_CLI_BLOQUEIO_OK: nenhum navegador, imagem, pacote ou envio.");
}finally{await rm(dir,{recursive:true,force:true});}
