import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {adquirirSessaoWhatsapp} from '../src/whatsapp-sessao-lock.mjs';

test('lock impede dois painéis usarem a mesma sessão Chrome simultaneamente',t=>{
  const dir=mkdtempSync(join(tmpdir(),'cpv-perfil-lock-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const caminho=join(dir,'data','whatsapp-convite.lock');
  const liberarA=adquirirSessaoWhatsapp(dir);
  assert.equal(existsSync(caminho),true);
  assert.throws(()=>adquirirSessaoWhatsapp(dir),/já está em uso/);
  liberarA();
  assert.equal(existsSync(caminho),false);
  const liberarB=adquirirSessaoWhatsapp(dir);
  assert.equal(existsSync(caminho),true);
  liberarB();
  assert.equal(existsSync(caminho),false);
});
