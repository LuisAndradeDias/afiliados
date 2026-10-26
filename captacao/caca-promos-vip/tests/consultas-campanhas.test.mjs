import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarServidor } from '../src/server.mjs';
import { consultarCampanhasLocais } from '../src/consultas/campanhas.mjs';

const fake = () => ({
  campanhas: {
    listar: () => [{id:'c'}], destinatarios: () => [{id:'p'}],
    obter: id => {if(id==='bad')throw Error('Campanha inexistente.');return {id}}
  },
  convitesUnicos: {
    configuracao: () => ({modelo:'exemplo'}), templateParaMeta: () => ({nome:'teste'}),
    listarFilas: () => [{id:'f'}], estatisticasManual: () => ({pendentes:0}),
    detalhesFila: id => {if(id==='bad')throw Error('Fila inexistente.');return {id}}
  },
  denuncias: {resumo: () => ({total:1}), listar: () => [{motivo:'saida-solicitada'}]},
  sincronizacaoNetlify: {estado: () => ({ok:true})},
  controleWhatsapp: {estado: () => ({fase:'pausado'})},
  conexaoWhatsapp: {estado: () => ({conectado:false})},
  contatoResumo: () => ({remetente:null,remetenteConfigurado:false}),
  configMeta: {}, resumoMeta: () => ({habilitado:false})
});

test('consultas: 12 rotas GET preservam respostas e não fazem envios', () => {
  const deps=fake();
  const cases=[
    ['/api/local/campanhas',{campanhas:[{id:'c'}]}],
    ['/api/local/campanhas/meta',{integracao:{habilitado:false},denuncias:{total:1}}],
    ['/api/local/campanhas/denuncias',{ocorrencias:[{motivo:'saida-solicitada'}],sincronizacao:{ok:true}}],
    ['/api/local/campanhas/convite/modelo',{configuracao:{modelo:'exemplo'},modeloMeta:{nome:'teste'}}],
    ['/api/local/campanhas/convite/filas',{filas:[{id:'f'}]}],
    ['/api/local/campanhas/convite/manual/estatisticas',{controle:{pendentes:0}}],
    ['/api/local/campanhas/convite/whatsapp/estado',{estado:{fase:'pausado'}}],
    ['/api/local/campanhas/convite/whatsapp/conexao/estado',{estado:{conectado:false}}],
    ['/api/local/campanhas/convite/fila',{fila:{id:'f'}}],
    ['/api/local/campanhas/destinatarios',{destinatarios:[{id:'p'}]}],
    ['/api/local/campanhas/configuracao',{remetente:null,remetenteConfigurado:false}],
    ['/api/local/campanhas/detalhe',{campanha:{id:'c'}}]
  ];
  for(const [pathname, expected] of cases){
    const id=pathname.endsWith('/fila')?'f':'c';
    assert.deepEqual(consultarCampanhasLocais({...deps,pathname,busca:new URLSearchParams('id='+id)}),
      {status:200,body:{ok:true,...expected}},pathname);
  }
  for(const pathname of ['/api/local/campanhas/rapido/contatos','/api/local/campanhas/convite/validacao',
    '/api/local/campanhas/convite/enviar','/api/local/campanhas/convite/whatsapp/enviar',
    '/api/local/campanhas/convite/fila/limpar','/api/local/campanhas/nao-existe']){
    assert.equal(consultarCampanhasLocais({...deps,pathname,busca:new URLSearchParams()}),null,pathname);
  }
});

test('consultas: fila/campanha inexistentes retornam 404 sem mascarar erro',()=>{
  const deps=fake();
  assert.deepEqual(consultarCampanhasLocais({...deps,pathname:'/api/local/campanhas/convite/fila',
    busca:new URLSearchParams('id=bad')}),{status:404,body:{ok:false,mensagem:'Fila inexistente.'}});
  assert.deepEqual(consultarCampanhasLocais({...deps,pathname:'/api/local/campanhas/detalhe',
    busca:new URLSearchParams('id=bad')}),{status:404,body:{ok:false,mensagem:'Campanha inexistente.'}});
});

test('consultas: HTTP local continua exigindo proteção e suporta HEAD',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cpv-consultas-campanhas-'));
  const app=await iniciarServidor({port:0,host:'127.0.0.1',dataDir:dir,whatsappWorkerTeste:true,
    metaAmbiente:{},publicBaseUrl:''});
  t.after(async()=>{app.servidor.closeAllConnections();
    await new Promise(resolve=>app.servidor.close(resolve));
    rmSync(dir,{recursive:true,force:true});});
  for(const path of ['/api/local/campanhas','/api/local/campanhas/convite/modelo',
    '/api/local/campanhas/convite/filas','/api/local/campanhas/convite/whatsapp/estado',
    '/api/local/campanhas/configuracao']){
    const response=await fetch(app.base+path);
    assert.equal(response.status,200,path);
    assert.equal((await response.json()).ok,true);
    const head=await fetch(app.base+path,{method:'HEAD'});
    assert.equal(head.status,200,path+' HEAD');
  }
  const denied=await fetch(app.base+'/api/local/campanhas/convite/filas',
    {headers:{'sec-fetch-site':'cross-site'}});
  assert.equal(denied.status,403);
});
