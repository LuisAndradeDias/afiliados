import {readFileSync} from 'node:fs';
import {join} from 'node:path';

function validarUrlPublica(value) {
  const url=new URL(String(value||''));
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||
    url.search||url.hash||['localhost','127.0.0.1','0.0.0.0'].includes(url.hostname)){
    throw new Error('O Netlify exige origem HTTPS pública, sem caminhos ou parâmetros.');
  }
  return url.origin;
}
// Configuração privada em DATA_DIR, fora do repositório/GitHub.
export function lerConfigNetlify(dataDir,ambiente=process.env){
  let config={};
  try{
    config=JSON.parse(readFileSync(join(dataDir,'denuncias-netlify-config.json'),'utf8'));
  }catch(e){if(e.code!=='ENOENT')throw e;}
  const url=config.publicBaseUrl||ambiente.CAPTACAO_PUBLIC_BASE_URL||'';
  const secret=config.segredo||ambiente.CPV_DENUNCIA_NETLIFY_SECRET||'';
  if(!url&&!secret)return null;
  if(!url||!/^[a-f0-9]{64}$/i.test(String(secret))){
    // Enquanto falta configurar o site, o painel segue sem inserir links inoperantes.
    return null;
  }
  return {publicBaseUrl:validarUrlPublica(url),segredo:String(secret).toLowerCase()};
}
export function iniciarSincronizacaoNetlify({
  config,denuncias,fetchImpl=globalThis.fetch,
  intervaloMs=600000,agora=()=>new Date(),
}={}){
  let agendador=null,executando=false,ultimaSincronizacao=null,
    ultimoErro=null,importadas=0;
  function estado(){
    return {configurada:Boolean(config),ultimaSincronizacao,ultimoErro,
      importadas,executando,intervaloSegundos:intervaloMs/1000};
  }
  async function sincronizar(){
    if(!config)return {ok:false,mensagem:'Netlify ainda não configurado.'};
    if(executando)return {ok:false,mensagem:'Sincronização já está em andamento.'};
    executando=true;
    let feitas=0;
    try{
      const url=config.publicBaseUrl+'/api/denuncias-pendentes';
      const headers={'authorization':'Bearer '+config.segredo};
      const resposta=await fetchImpl(url,{headers,signal:AbortSignal.timeout(9000)});
      if(!resposta.ok)throw new Error('Netlify respondeu HTTP '+resposta.status);
      const dados=await resposta.json();
      if(!dados.ok||!Array.isArray(dados.eventos)||dados.eventos.length>50){
        throw new Error('Resposta inválida da fila de denúncias.');
      }
      for(const evento of dados.eventos){
        const registro=denuncias.registrarTokenNetlify(evento.token,config.segredo);
        if(!registro.valido||!registro.registrado){
          // Nunca confirme o evento remoto antes de persistir o bloqueio local.
          continue;
        }
        const ack=await fetchImpl(url,{
          method:'POST',headers:{...headers,'content-type':'application/json'},
          body:JSON.stringify({token:evento.token}),
          signal:AbortSignal.timeout(9000),
        });
        if(!ack.ok)throw new Error('Netlify não confirmou o recebimento da sincronização.');
        feitas++;
      }
      importadas+=feitas;
      ultimaSincronizacao=agora().toISOString();ultimoErro=null;
      return {ok:true,novas:feitas};
    }catch(e){
      ultimoErro=String(e.message||'Falha de comunicação').slice(0,130);
      return {ok:false,mensagem:ultimoErro,novas:feitas};
    }finally{executando=false;}
  }
  function iniciar(){
    if(!config||agendador)return;
    agendador=setInterval(()=>{void sincronizar();},intervaloMs);
    agendador.unref?.();
    void sincronizar();
  }
  function parar(){
    if(agendador)clearInterval(agendador);
    agendador=null;
  }
  return {sincronizar,iniciar,parar,estado};
}
