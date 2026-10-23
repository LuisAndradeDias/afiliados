import {getStore} from '@netlify/blobs';
import {receberRecusa} from '../../lib/denuncia-core.mjs';

export const config={path:'/api/recusar'};

export default async function(req){
  return receberRecusa(req,{
    store:getStore({name:'cpv-denuncias-v1',consistency:'strong'}),
    secret:process.env.CPV_DENUNCIA_NETLIFY_SECRET,
  });
}
