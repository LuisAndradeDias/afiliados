import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const segredo="SEGREDO_INTERNO_NUNCA_MOSTRAR";
const script=resolve("scripts/auditar-funil-ofertas.cjs");

async function executar(base: string): Promise<{
  code: number | null; output: string; error: string;
}> {
  return new Promise((done,fail)=>{
    const child=spawn(process.execPath,[script,base],{
      stdio:["ignore","pipe","pipe"],
      windowsHide:true
    });
    let output="",error="";
    child.stdout.on("data",part=>{output+=String(part);});
    child.stderr.on("data",part=>{error+=String(part);});
    child.once("error",fail);
    child.once("close",code=>done({code,output,error}));
  });
}

test("auditoria usa apenas GET local, explica bloqueios e nao vaza dados sensiveis",async()=>{
  const requests:string[]=[];
  const server=createServer((req,res)=>{
    requests.push((req.method||"")+" "+req.url);
    res.writeHead(200,{"content-type":"application/json"});
    if(req.url==="/api/status"){
      res.end(JSON.stringify({
        operacaoEstado:"offer-pending",
        monitorAlternadoAtivo:true,
        mercadoLivreMonitorAtivo:true,
        whatsappAutoEnvioAtivo:false,
        canalElegibilidade:{codigo:"CANAL_NAO_HOMOLOGADO"},
        mercadoLivreMonitorBackoffMinutos:8,
        mercadoLivreCuponsTotal:7,
        mercadoLivreCuponsAtivos:0,
        executando:[],
        logs:[segredo],credencial:segredo
      }));
    } else if(req.url==="/api/revisao"){
      res.end(JSON.stringify({
        modo:"somente-leitura",
        resumo:{candidatos:1,bloqueados:1,necessitamRevisao:0,aprovados:0},
        fichas:[{
          titulo:segredo,
          urlProduto:"https://exemplo.interno/"+segredo,
          decisao:{motivos:[
            {codigo:"CANAL_NAO_HOMOLOGADO",descricao:segredo},
            {codigo:"PRECO_SEM_PROVA_RECENTE",descricao:segredo}
          ]}
        }]
      }));
    } else {res.writeHead(404);res.end();}
  });
  await new Promise<void>(ok=>server.listen(0,"127.0.0.1",ok));
  try{
    const address=server.address();
    assert.ok(address&&typeof address!=="string");
    const result=await executar("http://127.0.0.1:"+address.port);
    assert.equal(result.code,0,result.error);
    assert.deepEqual(requests.sort(),[
      "GET /api/revisao","GET /api/status"
    ]);
    assert.doesNotMatch(result.output+result.error,/SEGREDO_INTERNO_NUNCA_MOSTRAR/);
    const audit=JSON.parse(result.output) as Record<string,any>;
    assert.equal(audit.modo,"somente-leitura");
    assert.equal(audit.estado,"offer-pending");
    assert.equal(audit.envioAutomatico,false);
    assert.equal(audit.canal,"CANAL_NAO_HOMOLOGADO");
    assert.equal(audit.revisao.candidatos,1);
    assert.equal(audit.revisao.bloqueados,1);
    assert.equal(audit.cupons.observados,7);
    assert.equal(audit.cupons.ativos,0);
    assert.equal(audit.mercadoLivre.backoffMinutos,8);
    assert.deepEqual(audit.codigosBloqueio,[
      {codigo:"CANAL_NAO_HOMOLOGADO",quantidade:1},
      {codigo:"PRECO_SEM_PROVA_RECENTE",quantidade:1}
    ]);
  }finally{
    await new Promise<void>((ok,fail)=>server.close(e=>e?fail(e):ok()));
  }
});

test("auditoria recusa endereco externo sem fazer requisicoes",async()=>{
  const result=await executar("https://example.com");
  assert.notEqual(result.code,0);
  assert.doesNotMatch(result.output+result.error,/SEGREDO_INTERNO_NUNCA_MOSTRAR/);
});
