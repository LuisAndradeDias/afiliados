/**
 * MELI-14: estado de leitura do preço geral por canal. Fail-closed:
 * não existe coletor autorizado instalado no servidor operacional.
 * Não consulta DB, OAuth nem APIs externas. Nenhum endpoint de escrita.
 */
import type { ServerResponse } from "node:http";

export function responderRotaMarketplace(
  metodo:string|undefined,rota:string,res:ServerResponse
):boolean {
  if(rota!=="/api/historico-precos/marketplace")return false;
  const headers={
    "content-type":"application/json; charset=utf-8",
    "cache-control":"private, no-store, max-age=0",
    "x-content-type-options":"nosniff",
    "referrer-policy":"no-referrer"
  };
  if(metodo!=="GET"){
    res.writeHead(405,{...headers,allow:"GET"});
    res.end(JSON.stringify({ok:false,erro:"somente_leitura"}));
    return true;
  }
  res.writeHead(200,headers);
  res.end(JSON.stringify({
    ok:true,
    modo:"real",
    categoria:"preco_geral_marketplace",
    situacao:"aguardando_autorizacao",
    autorizacaoConfirmada:false,
    coletaHabilitada:false,
    mensagem:"Mercado Livre ainda não autorizou a consulta de preços de anúncios de terceiros.",
    itens:[]
  }));
  return true;
}
