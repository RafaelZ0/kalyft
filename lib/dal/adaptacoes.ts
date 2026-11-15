import "server-only";

import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { adaptacoesTreino } from "@/lib/db/schema";
import type { AjusteItem } from "@/lib/treino-adaptado";
import { ehUuid, exigirId } from "./util";

export type AdaptacaoDoDia = { treinoId: string; minutos: number | null; itens: AjusteItem[] };

/** Adaptação do dia (só do próprio usuário), ou null. */
export async function obterAdaptacao(userId: string, data: string): Promise<AdaptacaoDoDia | null> {
  exigirId(userId);
  const [l] = await db
    .select({ treinoId: adaptacoesTreino.treinoId, minutos: adaptacoesTreino.minutos, itens: adaptacoesTreino.itens })
    .from(adaptacoesTreino)
    .where(and(eq(adaptacoesTreino.userId, userId), eq(adaptacoesTreino.data, data)))
    .limit(1);
  return l ?? null;
}

/** Grava (ou substitui) a adaptação do dia. Os itens já chegam conferidos contra o treino real. */
export async function gravarAdaptacao(userId: string, data: string, treinoId: string, minutos: number | null, itens: AjusteItem[]): Promise<void> {
  exigirId(userId);
  if (!ehUuid(treinoId)) throw new Error("Treino inválido.");
  await db
    .insert(adaptacoesTreino)
    .values({ userId, data, treinoId, minutos, itens })
    .onConflictDoUpdate({ target: [adaptacoesTreino.userId, adaptacoesTreino.data], set: { treinoId, minutos, itens, atualizadoEm: new Date() } });
}

/** Volta ao treino completo naquele dia. */
export async function removerAdaptacao(userId: string, data: string): Promise<void> {
  exigirId(userId);
  await db.delete(adaptacoesTreino).where(and(eq(adaptacoesTreino.userId, userId), eq(adaptacoesTreino.data, data)));
}

/** Datas com treino adaptado no período (para a etiqueta no calendário). */
export async function datasAdaptadas(userId: string, de: string, ate: string): Promise<Set<string>> {
  exigirId(userId);
  const l = await db
    .select({ data: adaptacoesTreino.data })
    .from(adaptacoesTreino)
    .where(and(eq(adaptacoesTreino.userId, userId), gte(adaptacoesTreino.data, de), lte(adaptacoesTreino.data, ate)));
  return new Set(l.map((x) => x.data));
}
