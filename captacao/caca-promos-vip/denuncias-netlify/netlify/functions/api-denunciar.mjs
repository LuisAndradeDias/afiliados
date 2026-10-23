import {getStore} from '@netlify/blobs';
import {receberDenuncia} from '../../lib/denuncia-core.mjs';
export const config={path:'/api/denunciar'};
export default async function(req){
  return receberDenuncia(req,{store:getStore({name:'cpv-denuncias-v1',consistency:'strong'}),
    secret:process.env.CPV_DENUNCIA_NETLIFY_SECRET});
}
