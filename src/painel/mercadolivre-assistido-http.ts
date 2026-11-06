/** Rascunhos assistidos MELI: somente disco local, sem conexão com WhatsApp. */
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import { criarRepositorioMeli, ErroRascunhoMeli } from "./mercadolivre-assistido.js";

type Args={req:IncomingMessage;res:ServerResponse;pathname:string;raiz:string};
const repos=new Map<string,ReturnType<typeof criarRepositorioMeli>>();
const base="/api/mercadolivre/rascunhos-assistidos";
function responder(res:ServerResponse,http:number,body:unknown){
  res.writeHead(http,{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store","x-content-type-options":"nosniff",
    "x-frame-options":"DENY","referrer-policy":"no-referrer"
  });
  res.end(JSON.stringify(body));
}
function origemValida(req:IncomingMessage):boolean{
  const host=req.headers.host||"";
  const origin=req.headers.origin||"";
  if(!/^(?:127\.0\.0\.1|localhost):[0-9]{1,5}$/.test(host))return false;
  if(req.headers["sec-fetch-site"]==="cross-site")return false;
  try{
    const u=new URL(origin);
    return u.protocol==="http:" && u.host===host && !u.username && !u.password;
  }catch{return false;}
}
function hostLocal(req:IncomingMessage):boolean{
  return /^(?:127\.0\.0\.1|localhost):[0-9]{1,5}$/.test(req.headers.host||"");
}
async function corpoJson(req:IncomingMessage):Promise<unknown>{
  if(!/^application\/json\s*(?:;|$)/i.test(req.headers["content-type"]||"")){
    throw new ErroRascunhoMeli("Envie JSON.",415);
  }
  const parts:Buffer[]=[];let size=0;
  for await(const piece of req){
    const buf=Buffer.isBuffer(piece)?piece:Buffer.from(piece);
    size+=buf.length;
    if(size>12*1024)throw new ErroRascunhoMeli("Rascunho excede o tamanho permitido.",413);
    parts.push(buf);
  }
  try{return JSON.parse(Buffer.concat(parts).toString("utf8"));}
  catch {throw new ErroRascunhoMeli("JSON inválido.");}
}
export async function responderRotaMeliAssistido({
  req,res,pathname,raiz
}:Args):Promise<boolean>{
  if(pathname!==base && !pathname.startsWith(base+"/"))return false;
  if(!hostLocal(req)){
    responder(res,403,{ok:false,mensagem:"Acesse apenas pela Central local."});
    return true;
  }
  const file=resolve(raiz,"data","mercadolivre-rascunhos-assistidos.json");
  let repo=repos.get(file);
  if(!repo){repo=criarRepositorioMeli(file);repos.set(file,repo);}
  if(req.method==="GET"&&pathname===base){
    try{responder(res,200,{ok:true,rascunhos:await repo.listar()});}
    catch{responder(res,500,{ok:false,mensagem:"Rascunhos locais indisponíveis."});}
    return true;
  }
  const idMatch=new RegExp("^"+base+"/([a-f0-9-]{36})$").exec(pathname);
  if((req.method==="POST"&&pathname===base) ||
     (req.method==="DELETE"&&idMatch!==null)){
    if(!origemValida(req)){
      responder(res,403,{ok:false,mensagem:"Alteração permitida apenas na Central local."});
      return true;
    }
    try{
      if(req.method==="POST"){
        const item=await repo.salvar(await corpoJson(req));
        responder(res,201,{ok:true,rascunho:item,mensagem:
          "Rascunho salvo localmente para revisão. Nada foi enviado ao WhatsApp."});
      }else{
        const removed=await repo.excluir(idMatch![1]);
        responder(res,removed?200:404,{ok:removed,mensagem:
          removed?"Rascunho excluído.":"Rascunho não encontrado."});
      }
    }catch(error){
      const known=error instanceof ErroRascunhoMeli;
      responder(res,known?error.statusCode:500,{
        ok:false,mensagem:known?error.message:"Erro ao salvar no disco local."
      });
    }
    return true;
  }
  responder(res,405,{ok:false,mensagem:"Método não permitido."});
  return true;
}
