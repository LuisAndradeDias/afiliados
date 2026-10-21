import {createHash,createHmac,timingSafeEqual} from 'node:crypto';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TOKEN=/^([a-f0-9-]{36})\.([a-f0-9]{64})$/i;
const HEADERS={'cache-control':'no-store','referrer-policy':'no-referrer',
  'x-content-type-options':'nosniff','x-frame-options':'DENY'};

export function segredoValido(secret){
  return typeof secret==='string'&&/^[a-f0-9]{64}$/i.test(secret);
}
export function assinatura(id,secret){
  if(!segredoValido(secret)||!UUID.test(id))throw new Error('Assinatura indisponível.');
  return createHmac('sha256',Buffer.from(secret,'hex'))
    .update('cpv-netlify-report-v1:'+id.toLowerCase()).digest('hex');
}
export function validarToken(token,secret){
  if(!segredoValido(secret)||typeof token!=='string'||token.length>110)return null;
  const m=TOKEN.exec(token);
  if(!m||!UUID.test(m[1]))return null;
  const id=m[1].toLowerCase();
  const s=Buffer.from(m[2],'hex');
  const esperado=Buffer.from(assinatura(id,secret),'hex');
  return s.length===esperado.length&&timingSafeEqual(s,esperado)?id:null;
}
export function chaveEvento(token){
  return 'pendentes/'+createHash('sha256').update(token).digest('hex');
}
function json(status,data){
  return Response.json(data,{status,headers:HEADERS});
}
function origemValida(req){
  const origem=req.headers.get('origin'), site=req.headers.get('sec-fetch-site');
  return (!origem||origem===new URL(req.url).origin) &&
    (!site||site==='none'||site==='same-origin');
}
async function lerJson(req){
  if(!(req.headers.get('content-type')||'').startsWith('application/json'))return null;
  const txt=await req.text();
  if(txt.length>2048)return null;
  try{const v=JSON.parse(txt);return v&&typeof v==='object'&&!Array.isArray(v)?v:null;}
  catch{return null;}
}
export async function receberDenuncia(req,{store,secret,agora=()=>new Date()}={}){
  if(req.method!=='POST')return json(405,{ok:false,mensagem:'Método não permitido.'});
  if(!origemValida(req))return json(403,{ok:false,mensagem:'Origem não autorizada.'});
  if(!segredoValido(secret))return json(503,{ok:false,mensagem:'Serviço indisponível.'});
  const corpo=await lerJson(req),token=corpo?.token;
  if(!validarToken(token,secret))return json(404,{ok:false,mensagem:'Link inválido.'});
  try{
    const key=chaveEvento(token);
    const existe=await store.get(key,{type:'json',consistency:'strong'});
    if(!existe)await store.setJSON(key,{token,recebidoEm:agora().toISOString(),versao:1});
    return json(202,{ok:true,recebida:true,
      mensagem:'Denúncia interna recebida. O bloqueio será aplicado após a sincronização.'});
  }catch{return json(503,{ok:false,mensagem:'Não foi possível salvar. Tente novamente.'});}
}
function autorizado(req,secret){
  if(!segredoValido(secret))return false;
  const auth=req.headers.get('authorization')||'';
  if(!/^Bearer [a-f0-9]{64}$/i.test(auth))return false;
  return timingSafeEqual(Buffer.from(auth.slice(7),'hex'),Buffer.from(secret,'hex'));
}
export async function sincronizarDenuncias(req,{store,secret}={}){
  if(!autorizado(req,secret))return json(401,{ok:false,mensagem:'Acesso negado.'});
  if(req.method==='GET'){
    try{
      const {blobs}=await store.list({prefix:'pendentes/'});
      const eventos=[];
      for(const entry of blobs.slice(0,50)){
        const evento=await store.get(entry.key,{type:'json',consistency:'strong'});
        if(evento?.token&&validarToken(evento.token,secret)){
          eventos.push({token:evento.token,recebidoEm:evento.recebidoEm});
        }
      }
      return json(200,{ok:true,eventos});
    }catch{return json(503,{ok:false,mensagem:'Fila indisponível.'});}
  }
  if(req.method==='POST'){
    const body=await lerJson(req);
    if(!validarToken(body?.token,secret))return json(400,{ok:false,mensagem:'Token inválido.'});
    try{
      await store.delete(chaveEvento(body.token));
      return json(200,{ok:true,confirmada:true});
    }catch{return json(503,{ok:false,mensagem:'Não foi possível confirmar a sincronização.'});}
  }
  return json(405,{ok:false,mensagem:'Método não permitido.'});
}
