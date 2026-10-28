import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script=fileURLToPath(new URL("../scripts/etapa50/diagnosticar-url-manual.ps1",import.meta.url));

test("teste manual recusa URL sem confirmacao e nao entra em contato com painel",{
  skip:process.platform!=="win32"
},()=>{
  const result=spawnSync("powershell.exe",[
    "-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass",
    "-File",script,"-UrlProduto",
    "https://www.mercadolivre.com.br/p/MLB123456"
  ],{encoding:"utf8",timeout:8000});
  assert.equal(result.status,3,result.stderr||result.stdout);
  assert.match(result.stdout,/EXECUTION_REFUSED/);
  assert.doesNotMatch(result.stdout+result.stderr,/SAFE_TEST_START/);
});

test("script nao oferece envio de mensagem e limpa somente seu proprio teste",async()=>{
  const txt=await readFile(script,"utf8");
  assert.match(txt,/param\(\[string\]\$UrlProduto,\[switch\]\$ConfirmarTesteManual,\[switch\]\$VerificarDestino\)/);
  assert.match(txt,/AFFILIATE_ATTRIBUTION_PROVEN=false/);
  assert.match(txt,/WHATSAPP_SENT=false/);
  assert.match(txt,/mercadolivre-link-diagnostico-limpar/);
  assert.match(txt,/mercadoLivreTesteLinkJob\.id -eq \$jobId/);
  assert.match(txt,/mercadoLivreExtensionConectada/);
  assert.doesNotMatch(txt,/whatsapp:preparar|enviarOfertaNoWhatsapp|ultima-mensagem-whatsapp\.txt.*Set-Content/i);
});

test("PowerShell manual probe tem sintaxe valida",{
  skip:process.platform!=="win32"
},()=>{
  const result=spawnSync("powershell.exe",[
    "-NoProfile","-NonInteractive","-Command",
    "$t=$null;$e=$null;[System.Management.Automation.Language.Parser]::ParseFile("+
      JSON.stringify(script)+",[ref]$t,[ref]$e)|Out-Null;if(@($e).Count){exit 2}"
  ],{encoding:"utf8",timeout:8000});
  assert.equal(result.status,0,result.stderr||result.stdout);
});
