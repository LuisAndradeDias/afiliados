import {getStore} from '@netlify/blobs';
import {sincronizarDenuncias} from '../../lib/denuncia-core.mjs';
export const config={path:'/api/denuncias-pendentes'};
export default async function(req){
  return sincronizarDenuncias(req,{store:getStore({name:'cpv-denuncias-v1',consistency:'strong'}),
    secret:process.env.CPV_DENUNCIA_NETLIFY_SECRET});
}
