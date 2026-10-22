import { join } from 'node:path';

// A reconnect changes the device suffix but does not change the phone owner.
export function numeroDaConta(jid) {
  const match = /^([1-9][0-9]{9,14})(?::[0-9]{1,3})?@s\.whatsapp\.net$/.exec(String(jid || ''));
  return match?.[1] ?? null;
}

export function instanciaAutorizada(instances, name, expectedJid) {
  if (!Array.isArray(instances) || !name || typeof name !== 'string') return false;
  const number = numeroDaConta(expectedJid);
  if (!number) return false;
  const found = instances.filter(i => i?.name === name);
  if (found.length !== 1) return false;
  return found[0].connected === true && numeroDaConta(found[0].jid) === number;
}

// The local Central running on 3045 uses dados/previa-acer for its private
// data. Never fall back to dados/ because a missing secret must fail closed.
export function segredoPonteCentral(laboratoryRoot) {
  return join(laboratoryRoot, '..', 'dados', 'previa-acer', 'whatygo-ponte-chave.txt');
}
