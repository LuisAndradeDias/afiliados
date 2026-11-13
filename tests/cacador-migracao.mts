/** Migração de compatibilidade usando SOMENTE banco temporário fictício. */
import assert from "node:assert/strict";
import test from "node:test";
import {mkdtemp,mkdir,rm,stat} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {DatabaseSync} from "node:sqlite";
test("migra apenas catálogo e histórico, sem envios nem credenciais",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"cpv-migrate-test-"));
  const origemDir=join(dir,"fonte"),destDir=join(dir,"destino");
  await mkdir(origemDir);await mkdir(destDir);
  const source=join(origemDir,"ofertas.db");
  const target=join(destDir,"catalogo.sqlite");
  const db=new DatabaseSync(source);
  try{
    db.exec([
      "CREATE TABLE ofertas(id TEXT PRIMARY KEY,titulo TEXT,link TEXT,imagem TEXT,",
      "preco REAL,preco_antigo REAL,link_afiliado TEXT,nota REAL,avaliacoes INTEGER,",
      "vendidos INTEGER,frete_gratis INTEGER,full INTEGER,mais_vendido INTEGER,",
      "cupom TEXT,comissao_pct REAL,ultima_vez TEXT);",
      "CREATE TABLE observacoes(quando TEXT,produto_id TEXT,preco REAL,preco_antigo REAL);",
      "CREATE TABLE envios(id INTEGER PRIMARY KEY,telefone TEXT,grupo TEXT,texto TEXT);",
      "CREATE TABLE cliques(id INTEGER PRIMARY KEY,ip TEXT);"
    ].join(" "));
    const datas=[3,2,1].map(i=>{
      const date=new Date(Date.now()-i*86400000);
      return date.toISOString().slice(0,19);
    });
    const query=db.prepare([
      "INSERT INTO ofertas(id,titulo,link,imagem,preco,preco_antigo,link_afiliado,",
      "nota,avaliacoes,vendidos,frete_gratis,full,mais_vendido,cupom,",
      "comissao_pct,ultima_vez) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ].join(" "));
    query.run("MLB123456789","Produto de exemplo para teste",
      "https://www.mercadolivre.com.br/p/MLB123456789",null,
      79.9,99.9,"https://meli.la/demoficticio",4.8,100,250,1,0,0,
      "CUPOMTESTE",6,datas[2]);
    const insert=db.prepare(
      "INSERT INTO observacoes(quando,produto_id,preco,preco_antigo) VALUES(?,?,?,?)"
    );
    for(const [i,data] of datas.entries()){
      insert.run(data,"MLB123456789",i===2?79.9:99.9,119.9);
    }
    db.prepare("INSERT INTO envios(telefone,grupo,texto) VALUES(?,?,?)")
      .run("00000000000","GRUPO PRIVADO","mensagem sensível fictícia");
    db.prepare("INSERT INTO cliques(ip) VALUES(?)").run("192.0.2.22");
  }finally{db.close();}
  const script=join(process.cwd(),"tools","cacador","migrar-claude.mts");
  const run=(args:string[])=>spawnSync(process.execPath,["--import","tsx",script,...args],{
    cwd:process.cwd(),encoding:"utf8",timeout:20000,env:{...process.env}
  });
  try{
    const before=await stat(source);
    const preview=run(["--origem",source]);
    assert.equal(preview.status,0,preview.stderr);
    const resumo=JSON.parse(preview.stdout);
    assert.equal(resumo.modo,"previa-somente-leitura");
    assert.equal(resumo.produtosCompativeis,1);
    assert.equal(resumo.observacoesCompativeis,3);
    assert.equal(resumo.produtosImportados,0);
    const after=await stat(source);
    assert.equal(before.size,after.size);
    const wrong=run(["--origem",source,"--destino",join(origemDir,"out.sqlite"),"--aplicar"]);
    assert.notEqual(wrong.status,0,"Não escrever na pasta do projeto do Claude");
    const result=run(["--origem",source,"--destino",target,"--aplicar"]);
    assert.equal(result.status,0,result.stderr);
    const counts=JSON.parse(result.stdout);
    assert.equal(counts.produtosImportados,1);
    assert.equal(counts.observacoesImportadas,3);
    assert.equal(counts.publicacoes,0);
    const imported=new DatabaseSync(target,{readOnly:true});
    try{
      const rows=imported.prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as Array<{name:string}>;
      const names=new Set(rows.map(x=>x.name));
      assert.ok(names.has("produtos")&&names.has("observacoes"));
      for(const forbidden of ["envios","cliques","sessao","usuarios"]){
        assert.equal(names.has(forbidden),false);
      }
      const res=imported.prepare("SELECT canal,disponibilidade,frete_centavos,origem FROM produtos")
        .get() as {canal:string;disponibilidade:string;frete_centavos:number|null;origem:string};
      assert.equal(res.canal,"Mercado Livre");
      assert.equal(res.disponibilidade,"nao-confirmada");
      assert.equal(res.frete_centavos,null);
      assert.equal(res.origem,"snapshot-claude");
      assert.equal((imported.prepare("SELECT COUNT(*) n FROM observacoes").get() as {n:number}).n,3);
    }finally{imported.close();}
  }finally{await rm(dir,{recursive:true,force:true});}
});
