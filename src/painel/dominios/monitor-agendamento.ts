/**
 * Agendamento de turnos Amazon/Mercado Livre.
 * Calcula atrasos sem executar operações; o temporizador garante que
 * callbacks obsoletas não disparem após pausa ou reagendamento.
 */
export function calcularAtrasoMonitor({
  agoraEm,
  atrasoSolicitadoMs,
  proximaLiberacaoEm
}: {
  agoraEm: number;
  atrasoSolicitadoMs: number;
  proximaLiberacaoEm: number;
}): {
  esperaRestanteMs: number;
  atrasoMs: number;
  proximaBuscaEm: number;
} {
  const esperaRestanteMs = Math.max(0, proximaLiberacaoEm - agoraEm);
  const atrasoMs = Math.max(500, atrasoSolicitadoMs, esperaRestanteMs);
  return { esperaRestanteMs, atrasoMs, proximaBuscaEm: agoraEm + atrasoMs };
}

export function criarTemporizadorExclusivo<T>({
  agendar,
  cancelar
}: {
  agendar: (callback: () => void, atrasoMs: number) => T;
  cancelar: (identificador: T) => void;
}): {
  armar(callback: () => void, atrasoMs: number): void;
  desarmar(): void;
  temPendente(): boolean;
} {
  let geracao = 0;
  let identificador: T | null = null;

  function desarmar(): void {
    geracao += 1;
    if (identificador !== null) {
      cancelar(identificador);
      identificador = null;
    }
  }

  function armar(callback: () => void, atrasoMs: number): void {
    desarmar();
    const turno = geracao;
    identificador = agendar(() => {
      if (turno !== geracao || identificador === null) return;
      // Invalida entregas duplicadas antes de executar o callback.
      identificador = null;
      geracao += 1;
      callback();
    }, atrasoMs);
  }

  return { armar, desarmar, temPendente: () => identificador !== null };
}
