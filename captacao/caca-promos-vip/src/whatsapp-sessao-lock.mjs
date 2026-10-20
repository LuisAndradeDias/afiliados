import {
  mkdirSync, openSync, closeSync, writeFileSync, readFileSync, unlinkSync,
} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

// Trava exclusiva entre os painéis 3040/3045 no mesmo ACER.
// Não é usada em testes de Chrome simulado.
export function adquirirSessaoWhatsapp(projeto) {
  const arquivo=join(resolve(projeto),'data','whatsapp-convite.lock');
  mkdirSync(dirname(arquivo),{recursive:true});
  const dono={pid:process.pid,id:randomUUID(),criadoEm:new Date().toISOString()};
  for(let tentativa=0;tentativa<2;tentativa++){
    let fd;
    try{
      fd=openSync(arquivo,'wx',0o600);
      writeFileSync(fd,JSON.stringify(dono),'utf8');
      closeSync(fd);
      fd=undefined;
      return ()=>{
        try{
          const atual=JSON.parse(readFileSync(arquivo,'utf8'));
          if(atual.id===dono.id && atual.pid===dono.pid)unlinkSync(arquivo);
        }catch{/* nunca remover trava de outro processo */}
      };
    }catch(erro){
      if(fd!==undefined){try{closeSync(fd);}catch{}}
      if(erro.code!=='EEXIST')throw erro;
      let anterior;
      try{anterior=JSON.parse(readFileSync(arquivo,'utf8'));}
      catch{throw new Error('WhatsApp ocupado: trava de sessão não legível. Verifique o Chrome.');}
      if(!Number.isInteger(anterior.pid) || anterior.pid<1) {
        throw new Error('WhatsApp ocupado: trava inválida. Verifique a sessão.');
      }
      try{
        process.kill(anterior.pid,0);
        throw new Error('WhatsApp já está em uso por outra instância de campanhas.');
      }catch(falha){
        if(falha.code!=='ESRCH')throw falha;
      }
      // Apenas após comprovar que o PID da instância antiga morreu.
      // Uma tentativa de recriação, sempre em modo fail-closed.
      try{unlinkSync(arquivo);}catch{
        throw new Error('A sessão do WhatsApp está bloqueada. Confira o Chrome.');
      }
    }
  }
  throw new Error('Não foi possível reservar a sessão do WhatsApp.');
}
