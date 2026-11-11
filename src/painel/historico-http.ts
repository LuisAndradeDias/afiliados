/**
 * MELI-11: endpoint somente-leitura. Nenhum POST, token ou ação comercial.
 * A conexão HTTP da Central já está limitada a 127.0.0.1.
 */
import type { ServerResponse } from "node:http";
import type { PipelineMeli11 } from "../historico/meli11.js";

export function responderRotaHistorico(
  metodo:string|undefined,rota:string,res:ServerResponse,pipeline:PipelineMeli11
):boolean{
  if(rota!=="/api/historico-precos")return false;
  if(metodo!=="GET"){
    res.writeHead(405,{"content-type":"application/json; charset=utf-8",
      "allow":"GET","cache-control":"no-store","x-content-type-options":"nosniff"});
    res.end(JSON.stringify({ok:false,erro:"somente_leitura"}));
    return true;
  }
  const snapshot=pipeline.situacao();
  res.writeHead(200,{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"private, no-store, max-age=0",
    "x-content-type-options":"nosniff",
    "referrer-policy":"no-referrer"
  });
  res.end(JSON.stringify({ok:true,modo:"real",...snapshot}));
  return true;
}
