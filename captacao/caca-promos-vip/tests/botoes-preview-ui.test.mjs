import test from 'node:test';
import assert from 'node:assert/strict';
import {renderEnvioRapido} from '../src/envio-rapido-ui.mjs';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const parent=join(dirname(fileURLToPath(import.meta.url)),'../src/assets');

test('envio guiado apresenta os dois botoes como previa, sem prometer envio nativo',()=>{
  const html=renderEnvioRapido({
    mensagem:'Olá. Você autorizou mensagens de convite. Responda SAIR.',
    grupoUrl:'https://chat.whatsapp.com/abcDE123',
  });
  assert.match(html,/id="quickPreviewJoin"/);
  assert.match(html,/id="quickPreviewDecline"/);
  assert.match(html,/>Entrar no grupo<\/button>/);
  assert.match(html,/>Não tenho interesse<\/button>/);
  assert.match(html,/PRÉVIA EXPERIMENTAL/);
  assert.match(html,/Ainda não conectados/);
  assert.match(html,/O envio normal continuará sem botões/);
  assert.match(html,/Estes são botões de demonstração/);
});

test('a demonstracao reage sem acionar endpoints de envio ou bloquear numeros',()=>{
  const js=readFileSync(join(parent,'envio-rapido.js'),'utf8');
  assert.match(js,/\$\('quickPreviewJoin'\)\.addEventListener\('click'/);
  assert.match(js,/\$\('quickPreviewDecline'\)\.addEventListener\('click'/);
  const start=js.indexOf("$('quickPreviewJoin').addEventListener(");
  const end=js.indexOf("$('quickCreate').addEventListener(",start);
  assert.ok(start>=0&&end>start);
  const trecho=js.slice(start,end);
  assert.doesNotMatch(trecho,/api\(|fetch\(|post\(|bloquear|desbloquear|sendMessage|local\/campanhas/i);
});

test('a previa possui estilos separados dos campos de mensagem e de envio',()=>{
  const css=readFileSync(join(parent,'envio-rapido.css'),'utf8');
  for(const classe of ['quick-experimental-buttons',
    'quick-native-bubble','quick-native-button','quick-experimental-caution']){
    assert.ok(css.includes('.'+classe),classe);
  }
  assert.match(css,/display:block;background/);
});
