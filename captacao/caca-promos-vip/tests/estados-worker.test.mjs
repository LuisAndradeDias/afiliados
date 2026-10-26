import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classificarFalhaWorker,
  faseOcupadaWhatsapp,
  podeCancelarWhatsapp
} from '../src/estados/whatsapp-worker.mjs';

test('perda do Chrome após preparo ou tentativa é sempre incerta, não sucesso', () => {
  assert.equal(classificarFalhaWorker({tentouEnviar:false,jaPreparou:false}), 'erro');
  assert.equal(classificarFalhaWorker({tentouEnviar:false,jaPreparou:true}), 'incerto');
  assert.equal(classificarFalhaWorker({tentouEnviar:true,jaPreparou:false}), 'incerto');
  assert.equal(classificarFalhaWorker({tentouEnviar:true,jaPreparou:true}), 'incerto');
});

test('controlador informa ocupação enquanto processo não concluiu, sem confundir envio confirmado', () => {
  for (const fase of ['inativo','iniciando','abrindo','pronto','enviando','cancelando']) {
    assert.equal(faseOcupadaWhatsapp(fase,true),
      !['inativo'].includes(fase) || fase === 'inativo',
      fase + ' deve seguir ocupado quando o processo existe (compatibilidade legado)');
  }
  for (const fase of ['confirmado','cancelado','erro','incerto']) {
    assert.equal(faseOcupadaWhatsapp(fase,true),false,fase);
  }
  for (const fase of ['iniciando','pronto','enviando','incerto']) {
    assert.equal(faseOcupadaWhatsapp(fase,false),false,fase);
  }
});

test('cancelamento somente antes do clique, nunca em envio ou dúvida', () => {
  for (const fase of ['iniciando','abrindo','pronto']) {
    assert.equal(podeCancelarWhatsapp(fase),true,fase);
  }
  for (const fase of ['inativo','cancelando','enviando','confirmado','incerto','erro','cancelado']) {
    assert.equal(podeCancelarWhatsapp(fase),false,fase);
  }
});
