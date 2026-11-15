// "Retomar de hoje": percebe uma pausa (dias sem nenhuma atividade) e oferece recomeçar sem cobrança.
// Função pura: recebe as datas com atividade (refeição, pesagem, treino feito) e decide.
import { somarDias } from "@/lib/datas";

/** Dias seguidos sem atividade para considerar uma pausa. */
export const PAUSA_MIN_DIAS = 3;
/** Uma pausa marcada cobre no máximo este período (evita marcar meses por engano). */
export const PAUSA_MAX_DIAS = 90;

export type Pausa = { inicio: string; fim: string; dias: number };

const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);

/**
 * Detecta a pausa atual: houve atividade antes, nenhuma hoje e a última foi há PAUSA_MIN_DIAS dias ou mais.
 * A pausa vai do dia seguinte à última atividade até ontem. Sem histórico (conta nova), não há pausa.
 */
export function detectarPausa(datasAtividade: ReadonlyArray<string>, hoje: string): Pausa | null {
  const passadas = datasAtividade.filter((d) => d <= hoje);
  if (passadas.length === 0) return null;
  const ultima = passadas.reduce((a, b) => (a > b ? a : b));
  if (ultima === hoje) return null;
  const semAtividade = diasEntre(ultima, hoje) - 1; // dias inteiros entre a última atividade e hoje
  if (semAtividade < PAUSA_MIN_DIAS) return null;
  const inicio = somarDias(ultima, 1);
  const fim = somarDias(hoje, -1);
  return { inicio, fim, dias: semAtividade };
}

/** Limita uma pausa ao máximo permitido, mantendo os dias mais recentes. */
export function limitarPausa(p: Pausa): Pausa {
  if (p.dias <= PAUSA_MAX_DIAS) return p;
  return { inicio: somarDias(p.fim, -(PAUSA_MAX_DIAS - 1)), fim: p.fim, dias: PAUSA_MAX_DIAS };
}

/** Data dentro de alguma das pausas marcadas. */
export function emPausa(data: string, pausas: ReadonlyArray<{ inicio: string; fim: string }>): boolean {
  return pausas.some((p) => data >= p.inicio && data <= p.fim);
}
