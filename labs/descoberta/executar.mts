import {mkdir,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {simularOrquestrador} from "./orquestrador.js";
import {compararComClaude} from "./cacador-claude-adapter.js";
const {relatorio:resultado,coletasSimuladas,falhasDeFonte}=await simularOrquestrador();
const dir=join(process.cwd(),"test-results","lab-descoberta");
await mkdir(dir,{recursive:true});
const json=JSON.stringify(resultado,null,2);
const template=await readFile("labs/descoberta/painel-template.html","utf8");
if(!template.includes("__LAB_DATA_JSON__"))throw Error("Template sem dados");
const safe=JSON.stringify(resultado).replace(/</g,"\\u003c")
 .replace(/>/g,"\\u003e").replace(/&/g,"\\u0026");
const page=template.replace("__LAB_DATA_JSON__",safe);
if(page.includes("__LAB_DATA_JSON__"))throw Error("Template incompleto");
await writeFile(join(dir,"resultado.json"),json,"utf8");
const comparativo=compararComClaude(resultado.ciclos.at(-1)!.avaliacoes);
await writeFile(join(dir,"comparativo-cacador-claude.json"),JSON.stringify(comparativo,null,2),"utf8");
await writeFile(join(dir,"radar-laboratorio.html"),page,"utf8");
const final=resultado.ciclos.at(-1)!;
console.log("LAB_FILE_HTML="+join(dir,"radar-laboratorio.html"));
console.log("LAB_FILE_JSON="+join(dir,"resultado.json"));
console.log("LAB_FONTES_SIMULADAS="+coletasSimuladas+" FALHAS="+falhasDeFonte);
console.log("LAB_CLAUDE_COMPARATIVO="+JSON.stringify(comparativo.resumo));
console.log("LAB_RESUMO="+JSON.stringify(resultado.resumo));
console.log("LAB_RESULTADO_FINAL="+JSON.stringify(final.avaliacoes.map(o=>({
 canal:o.canal,titulo:o.titulo,status:o.status,queda:o.reducaoPercentual,
 cupom:o.cupomStatus,razoes:o.razoes
}))));
