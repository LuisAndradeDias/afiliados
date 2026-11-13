/** HTTP somente local para curadoria de produtos; sem automação de envio. */
import type {IncomingMessage,ServerResponse} from "node:http";
import {resolve} from "node:path";
import {CatalogoCacador,ErroCatalogo,type CanalCacador,
  type SituacaoCacador} from "../cacador/catalogo.js";
import {criarRepositorioMeli,ErroRascunhoMeli} from "./mercadolivre-assistido.js";
import {criarRepositorioShopee,ErroRascunhoShopee} from "./shopee-rascunhos.js";

type Args={req:IncomingMessage;res:ServerResponse;pathname:string;raiz:string};
const MAX_CORPO=16*1024;
function responder(res:ServerResponse,status:number,body:unknown):void{
  res.writeHead(status,{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    "x-frame-options":"DENY",
    "referrer-policy":"no-referrer",
  });
  res.end(JSON.stringify(body));
}
function hostLocal(req:IncomingMessage):boolean{
  return /^(?:localhost|127\.0\.0\.1):\d{1,5}$/.test(req.headers.host??"");
}
function origemLocal(req:IncomingMessage):boolean{
  if(!hostLocal(req)||req.headers["sec-fetch-site"]==="cross-site")return false;
  try{
    const u=new URL(req.headers.origin??"");
    return u.protocol==="http:"&&u.host===req.headers.host&&
      !u.username&&!u.password;
  }catch{return false;}
}
async function corpoJson(req:IncomingMessage):Promise<unknown>{
  if(!/^application\/json\s*(?:;|$)/i.test(req.headers["content-type"]??""))
    throw new ErroCatalogo("Envie dados JSON.",415);
  const partes:Buffer[]=[];let tamanho=0;
  for await(const chunk of req){
    const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
    tamanho+=b.length;
    if(tamanho>MAX_CORPO)throw new ErroCatalogo("Registro excede 16 KB.",413);
    partes.push(b);
  }
  try{return JSON.parse(Buffer.concat(partes).toString("utf8")) as unknown;}
  catch{throw new ErroCatalogo("JSON inválido.");}
}
function escolha<T extends string>(v:string|null,permitidos:readonly T[]):T|"todos"{
  return v&&permitidos.includes(v as T)?v as T:"todos";
}
function valores(obj:unknown):Record<string,unknown>{
  if(!obj||typeof obj!=="object"||Array.isArray(obj))
    throw new ErroCatalogo("Confirmações inválidas.");
  return obj as Record<string,unknown>;
}
async function encaminharRascunho(
  raiz:string,repo:CatalogoCacador,chave:string,body:unknown
):Promise<{destino:string;mensagem:string;rascunhoId:string}>{
  const produto=repo.obter(chave);
  if(!produto)throw new ErroCatalogo("Produto não encontrado.",404);
  if(produto.disponibilidade!=="declarada"||!produto.urlAfiliado)
    throw new ErroCatalogo("Reconfira disponibilidade e registre o link oficial antes de encaminhar.");
  const idade=Date.now()-Date.parse(produto.observadoEmUtc);
  if(!Number.isFinite(idade)||idade<0||idade>=120*60_000)
    throw new ErroCatalogo("Observação com mais de 120 minutos. Registre preço atualizado.");
  const c=valores(valores(body).confirmacoes);
  if(produto.canal==="Mercado Livre"){
    if(!produto.precoAnteriorCentavos||produto.precoAnteriorCentavos<=produto.precoCentavos)
      throw new ErroCatalogo("Informe o preço anterior do anúncio para revisão MELI.");
    const dados={
      titulo:produto.titulo,urlProduto:produto.urlProduto,
      urlAfiliado:produto.urlAfiliado,
      precoAtual:produto.precoCentavos/100,
      precoAnterior:produto.precoAnteriorCentavos/100,
      confirmacoes:{
        preco:c.preco===true,disponibilidade:c.disponibilidade===true,
        reputacaoVerde:c.reputacaoVerde===true,linkAfiliado:c.linkAfiliado===true
      }
    };
    const draft=await criarRepositorioMeli(
      resolve(raiz,"data","mercadolivre-rascunhos-assistidos.json")
    ).salvar(dados);
    return {
      destino:"/revisao",rascunhoId:draft.id,
      mensagem:"Rascunho Mercado Livre criado para revisão. Nenhum envio realizado."
    };
  }
  if(produto.canal==="Shopee"){
    if(c.preco!==true||c.disponibilidade!==true||c.linkAfiliado!==true)
      throw new ErroCatalogo("Confirme preço, disponibilidade e link Shopee.");
    const draft=await criarRepositorioShopee(
      resolve(raiz,"data","shopee-rascunhos.json")
    ).salvar({
      titulo:produto.titulo,url:produto.urlAfiliado,
      preco:produto.precoCentavos/100,confirmado:true
    });
    return {
      destino:"/shopee",rascunhoId:draft.id,
      mensagem:"Rascunho Shopee criado para revisão. Nenhum envio realizado."
    };
  }
  throw new ErroCatalogo(
    "Amazon: revisão permanece no catálogo. Não há conector autorizado de publicação.",409
  );
}

export async function responderRotaCacador({req,res,pathname,raiz}:Args):Promise<boolean>{
  if(!pathname.startsWith("/api/cacador/"))return false;
  if(!hostLocal(req)){
    responder(res,403,{ok:false,mensagem:"Catálogo restrito à Central local."});
    return true;
  }
  const dbPath=resolve(raiz,"data","cacador-catalogo.sqlite");
  const repo=new CatalogoCacador(dbPath);
  try{
    if(req.method==="GET"&&pathname==="/api/cacador/catalogo"){
      const u=new URL(req.url??"/","http://localhost");
      const canais:CanalCacador[]=["Mercado Livre","Amazon","Shopee"];
      const status:SituacaoCacador[]=["revisar","acompanhar","bloqueado"];
      const limite=parseInt(u.searchParams.get("limite")??"100",10);
      const resultado=repo.listar({
        busca:u.searchParams.get("busca")??"",
        canal:escolha(u.searchParams.get("canal"),canais),
        situacao:escolha(u.searchParams.get("situacao"),status),
        limite:Number.isFinite(limite)?limite:100
      });
      responder(res,200,{ok:true,...resultado});
      return true;
    }
    const detalhe=/^\/api\/cacador\/produto\/([a-f0-9]{64})$/.exec(pathname);
    if(req.method==="GET"&&detalhe){
      const produto=repo.obter(detalhe[1]);
      responder(res,produto?200:404,produto
        ?{ok:true,produto}:{ok:false,mensagem:"Produto não encontrado."});
      return true;
    }
    const escrita=(req.method==="POST"&&pathname==="/api/cacador/observacoes")||
      (req.method==="POST"&&/^\/api\/cacador\/encaminhar\/[a-f0-9]{64}$/.test(pathname));
    if(escrita){
      if(!origemLocal(req)){
        responder(res,403,{ok:false,mensagem:"Alteração permitida somente na Central local."});
        return true;
      }
      const entrada=await corpoJson(req);
      if(pathname==="/api/cacador/observacoes"){
        const produto=repo.registrar(entrada);
        responder(res,201,{
          ok:true,produto,
          mensagem:"Observação manual registrada. Nenhum envio ou busca foi acionado."
        });
      }else{
        const chave=pathname.split("/").at(-1)!;
        const resultado=await encaminharRascunho(raiz,repo,chave,entrada);
        responder(res,201,{ok:true,...resultado});
      }
      return true;
    }
    responder(res,405,{ok:false,mensagem:"Método ou rota não permitido."});
  }catch(error){
    const esperado=error instanceof ErroCatalogo||
      error instanceof ErroRascunhoMeli||
      error instanceof ErroRascunhoShopee;
    responder(res,esperado?error.statusCode:500,{
      ok:false,
      mensagem:esperado?error.message:"O catálogo local não está disponível."
    });
  } finally {
    repo.fechar(); // Libera SQLite inclusive no Windows; não prende arquivos para backup.
  }
  return true;
}
