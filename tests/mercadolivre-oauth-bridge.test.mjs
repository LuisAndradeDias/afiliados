import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { iniciarPonteOAuth } from '../scripts/mercadolivre-oauth-bridge.mjs';

const code = 'TG-VALIDCODE123';
const state = 'a'.repeat(48);

function listen(server) {
  return new Promise((resolve,reject) => {
    server.once('error',reject);
    server.listen(0,'127.0.0.1',() => resolve(server.address().port));
  });
}
function close(server) {
  return new Promise(resolve => server.close(resolve));
}
async function fixture(t,{upstreamStatus=302,upstreamLocation='/?mercadolivre=conectado'}={}) {
  const calls=[];
  const backend=createServer((req,res)=>{
    calls.push(req.url);
    res.writeHead(upstreamStatus,{
      location:upstreamLocation,
      'content-type':'text/plain',
    });
    res.end('sensitive upstream details MUST NOT be echoed');
  });
  const port=await listen(backend);
  t.after(()=>close(backend));
  const bridge=await iniciarPonteOAuth({port:0,target:'http://127.0.0.1:'+port});
  t.after(()=>close(bridge.server));
  return {url:bridge.address,calls};
}
const get=(base,path)=>fetch(base+path,{redirect:'manual'});

test('OAuth callback bridge exposes no dashboard, API, JS, or POST route',async t=>{
  const {url,calls}=await fixture(t);
  const cases=[
    ['/',404],['/api/status',404],
    ['/api/action',404],
    ['/assets/layout-clean.css',404],
    ['/oauth/mercadolivre/callback',400],
    ['/oauth/mercadolivre/callback?code=abc&state=a',400],
    ['/oauth/mercadolivre/callback?code='+code+'&state='+'b'.repeat(47),400],
    ['/oauth/mercadolivre/callback?error=access_denied',400],
  ];
  for(const [path,status] of cases){
    const r=await get(url,path);
    assert.equal(r.status,status,path);
    assert.equal(r.headers.get('access-control-allow-origin'),null);
    assert.equal(r.headers.get('cache-control'),'no-store');
  }
  const post=await fetch(url+'/oauth/mercadolivre/callback',{
    method:'POST',body:'code='+code+'&state='+state,
  });
  assert.equal(post.status,405);
  assert.equal(calls.length,0);
});
test('valid OAuth return is forwarded once, redirects only to local panel',async t=>{
  const {url,calls}=await fixture(t);
  const r=await get(url,
    '/oauth/mercadolivre/callback?code='+code+'&state='+state);
  assert.equal(r.status,302);
  assert.equal(r.headers.get('location'),
    'http://127.0.0.1:3030/?mercadolivre=conectado');
  assert.equal(calls.length,1);
  assert.ok(calls[0].startsWith('/oauth/mercadolivre/callback?'));
  assert.ok(calls[0].includes('code='+code));
  assert.ok(calls[0].includes('state='+state));
});
test('invalid upstream redirect cannot become an open redirect',async t=>{
  const {url}=await fixture(t,{upstreamLocation:'https://evil.invalid/'});
  const r=await get(url,
    '/oauth/mercadolivre/callback?code='+code+'&state='+state);
  assert.equal(r.status,502);
  assert.equal(r.headers.get('location'),null);
  const body=await r.text();
  assert.doesNotMatch(body,/VALIDCODE|evil|sensitive upstream/);
});
