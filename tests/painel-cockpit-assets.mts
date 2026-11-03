import assert from "node:assert/strict";
import {createServer} from "node:http";
import {responderRotaVisual} from "../src/painel/rotas-visuais.js";
const raiz=process.cwd();
const server=createServer((req,res)=>{
  void responderRotaVisual({
    method:req.method,pathname:(req.url??"").split("?")[0],
    res,raiz
  }).then(served=>{
    if(!served){res.writeHead(404);res.end();}
  }).catch(()=>{res.writeHead(500);res.end();});
});
await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",()=>resolve()));
try{
  const addr=server.address();
  if(!addr||typeof addr==="string")throw Error("sem porta");
  const origin="http://127.0.0.1:"+addr.port;
  for(const [path,contentType,fragment] of [
    ["/central/assets/ofertas-cockpit.css","text/css","ops-now-banner"],
    ["/central/assets/ofertas-cockpit.js","text/javascript","opsSettingsOpen"]
  ]){
    const response=await fetch(origin+path);
    assert.equal(response.status,200,path);
    assert.match(response.headers.get("content-type")??"",new RegExp(contentType));
    assert.ok((await response.text()).includes(fragment),path);
  }
  for (const path of ["/ofertas", "/"]) {
    const page=await fetch(origin+path);
    assert.equal(page.status,200,path);
    assert.equal(page.headers.get("cache-control"),"no-store",
      "HTML da Central deve ser sempre revalidado, evitando interface antiga.");
  }
  const unknown=await fetch(origin+"/central/assets/arquivo-secreto.txt");
  assert.equal(unknown.status,404,"rotas nao permitidas permanecem bloqueadas");
  console.log("ASSETS_COCKPIT_OK: CSS e JS públicos, rota desconhecida negada");
} finally {
  await new Promise<void>(resolve=>server.close(()=>resolve()));
}
