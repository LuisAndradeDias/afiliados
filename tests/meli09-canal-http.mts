import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {responderRotaMeliAssistido} from "../src/painel/mercadolivre-assistido-http.js";
const dir=await mkdtemp(join(tmpdir(),"meli09-canal-http-"));
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url||"/","http://127.0.0.1").pathname;
  if(await responderRotaMeliAssistido({req,res,pathname:path,raiz:dir,grupoAtual:"Grupo Público Registrado"}))return;
  res.writeHead(404);res.end();
 }catch(e){res.writeHead(500);res.end(String(e));}
});
await new Promise<void>(ok=>server.listen(0,"127.0.0.1",ok));
const a=server.address();assert.ok(a && typeof a!=="string");
const base="http://127.0.0.1:"+a.port;
async function call(method:"GET"|"POST",payload?:unknown,origin=base){
 const response=await fetch(base+"/api/mercadolivre/canal",{
  method,headers:method==="POST"?{"content-type":"application/json",
   origin,"sec-fetch-site":origin===base?"same-origin":"cross-site"}:{},
  body:payload===undefined?undefined:JSON.stringify(payload)
 });
 return {status:response.status,data:await response.json().catch(()=>null)};
}
try{
 const initial=await call("GET");
 assert.equal(initial.status,200);
 assert.equal(initial.data.permitido,false);
 const rejected=await call("POST",{acao:"confirmar",grupoPublico:true,cadastradoNoPrograma:true,semDivulgacaoPrivada:true},
  "https://site-externo.example");
 assert.equal(rejected.status,403);
 const incomplete=await call("POST",{acao:"confirmar",grupoPublico:true,cadastradoNoPrograma:false,semDivulgacaoPrivada:true});
 assert.equal(incomplete.status,400);
 const saved=await call("POST",{acao:"confirmar",grupoPublico:true,cadastradoNoPrograma:true,semDivulgacaoPrivada:true});
 assert.equal(saved.status,200);assert.equal(saved.data.permitido,true);
 const checked=await call("GET");
 assert.equal(checked.data.permitido,true);
 const file=await readFile(join(dir,"data","mercadolivre-canal-publico.json"),"utf8");
 assert.ok(!file.includes("Grupo Público Registrado"));
 const revoked=await call("POST",{acao:"revogar"});
 assert.equal(revoked.status,200);
 assert.equal((await call("GET")).data.permitido,false);
 console.log("MELI09_CANAL_HTTP_OK: apenas origem local, confirmação explícita e revogação.");
}finally{
 server.closeAllConnections();await new Promise<void>(ok=>server.close(()=>ok()));
 await rm(dir,{recursive:true,force:true});
}
