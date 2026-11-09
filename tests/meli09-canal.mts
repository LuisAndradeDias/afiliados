import assert from "node:assert/strict";
import test from "node:test";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {
 avaliarCanalMeli,
 confirmarCanalMeli,
 revogarCanalMeli,
 podeEnviarPlataforma
} from "../src/painel/mercadolivre-canal.js";
const agora=Date.parse("2026-11-09T13:00:00Z");
test("Mercado Livre não pode enviar a grupo ainda não confirmado; Amazon não muda",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"meli09-canal-"));
 try {
  const path=join(dir,"data","canal-meli.json");
  assert.equal(avaliarCanalMeli(path,"Grupo Publico",agora).permitido,false);
  assert.equal(podeEnviarPlataforma("mercado-livre",path,"Grupo Publico",agora),false);
  assert.equal(podeEnviarPlataforma("Amazon Brasil",path,"Grupo Publico",agora),true);
  await assert.rejects(confirmarCanalMeli(path,"Grupo Publico",{
   grupoPublico:true,cadastradoNoPrograma:false,semDivulgacaoPrivada:true
  },agora),/cadastr|confirm/i);
  assert.equal(avaliarCanalMeli(path,"Grupo Publico",agora).permitido,false);
  await confirmarCanalMeli(path,"Grupo Publico",{
   grupoPublico:true,cadastradoNoPrograma:true,semDivulgacaoPrivada:true
  },agora);
  assert.equal(avaliarCanalMeli(path,"Grupo Publico",agora).permitido,true);
  assert.equal(podeEnviarPlataforma("Mercado Livre",path,"Grupo Publico",agora),true);
  assert.equal(avaliarCanalMeli(path,"Outro Grupo",agora).permitido,false);
  assert.equal(avaliarCanalMeli(path,"Grupo Publico",agora+31*86400000).permitido,false);
  assert.equal(avaliarCanalMeli(path,"Grupo Publico",agora-30000).permitido,false);
  const raw=await readFile(path,"utf8");
  assert.ok(!raw.includes("Grupo Publico"),"Arquivo não deve registrar nome de grupo");
  assert.ok(!/access_token|refresh_token/i.test(raw),"Sem OAuth");
  await revogarCanalMeli(path);
  assert.equal(avaliarCanalMeli(path,"Grupo Publico",agora).permitido,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
