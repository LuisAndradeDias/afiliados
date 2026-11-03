import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const raiz=dirname(dirname(fileURLToPath(import.meta.url)));

test("preparador ficticio confirma grupo e compositor, sem envio",async()=>{
  const temp=await mkdtemp(join(tmpdir(),"cpv-whatsapp-preparador-"));
  try{
    await mkdir(join(temp,"data"));
    await writeFile(join(temp,"data","ultima-mensagem-whatsapp.txt"),
      "TESTE ISOLADO - NAO ENVIAR\nProduto ficticio\nhttps://example.com/PRODUTO123");
    await writeFile(join(temp,"data","ultima-oferta-whatsapp.json"),JSON.stringify({
      plataforma:"Amazon Brasil",produtoId:"B000000001",
      titulo:"Produto ficticio",precoAtual:99.99
    }));
    const loader=pathToFileURL(join(raiz,"node_modules","tsx","dist","loader.mjs")).href;
    const exec=join(raiz,"src","robo","whatsapp-preparar.ts");
    const result=spawnSync(process.execPath,["--import",loader,exec],{
      cwd:temp,encoding:"utf8",timeout:45000,
      env:{
        ...process.env,WHATSAPP_PREPARE_TEST:"true",
        WHATSAPP_GROUP_NAME:"Caça Promos VIP 👑",
        WHATSAPP_AUTO_SEND_ENABLED:"false",
        WHATSAPP_BROWSER_CHANNEL:"chrome"
      }
    });
    assert.equal(result.status,0,result.stderr?.slice(0,1100));
    assert.match(result.stdout,/DESTINO_WHATSAPP_CONFIRMADO/);
    assert.match(result.stdout,/Teste concluído/);
    assert.doesNotMatch(result.stdout,/ENVIO_CONFIRMADO_AUTO|AUTO_ENVIO_INICIADO/);
  } finally {await rm(temp,{force:true,recursive:true});}
});
