import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdtemp, readFile, readdir, rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {responderRotaMeliAssistido} from "../src/painel/mercadolivre-assistido-http.js";

const root=await mkdtemp(join(tmpdir(),"cpv-meli08-http-"));
const requested:string[]=[];
const server=createServer(async(req,res)=>{
  const path=new URL(req.url||"/","http://127.0.0.1").pathname;
  requested.push((req.method||"?")+" "+path);
  try {
    if(await responderRotaMeliAssistido({req,res,pathname:path,raiz:root}))return;
    res.writeHead(404);res.end();
  }catch(e){res.writeHead(500);res.end(String(e));}
});
await new Promise<void>(ok=>server.listen(0,"127.0.0.1",ok));
const address=server.address();assert.ok(address && typeof address!=="string");
const base="http://127.0.0.1:"+address.port;
const sample={
  titulo:"Fone de ouvido original",urlProduto:"https://www.mercadolivre.com.br/p/MLB38053317",
  urlAfiliado:"https://meli.la/linkteste",precoAtual:"100,00",precoAnterior:"150,00",
  confirmacoes:{preco:true,disponibilidade:true,reputacaoVerde:true,linkAfiliado:true}
};
const same={"content-type":"application/json",origin:base,"sec-fetch-site":"same-origin"};
async function request(path:string,method:"POST"|"DELETE"|"GET",body?:unknown,headers?:Record<string,string>){
  const res=await fetch(base+path,{
    method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:"manual"
  });
  let data:any=null;try{data=await res.json()}catch{}
  return {status:res.status,data};
}
try{
  const list=await request("/api/mercadolivre/rascunhos-assistidos","GET");
  assert.equal(list.status,200);assert.deepEqual(list.data.rascunhos,[]);
  const cross=await request("/api/mercadolivre/rascunhos-assistidos","POST",sample,
    {"content-type":"application/json",origin:"https://example.com","sec-fetch-site":"cross-site"});
  assert.equal(cross.status,403);
  const noOrigin=await request("/api/mercadolivre/rascunhos-assistidos","POST",sample,
    {"content-type":"application/json"});
  assert.equal(noOrigin.status,403);
  const created=await request("/api/mercadolivre/rascunhos-assistidos","POST",sample,same);
  assert.equal(created.status,201);
  assert.equal(created.data.rascunho.status,"rascunho-nao-publicado");
  assert.equal((await request("/api/mercadolivre/rascunhos-assistidos","GET")).data.rascunhos.length,1);
  const duplicate=await request("/api/mercadolivre/rascunhos-assistidos","POST",sample,same);
  assert.equal(duplicate.status,400);
  const weak=await request("/api/mercadolivre/rascunhos-assistidos","POST",
    {...sample,confirmacoes:{...sample.confirmacoes,reputacaoVerde:false}},same);
  assert.equal(weak.status,400);
  const badType=await request("/api/mercadolivre/rascunhos-assistidos","POST",sample,
    {"content-type":"text/plain",origin:base});
  assert.equal(badType.status,415);
  const fail=await request("/api/mercadolivre/rascunhos-assistidos/"+created.data.rascunho.id,
    "DELETE",undefined,{"origin":"https://evil.test","sec-fetch-site":"cross-site"});
  assert.equal(fail.status,403);
  const deleted=await request("/api/mercadolivre/rascunhos-assistidos/"+created.data.rascunho.id,
    "DELETE",undefined,{origin:base,"sec-fetch-site":"same-origin"});
  assert.equal(deleted.status,200);
  assert.deepEqual((await request("/api/mercadolivre/rascunhos-assistidos","GET")).data.rascunhos,[]);
  assert.deepEqual((await readdir(join(root,"data"))),["mercadolivre-rascunhos-assistidos.json"]);
  assert.ok(!requested.some(x=>/preparar|send|whatsapp/i.test(x)));
  console.log("MELI08_HTTP_OK: origem local, rascunho separado, confirmação e exclusão sem envio.");
}finally{
  server.closeAllConnections();await new Promise<void>(ok=>server.close(()=>ok()));
  await rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
