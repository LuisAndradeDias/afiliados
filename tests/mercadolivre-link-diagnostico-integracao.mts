import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const project=dirname(dirname(fileURLToPath(import.meta.url)));
const serverFile=join(project,"src","painel","server.ts");
const loader=join(project,"node_modules","tsx","dist","loader.mjs");

async function portaLivre(): Promise<number> {
  const server=createServer();
  await new Promise<void>((res,rej)=>{
    server.once("error",rej);
    server.listen(0,"127.0.0.1",()=>res());
  });
  const address=server.address();
  assert.ok(address && typeof address!=="string");
  await new Promise<void>(res=>server.close(()=>res()));
  return address.port;
}
async function request(url:string,data:Record<string,unknown>,origin?:string){
  const response=await fetch(url,{method:"POST",headers:{
    "content-type":"application/json",
    ...(origin?{"origin":origin}:{})
  },body:JSON.stringify(data),signal:AbortSignal.timeout(5000)});
  return {code:response.status,json:await response.json() as Record<string,any>};
}

test("link tecnico de uma URL manual nunca vira promocao ou WhatsApp", {
  timeout:35000
},async()=>{
  const tmp=await mkdtemp(join(tmpdir(),"link-tecnico-meli-"));
  const port=await portaLivre();
  const base="http://127.0.0.1:"+port;
  let child:ChildProcess|undefined;
  let captured="";
  try{
    await mkdir(join(tmp,"data"));
    await writeFile(join(tmp,".env"),
      "ALTERNATING_MONITOR_ENABLED=false\nMERCADOLIVRE_MONITOR_ENABLED=false\nWHATSAPP_AUTO_SEND_ENABLED=false\n",
      "utf8");
    const env={
      ...process.env,
      DOTENV_CONFIG_PATH:join(tmp,".env"),
      PAINEL_PORT:String(port),
      ALTERNATING_MONITOR_ENABLED:"false",
      MERCADOLIVRE_MONITOR_ENABLED:"false",
      WHATSAPP_AUTO_SEND_ENABLED:"false",
      WHATSAPP_GROUP_NAME:"",
      MERCADOLIVRE_ACCESS_TOKEN:"",
      MERCADOLIVRE_REFRESH_TOKEN:"",
      DATA_DIR:join(tmp,"data"),
      NODE_ENV:"test",
    };
    child=spawn(process.execPath,[
      "--import",pathToFileURL(loader).href,serverFile
    ],{cwd:tmp,env,windowsHide:true,stdio:["ignore","pipe","pipe"]});
    child.stderr?.on("data",(data:Buffer)=>{captured+=data.toString().slice(0,2000);});
    const readyUntil=Date.now()+12000;
    let online=false;
    while(Date.now()<readyUntil){
      await new Promise(res=>setTimeout(res,180));
      try{
        const response=await fetch(base+"/api/status",{signal:AbortSignal.timeout(1600)});
        if(response.ok){online=true;break;}
      }catch{}
    }
    assert.equal(online,true,"Test panel not ready. "+captured.slice(0,500));

    const invalid=await request(base+"/api/action",{
      action:"mercadolivre-link-diagnostico",
      urlProduto:"https://produto.mercadolivre.com.br/MLB-123456-test-_JM"
    });
    assert.equal(invalid.code,409);
    const csrf=await request(base+"/api/action",{
      action:"mercadolivre-link-diagnostico",
      confirmacao:"TESTE_LINK_SEM_ENVIO",
      urlProduto:"https://produto.mercadolivre.com.br/MLB-123456-test-_JM"
    },"https://site-terceiro.example");
    assert.equal(csrf.code,403);

    const ping=await request(base+"/api/mercadolivre/extension-ping",{});
    assert.equal(ping.code,200);
    const created=await request(base+"/api/action",{
      action:"mercadolivre-link-diagnostico",
      confirmacao:"TESTE_LINK_SEM_ENVIO",
      urlProduto:"https://produto.mercadolivre.com.br/MLB-123456-test-_JM?tracking=sensitive"
    });
    assert.equal(created.code,200,JSON.stringify(created.json));

    const state=await (await fetch(base+"/api/status")).json() as Record<string,any>;
    assert.equal(state.mercadoLivreLinkJob,null,"Test must not look like real offer link");
    assert.equal(state.mercadoLivreTesteLinkJob?.diagnostico,true);
    assert.equal(state.mercadoLivreTesteLinkJob?.status,"pending");
    assert.equal(state.mercadoLivreTesteLinkJob?.urlProduto.includes("?"),false);
    const id=state.mercadoLivreTesteLinkJob?.id;
    assert.ok(id);

    const job=await (await fetch(base+"/api/mercadolivre/link-job")).json() as Record<string,any>;
    assert.equal(job.job?.id,id);
    assert.equal(job.job?.diagnostico,true);
    const started=await request(base+"/api/mercadolivre/link-job/start",{id});
    assert.equal(started.code,200);
    const done=await request(base+"/api/mercadolivre/link-result",{
      id,link:"https://meli.la/TESTE_SEM_ENVIO"
    });
    assert.equal(done.code,200,JSON.stringify(done.json));
    const status=await (await fetch(base+"/api/status")).json() as Record<string,any>;
    assert.equal(status.mercadoLivreLinkJob,null);
    assert.equal(status.mercadoLivreTesteLinkJob?.status,"done");
    assert.match(status.mercadoLivreTesteLinkJob?.mensagem||"",/nao homologados/);
    const cleared=await request(base+"/api/action",{
      action:"mercadolivre-link-diagnostico-limpar",
      confirmacao:"TESTE_LINK_SEM_ENVIO"
    });
    assert.equal(cleared.code,200);
    const after=await (await fetch(base+"/api/status")).json() as Record<string,any>;
    assert.equal(after.mercadoLivreTesteLinkJob,null);
    assert.equal(after.mercadoLivreLinkJob,null);
    assert.equal(after.whatsappAutoEnvioAtivo,false);
    assert.equal(after.whatsappEnvioPendente,false);
    assert.equal(after.mercadoLivreMonitorAtivo,false);
    assert.equal(after.monitorAlternadoAtivo,false);

    const fileNames=await (await import("node:fs/promises")).readdir(join(tmp,"data"));
    assert.equal(fileNames.some(name=>/ultima-oferta|whatsapp|mensagem/i.test(name)),false,
      "No offers/messages/session artifacts may be written by technical test");
  }finally{
    if(child && !child.killed){child.kill();}
    if(child){
      await Promise.race([
        new Promise<void>(res=>child!.once("exit",()=>res())),
        new Promise<void>(res=>setTimeout(res,1500))
      ]);
    }
    await rm(tmp,{recursive:true,force:true,maxRetries:5,retryDelay:150});
  }
});
