import { createHash } from "node:crypto";

/** A faixa curta equivale exatamente a metade da faixa média. */
export type ModoIntervalo = "medio" | "curto";

export interface RegistroEnvio {
  chave: string;
  enviadoEm?: string;
}

export interface IntervaloCalculado {
  ultimoEnvioEm: number;
  proximaLiberacaoEm: number;
  esperaSorteadaMs: number;
  pausaLonga: boolean;
  limitadoPorHora: boolean;
  publicacoesNoDia: number;
}

export function modoIntervaloValido(valor: unknown): valor is ModoIntervalo {
  return valor === "medio" || valor === "curto";
}

export function normalizarModoIntervalo(valor: unknown): ModoIntervalo {
  return modoIntervaloValido(valor) ? valor : "medio";
}

export function intervaloFaixas(modo: ModoIntervalo): {
  normal: [number, number];
  prolongado: [number, number];
} {
  return modo === "curto"
    ? { normal: [5 * 60_000, 12 * 60_000 + 30_000], prolongado: [15 * 60_000, 22 * 60_000 + 30_000] }
    : { normal: [10 * 60_000, 25 * 60_000], prolongado: [30 * 60_000, 45 * 60_000] };
}

/**
 * Intervalo variável, mas reprodutível após reinicializações, baseado na
 * própria oferta confirmada. Só usa envios reais, nunca prévias.
 *
 * A cada quatro publicações do mesmo dia há pausa prolongada. Além disso,
 * respeita no máximo quatro envios em qualquer janela móvel de uma hora.
 */
export function calcularProximaPublicacao(
  registros: RegistroEnvio[],
  modo: ModoIntervalo
): IntervaloCalculado {
  const envios = registros
    .filter((registro) => typeof registro.enviadoEm === "string")
    .map((registro) => ({
      chave: registro.chave,
      enviadoEm: registro.enviadoEm!,
      instante: Date.parse(registro.enviadoEm!)
    }))
    .filter((envio) => Number.isFinite(envio.instante) && envio.instante > 0)
    .sort((a, b) => b.instante - a.instante);

  if (envios.length === 0) {
    return {
      ultimoEnvioEm: 0,
      proximaLiberacaoEm: 0,
      esperaSorteadaMs: 0,
      pausaLonga: false,
      limitadoPorHora: false,
      publicacoesNoDia: 0
    };
  }

  const ultimo = envios[0];
  const diaUltimo = new Date(ultimo.instante).toDateString();
  const publicacoesNoDia = envios.filter(
    (envio) => new Date(envio.instante).toDateString() === diaUltimo
  ).length;
  const pausaLonga = publicacoesNoDia > 0 && publicacoesNoDia % 4 === 0;

  // A mesma oferta recebe a mesma espera após reabrir o painel. O modo
  // curto usa exatamente 50% da duração média que seria sorteada.
  const hash = createHash("sha256")
    .update(ultimo.chave + "|" + ultimo.enviadoEm)
    .digest()
    .readUInt32BE(0);
  const segundosMedio = (pausaLonga ? 30 : 10) * 60 + hash % (15 * 60 + 1);
  const esperaSorteadaMs = segundosMedio * (modo === "curto" ? 500 : 1_000);
  const proximaPeloIntervalo = ultimo.instante + esperaSorteadaMs;

  const ultimaHora = envios.filter(
    (envio) => envio.instante > ultimo.instante - 60 * 60_000
  );
  const proximaPeloLimite = ultimaHora.length >= 4
    ? ultimaHora[3].instante + 60 * 60_000 + 1_000
    : 0;

  return {
    ultimoEnvioEm: ultimo.instante,
    proximaLiberacaoEm: Math.max(proximaPeloIntervalo, proximaPeloLimite),
    esperaSorteadaMs,
    pausaLonga,
    limitadoPorHora: proximaPeloLimite > proximaPeloIntervalo,
    publicacoesNoDia
  };
}
