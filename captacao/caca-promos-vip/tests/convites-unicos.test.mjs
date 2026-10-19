import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { iniciarContatos } from '../src/contatos.mjs';
import { iniciarDenuncias } from '../src/denuncias.mjs';
import { iniciarConvitesUnicos, MENSAGEM_PADRAO } from '../src/convites-unicos.mjs';
import { iniciarServidor } from '../src/server.mjs';
import { obterConfigMeta, montarModeloMeta, montarConviteMeta } from '../src/meta-cloud.mjs';

const urlGrupo='https://chat.whatsapp.com/ExemploConvite123';
const ambiente={
  WA_META_GRAPH_VERSION:'v25.0',
  WA_META_PHONE_NUMBER_ID:'123456789012345',
  WA_META_WABA_ID:'987654321987654',
  WA_META_ACCESS_TOKEN:'EAA_TESTE_'.repeat(5),
  WA_META_APP_SECRET:'segredo-app-para-testes-unitarios',
  WA_META_WEBHOOK_VERIFY_TOKEN:'verify-token-maior-que-vinte-e-quatro',
  WA_META_TEMPLATE_NAME:'convite_ofertas_v1',
  WA_META_ENABLE_SENDING:'true',
  WA_META_MAX_DAILY:'2',
};

function preparar(t,{ativo=false,client}={}) {
  const dir=mkdtempSync(join(tmpdir(),'cpv-cloud-unico-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const contatos=iniciarContatos(dir);
  const denuncias=iniciarDenuncias(dir,contatos);
  const config=obterConfigMeta(ativo?ambiente:{});
  const convites=iniciarConvitesUnicos({
    dataDir:dir,contatos,bloqueios:denuncias,configMeta:config,
    grupoInicial:urlGrupo,fetchImpl:client,
  });
  contatos.configurarRemetente('11999998888');
  function contato(nome,telefone,confirmado=true) {
    const cadastro=contatos.cadastrar({nome,telefone,origem:'teste',
      consentimento:true});
    const c=contatos.listar().find(x=>x.telefone.endsWith(telefone));
    if (confirmado) contatos.confirmar({id:c.id,codigo:cadastro.codigo,
      evidencia:'mensagem-recebida'});
    return c;
  }
  return {dir,contatos,denuncias,convites,contato,config};
}

test('modelo unico pode ser salvo sem numero, token ou conta Meta',t=>{
  const a=preparar(t);
  const cfg=a.convites.configuracao();
  assert.equal(cfg.mensagem,MENSAGEM_PADRAO);
  assert.equal(cfg.grupoUrl,urlGrupo);
  const texto='🎁 Convite único!\nSomos o Caça Promos VIP e você autorizou receber nossos convites.\nVenha conhecer o grupo de ofertas. Caso não queira novos convites, responda SAIR.';
  const salvo=a.convites.salvarConfiguracao({
    mensagem:texto,grupoUrl:urlGrupo,nomeModelo:'convite_ofertas_v1',
  });
  assert.equal(a.convites.configuracao().mensagem,texto);
  assert.ok(salvo.modificadoEm);
  assert.deepEqual(a.convites.templateParaMeta(),montarModeloMeta({
    texto,nomeModelo:'convite_ofertas_v1',
  }));
  assert.equal(a.convites.templateParaMeta().components[0].text,texto);
  assert.equal(a.convites.templateParaMeta().components[1].buttons.length,2);
  assert.equal(montarConviteMeta({para:'5511988887777'}).template.components.length,2);
  assert.throws(()=>a.convites.salvarConfiguracao({
    mensagem:texto+' {nome}',grupoUrl:urlGrupo,nomeModelo:'convite_ofertas_v1',
  }),/sem variaveis/);
  assert.throws(()=>a.convites.salvarConfiguracao({
    mensagem:texto,grupoUrl:'https://evil.test/group',nomeModelo:'convite_ofertas_v1',
  }),/chat.whatsapp.com/);
});

test('prévia e fila filtram opt-in e bloqueios, sem exigir numero Meta',async t=>{
  const a=preparar(t);
  const permitido=a.contato('Pessoa Autorizada','11988887777');
  const aguardando=a.contato('Pessoa Sem Optin','21999997777',false);
  const sim=a.convites.simular({contatoIds:[permitido.id,aguardando.id]});
  assert.equal(sim.modo,'SIMULACAO');
  assert.equal(sim.preparadas,1);
  assert.equal(sim.bloqueadas,1);
  assert.equal(sim.enviadas,0);
  assert.equal(sim.mensagem,MENSAGEM_PADRAO);
  assert.throws(()=>a.convites.criarFila({
    nome:'Primeira campanha',contatoIds:[permitido.id,aguardando.id],
  }),/autorizacao/);
  const fila=a.convites.criarFila({nome:'Primeira campanha',contatoIds:[permitido.id]});
  assert.equal(fila.pendentes,1);
  assert.equal(a.convites.detalhesFila(fila.id).mensagem,MENSAGEM_PADRAO);
  const persist=readFileSync(join(a.dir,'filas-convites-meta.json'),'utf8');
  assert.equal(persist.includes(permitido.telefone),false);
  assert.equal(a.convites.listarFilas()[0].total,1);
  assert.equal(a.convites.detalhesFila(fila.id).itens[0].telefoneMascarado.includes('7777'),true);
  a.convites.salvarConfiguracao({
    mensagem:MENSAGEM_PADRAO+'\nMais ofertas selecionadas.',grupoUrl:urlGrupo,
    nomeModelo:'convite_ofertas_v1',
  });
  assert.equal(a.convites.detalhesFila(fila.id).mensagem,MENSAGEM_PADRAO,
    'Fila criada mantém a mesma mensagem congelada');
  await assert.rejects(a.convites.processarLote({campanhaId:fila.id,confirmar:true}),
    /indisponivel/, 'Chamada rejeitada quando não existem credenciais');
});

test('bloqueio posterior remove contato pendente das campanhas Meta',t=>{
  const a=preparar(t);
  const c=a.contato('Pessoa com Opt-in','11988887777');
  const fila=a.convites.criarFila({nome:'Ofertas semanais',contatoIds:[c.id]});
  a.denuncias.registrar({
    telefone:c.telefone,mensagemId:'wamid.BLOQUEIO_FICTICIO',
  });
  assert.equal(a.convites.detalhesFila(fila.id).bloqueados,1);
  assert.equal(a.convites.simular({contatoIds:[c.id]}).preparadas,0);
  assert.equal(a.convites.pessoasElegiveis().length,0);
});

test('envio real por lote é bloqueado sem confirmação ou sem template aprovado',async t=>{
  const calls=[];
  const cliente=async (url,options)=>{
    calls.push({url,method:options.method});
    return {ok:true,json:async()=>({data:[{
      name:'convite_ofertas_v1',status:'REJECTED',language:'pt_BR',
      components:[
        {type:'BODY',text:MENSAGEM_PADRAO},
        {type:'BUTTONS',buttons:[{type:'QUICK_REPLY',text:'Entrar no grupo'},
          {type:'QUICK_REPLY',text:'Denunciar convite'}]},
      ],
    }]})};
  };
  const a=preparar(t,{ativo:true,client:cliente});
  const c=a.contato('Pessoa Fictícia','11988887777');
  const fila=a.convites.criarFila({nome:'Campanha de teste',contatoIds:[c.id]});
  await assert.rejects(a.convites.processarLote({
    campanhaId:fila.id,limite:1,confirmar:false,
  }),/Envio real indisponivel/);
  await assert.rejects(a.convites.processarLote({
    campanhaId:fila.id,limite:1,confirmar:true,
  }),/nao aprovado/);
  assert.equal(a.convites.detalhesFila(fila.id).pendentes,1);
  assert.equal(calls.filter(x=>x.method==='POST').length,0);
});

test('modelo aprovado, chamada falsa à Meta, status de entrega e limite diário',async t=>{
  let envios=0,requests=[];
  const cliente=async (url,opts)=>{
    requests.push({url,method:opts.method,body:opts.body||null});
    if(opts.method==='GET'){
      return {ok:true,json:async()=>({data:[{
        name:'convite_ofertas_v1',language:'pt_BR',status:'APPROVED',
        components:[
          {type:'BODY',text:MENSAGEM_PADRAO},
          {type:'BUTTONS',buttons:[{type:'QUICK_REPLY',text:'Entrar no grupo'},
            {type:'QUICK_REPLY',text:'Denunciar convite'}]},
        ],
      }]})};
    }
    const body=JSON.parse(opts.body);
    assert.equal(body.type,'template');
    assert.equal(body.template.components.length,2);
    assert.equal(body.template.components[0].parameters[0].payload,'CPV_ENTRAR');
    envios++;
    return {ok:true,json:async()=>({messages:[{id:'wamid.TESTE_ENVIO_'+envios}]})};
  };
  const a=preparar(t,{ativo:true,client:cliente});
  const ids=[
    a.contato('Fictício A','11988887777').id,
    a.contato('Fictício B','21999997777').id,
    a.contato('Fictício C','31988887777').id,
  ];
  const fila=a.convites.criarFila({nome:'Convites autorizados',contatoIds:ids});
  const r=await a.convites.processarLote({
    campanhaId:fila.id,limite:10,confirmar:true,
  });
  assert.equal(r.aceitos,2,'Respeita o máximo diário configurado');
  assert.equal(r.restantes,1);
  assert.equal(envios,2);
  assert.equal(a.convites.detalhesFila(fila.id).aceitos,2);
  assert.equal(a.convites.registrarStatus({
    mensagemId:'wamid.TESTE_ENVIO_1',status:'delivered',
  }),true);
  assert.equal(a.convites.registrarStatus({
    mensagemId:'wamid.TESTE_ENVIO_1',status:'sent',
  }),false,'Não retrocede a entrega já registrada');
  assert.equal(a.convites.detalhesFila(fila.id).entregues,1);
  await assert.rejects(a.convites.processarLote({
    campanhaId:fila.id,limite:10,confirmar:true,
  }),/Limite diario/);
  assert.ok(requests.every(req=>req.url.startsWith('https://graph.facebook.com/')));
});

test('clique Entrar envia link apenas ao interessado e ignora evento duplicado',async t=>{
  const chamadas=[];
  const cliente=async (url,opts)=>{
    chamadas.push(JSON.parse(opts.body));
    return {ok:true,json:async()=>({messages:[{id:'wamid.RESPOSTA_TESTE'}]})};
  };
  const a=preparar(t,{ativo:true,client:cliente});
  const c=a.contato('Pessoa fictícia','11988887777');
  const evento={telefone:c.telefone,mensagemId:'wamid.BOTAO_ENTRAR_001'};
  const primeiro=await a.convites.processarCliqueEntrar(evento);
  assert.equal(primeiro.respondido,true);
  assert.equal(chamadas.length,1);
  assert.equal(chamadas[0].type,'text');
  assert.match(chamadas[0].text.body,/chat\.whatsapp\.com/);
  assert.equal((await a.convites.processarCliqueEntrar(evento)).duplicada,true);
  assert.equal(chamadas.length,1);
  a.denuncias.registrar({telefone:c.telefone,mensagemId:'wamid.DENUNCIA_TESTE'});
  assert.equal((await a.convites.processarCliqueEntrar({
    telefone:c.telefone,mensagemId:'wamid.BOTAO_ENTRAR_002',
  })).bloqueado,true);
  assert.equal(chamadas.length,1);
});

test('HTTP local salva mensagem e simula sem senha, sem número e sem disparos',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'cpv-convite-http-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const app=await iniciarServidor({dataDir:dir,port:0,metaAmbiente:{}});
  t.after(()=>new Promise(done=>app.servidor.close(done)));
  const base=app.base;
  const modelo=await (await fetch(base+'/api/local/campanhas/convite/modelo')).json();
  assert.equal(modelo.ok,true);
  assert.equal(modelo.modeloMeta.components[0].text,MENSAGEM_PADRAO);
  const post=(path,dados)=>fetch(base+path,{
    method:'POST',headers:{origin:base,'content-type':'application/json',
      'x-cpv-local':'1'},body:JSON.stringify(dados),
  });
  const change=await post('/api/local/campanhas/convite/modelo',{
    mensagem:MENSAGEM_PADRAO,grupoUrl:urlGrupo,nomeModelo:'convite_ofertas_v1',
  });
  assert.equal(change.status,200);
  const sim=await (await post('/api/local/campanhas/convite/simular',{
    contatoIds:[],
  })).json();
  assert.equal(sim.simulacao.enviadas,0);
  assert.equal(sim.simulacao.preparadas,0);
  const enviar=await post('/api/local/campanhas/convite/enviar',{
    campanhaId:'00000000-0000-4000-8000-000000000000',confirmar:true,
  });
  assert.equal(enviar.status,409);
  assert.match((await enviar.json()).mensagem,/Envio real indisponivel/);
  assert.equal((await fetch(base+'/api/local/campanhas/convite/filas')).status,200);
  assert.equal((await fetch(base+'/api/local/campanhas/convite/validacao')).status,200);
  assert.equal((await fetch(base+'/api/admin/contatos')).status,401);
  assert.equal((await fetch(base+'/campanhas')).status,200);
});
