/**
 * Segurança de canal de afiliados MELI: um grupo WhatsApp público e cadastrado
 * precisa de declaração explícita antes de qualquer encaminhamento operacional.
 * Não é verificação independente do Mercado Livre; nunca muda Amazon/Shopee.
 */
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;
const GRUPO_LIMITE = 250;

export interface DeclaracaoCanalMeli {
  grupoPublico: boolean;
  cadastradoNoPrograma: boolean;
  semDivulgacaoPrivada: boolean;
}
export interface EstadoCanalMeli {
  permitido: boolean;
  motivo: "nao-configurado" | "nao-confirmado" | "grupo-alterado" | "expirado" | "confirmado";
  mensagem: string;
  confirmadoEm?: string;
}
function fingerprint(grupo: string): string {
  const nome=grupo.trim();
  if(!nome || nome.length>GRUPO_LIMITE) throw Error("Grupo WhatsApp não configurado.");
  return createHash("sha256").update(nome,"utf8").digest("hex");
}
export function avaliarCanalMeli(caminho:string,grupo:string|undefined,agora=Date.now()):EstadoCanalMeli {
  const negado=(motivo:EstadoCanalMeli["motivo"],mensagem:string):EstadoCanalMeli=>({
    permitido:false,motivo,mensagem
  });
  if(!grupo?.trim())return negado("nao-configurado","Defina um grupo WhatsApp antes de configurar o destino Mercado Livre.");
  let expected:string;
  try{expected=fingerprint(grupo);}catch{return negado("nao-configurado","Grupo WhatsApp inválido.");}
  try{
    if(statSync(caminho).size>2048)return negado("nao-confirmado","Confirmação de canal inválida.");
    const data=JSON.parse(readFileSync(caminho,"utf8")) as Record<string,unknown>;
    if(data.versao!==1 || data.canalTipo!=="publico-cadastrado" ||
       data.aceiteExplicito!==true || typeof data.grupoHash!=="string" ||
       typeof data.confirmadoEm!=="string"){
      return negado("nao-confirmado","Canal do Mercado Livre ainda não confirmado.");
    }
    if(data.grupoHash!==expected){
      return negado("grupo-alterado","O grupo configurado mudou. É preciso confirmar o novo canal público.");
    }
    const criado=Date.parse(data.confirmadoEm);
    if(!Number.isFinite(criado)|| criado>agora || agora-criado>=VALIDADE_MS){
      return negado("expirado","Confirmação do canal vencida ou inválida. Reconferir as regras do programa.");
    }
    return {permitido:true,motivo:"confirmado",
      mensagem:"Canal declarado como público e cadastrado no Programa (declaração do operador).",
      confirmadoEm:new Date(criado).toISOString()};
  }catch{
    return negado("nao-confirmado","Canal do Mercado Livre ainda não confirmado.");
  }
}
export async function confirmarCanalMeli(
  caminho:string,grupo:string|undefined,declaracao:DeclaracaoCanalMeli,agora=Date.now()
):Promise<void>{
  if(!declaracao || declaracao.grupoPublico!==true ||
    declaracao.cadastradoNoPrograma!==true || declaracao.semDivulgacaoPrivada!==true){
    throw Error("Confirme grupo público, canal cadastrado e ausência de divulgação privada.");
  }
  const grupoHash=fingerprint(grupo||"");
  const temporario=caminho+"."+randomBytes(6).toString("hex")+".tmp";
  await mkdir(dirname(caminho),{recursive:true});
  try{
    await writeFile(temporario,JSON.stringify({
      versao:1,canalTipo:"publico-cadastrado",aceiteExplicito:true,
      grupoHash,confirmadoEm:new Date(agora).toISOString()
    },null,2),{encoding:"utf8",mode:0o600});
    await rename(temporario,caminho);
  }finally{await rm(temporario,{force:true}).catch(()=>undefined);}
}
export async function revogarCanalMeli(caminho:string):Promise<void>{
  await rm(caminho,{force:true});
}
export function podeEnviarPlataforma(
  plataforma:string|undefined,caminho:string,grupo:string|undefined,agora=Date.now()
):boolean {
  const chave=(plataforma||"").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"").replace(/[\s-]/g,"");
  if(chave.includes("mercadolivre"))return avaliarCanalMeli(caminho,grupo,agora).permitido;
  return chave.includes("amazon") || chave.includes("shopee");
}
