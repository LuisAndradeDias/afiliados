/** MELI-15C: API LOCAL SOMENTE LEITURA do Caçador VIP.
 * Usa a persistência já existente do fluxo assistido (MELI-09).
 * Não consulta marketplace, OAuth nem WhatsApp.
 */
import type {IncomingMessage,ServerResponse} from "node:http";
import {resolve} from "node:path";
import {criarRepositorioMeli} from "./mercadolivre-assistido.js";
import {analisarRascunhosMeli} from "../cacador/meli-revisao.js";

const rota="/api/mercadolivre/cacador";
const repos=new Map<string,ReturnType<typeof criarRepositorioMeli>>();
function responder(res:ServerResponse,status:number,data:unknown,extra:Record<string,string>={}){
  res.writeHead(status,{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"private, no-store, max-age=0",
    "x-content-type-options":"nosniff",
    "x-frame-options":"DENY",
    "referrer-policy":"no-referrer",
    ...extra
  });
  res.end(JSON.stringify(data));
}
export async function responderRotaCacadorMeli(
  req:IncomingMessage,res:ServerResponse,pathname:string,raiz:string
):Promise<boolean>{
  if(pathname!==rota)return false;
  if(!/^(?:127\.0\.0\.1|localhost):[0-9]{1,5}$/.test(req.headers.host??"")||
     req.headers["sec-fetch-site"]==="cross-site"){
    responder(res,403,{ok:false,mensagem:"Disponível somente na Central local."});
    return true;
  }
  if(req.method!=="GET"){
    responder(res,405,{ok:false,mensagem:"Somente leitura."},{allow:"GET"});
    return true;
  }
  const file=resolve(raiz,"data","mercadolivre-rascunhos-assistidos.json");
  let repo=repos.get(file);
  if(!repo){repo=criarRepositorioMeli(file);repos.set(file,repo);}
  try{
    const linhas=await repo.listar();
    responder(res,200,{ok:true,...analisarRascunhosMeli(linhas)});
  }catch{
    // Banco local corrompido ou ilegível: nunca retornar lista inventada.
    responder(res,503,{ok:false,mensagem:
      "Não foi possível analisar rascunhos locais. Nenhuma oferta foi aprovada."});
  }
  return true;
}
