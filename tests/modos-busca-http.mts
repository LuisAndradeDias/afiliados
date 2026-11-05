/**
 * Integração HTTP isolada: apenas status e configuração de profundidade de busca.
 * Processo real do painel roda com cwd temporário, sem tokens, sem sessão, sem monitor.
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root=process.cwd();
const tmp=await mkdtemp(join(tmpdir(),"cpv-modos-http-"));
const source=resolve(root,"src/painel/server.ts");
const loader=pathToFileURL(resolve(root,"node_modules/tsx/dist/loader.mjs")).href;
let child: ChildProcess | null=null;
async function portaLivre():Promise<number>{
  const net=createServer();
  await new Promise<void>(ok=>net.listen(0,"127.0.0.1",ok));
  const address=net.address();
  assert.ok(address && typeof address!=="string");
  await new Promise<void>(ok=>net.close(()=>ok()));
  return address.port;
}
const port=await portaLivre();
const base="http://127.0.0.1:"+port;
const cfg=join(tmp,"data","config-busca.json");
// Shim do executador da busca: prova o ambiente filho sem importar robôs reais.
const shim=join(tmp,"node_modules","tsx","dist","cli.mjs");
await mkdir(join(tmp,"node_modules","tsx","dist"),{recursive:true});
await writeFile(shim,`
import {writeFileSync} from "node:fs";
const qual=String(process.argv[2]||"").includes("mercadolivre")?"meli":"amazon";
writeFileSync("data/filho-"+qual+".json",JSON.stringify({
  modo:process.env.BUSCA_MODO,
  amazon:process.env.AMAZON_QUERIES_PER_RUN,
  meli:process.env.MERCADOLIVRE_QUERIES_PER_RUN,
  paginas:process.env.MERCADOLIVRE_SEARCH_PAGES_PER_QUERY,
  produtos:process.env.MERCADOLIVRE_PRODUCTS_CHECKED_PER_QUERY
}));
process.exit(2);
`,"utf8");
const env: NodeJS.ProcessEnv={
  PATH:process.env.PATH,
  Path:process.env.Path,
  SystemRoot:process.env.SystemRoot,
  WINDIR:process.env.WINDIR,
  LOCALAPPDATA:tmp,
  TMP:tmp,TEMP:tmp,
  NODE_ENV:"test",
  PAINEL_PORT:String(port),
  ALTERNATING_MONITOR_ENABLED:"false",
  MERCADOLIVRE_MONITOR_ENABLED:"false",
  WHATSAPP_AUTO_SEND_ENABLED:"false",
  WHATSAPP_AUTO_SEND_DELAY_MS:"1500",
  MERCADOLIVRE_ACCESS_TOKEN:"",
  MERCADOLIVRE_REFRESH_TOKEN:"",
  AMAZON_ASSOCIATE_TAG:"",
  AMAZON_QUERIES_PER_RUN:"4",
  AMAZON_LIMIT:"20",
  MERCADOLIVRE_QUERIES_PER_RUN:"2",
  MERCADOLIVRE_LIMIT:"20",
  MERCADOLIVRE_SEARCH_PAGES_PER_QUERY:"2",
  MERCADOLIVRE_PRODUCTS_CHECKED_PER_QUERY:"25"
};
async function iniciar():Promise<void>{
  child=spawn(process.execPath,["--import",loader,source],{
    cwd:tmp,env,stdio:["ignore","pipe","pipe"],windowsHide:true
  });
  let saida="";
  child.stdout?.on("data",chunk=>{saida+=String(chunk);});
  child.stderr?.on("data",chunk=>{saida+=String(chunk);});
  for(let i=0;i<75;i++){
    if(child.exitCode!==null) throw new Error("Servidor teste saiu: "+saida.slice(-600));
    try{
      const result=await fetch(base+"/api/status",{signal:AbortSignal.timeout(950)});
      if(result.ok)return;
    }catch{}
    await new Promise(ok=>setTimeout(ok,200));
  }
  throw new Error("Servidor teste não abriu a porta. "+saida.slice(-600));
}
async function parar(){
  if(!child)return;
  const proc=child;child=null;
  proc.kill();
  await Promise.race([
    new Promise<void>(ok=>proc.once("exit",()=>ok())),
    new Promise<void>(ok=>setTimeout(ok,3000))
  ]);
}
async function estado(){
  const response=await fetch(base+"/api/status",{cache:"no-store"});
  assert.equal(response.status,200);
  return await response.json() as Record<string,unknown>;
}
async function conferirFilho(plataforma:"amazon"|"meli", modo:"media"|"longa"){
  const action=plataforma==="amazon"?"buscar":"mercadolivre-buscar";
  const response=await fetch(base+"/api/action",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({action})
  });
  assert.equal(response.status,200,action+" não iniciou");
  const caminho=join(tmp,"data","filho-"+plataforma+".json");
  let captura:Record<string,string>|undefined;
  for(let i=0;i<40;i++){
    try{captura=JSON.parse(await readFile(caminho,"utf8"));break;}catch{}
    await new Promise(ok=>setTimeout(ok,100));
  }
  assert.ok(captura,"Filho fictício não recebeu ambiente");
  assert.equal(captura.modo,modo);
  assert.equal(captura.amazon,modo==="longa"?"6":"4");
  assert.equal(captura.meli,modo==="longa"?"3":"2");
  assert.equal(captura.paginas,modo==="longa"?"4":"2");
  assert.equal(captura.produtos,modo==="longa"?"40":"25");
  await rm(caminho,{force:true});
  // Aguarda a conclusão do filho antes de outra operação.
  for(let i=0;i<30;i++){
    if(((await estado()).executando as string[]).length===0)return;
    await new Promise(ok=>setTimeout(ok,100));
  }
  throw new Error("Filho fictício ainda em execução");
}
async function acao(modo:unknown){
  const response=await fetch(base+"/api/action",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({action:"busca-modo-set",modo})
  });
  return {status:response.status,data:await response.json() as {ok:boolean;mensagem:string}};
}

try{
  await iniciar();
  const initial=await estado();
  assert.equal(initial.modoBusca,"media");
  assert.equal(initial.monitorAlternadoAtivo,false);
  assert.equal(initial.descontoMinimo,20);
  assert.equal(initial.cooldownHoras,24);
  assert.equal(initial.previewCooldownMinutos,120);
  const bad=await acao("curta");
  assert.equal(bad.status,409);
  assert.equal(bad.data.ok,false);
  assert.equal((await estado()).modoBusca,"media");
  const update=await acao("longa");
  assert.equal(update.status,200);
  assert.equal(update.data.ok,true);
  const after=await estado();
  assert.equal(after.modoBusca,"longa");
  const perfil=after.orcamentoBusca as Record<string,number>;
  assert.equal(perfil.amazonCategorias,6);
  assert.equal(perfil.meliCategoriasIniciais,3);
  assert.equal(perfil.meliPaginasPorCategoria,4);
  assert.equal(perfil.meliProdutosPorCategoria,40);
  assert.equal(after.monitorAlternadoAtivo,false,"Mudar modo não liga monitor");
  assert.equal(after.whatsappEnvioPendente,false,"Mudar modo não envia WhatsApp");
  assert.deepEqual(JSON.parse(await readFile(cfg,"utf8")),{modo:"longa"});
  await conferirFilho("amazon","longa");
  await conferirFilho("meli","longa");
  await parar();
  await iniciar();
  assert.equal((await estado()).modoBusca,"longa",
    "Modo longo deve persistir após reinicialização sem tocar no .env");
  assert.equal((await acao("media")).status,200);
  assert.equal((await estado()).modoBusca,"media");
  await conferirFilho("amazon","media");
  console.log("MODOS_BUSCA_HTTP_OK: seleção, validação, reinício e zero envios no servidor real isolado.");
}finally{
  await parar();
  await rm(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:150});
}
