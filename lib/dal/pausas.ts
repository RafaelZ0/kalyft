import "server-only";

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { pausas } from "@/lib/db/schema";
import { exigirId } from "./util";

/** Data da última atividade (refeição, pesagem ou treino feito) até hoje, ou null se nunca houve. */
export async function ultimaAtividade(userId: string, hoje: string): Promise<string | null> {
  exigirId(userId);
  const r = await db.execute<{ ultima: string | null }>(sql`
    select max(d)::text as ultima from (
      select max(data) as d from registros_alimentares where user_id = ${userId} and data <= ${hoje}
      union all select max(data) from pesagens where user_id = ${userId} and data <= ${hoje}
      union all select max(data) from sessoes_treino where user_id = ${userId} and status = 'feito' and data <= ${hoje}
    ) t
  `);
  return r.rows[0]?.ultima ?? null;
}

/** Marca um período como pausa. Marcar de novo a mesma pausa (mesmo início) não duplica, só ajusta o fim. */
export async function marcarPausa(userId: string, inicio: string, fim: string): Promise<void> {
  exigirId(userId);
  await db
    .insert(pausas)
    .values({ userId, inicio, fim })
    .onConflictDoUpdate({ target: [pausas.userId, pausas.inicio], set: { fim } });
}

/** Pausas que tocam o período (para o calendário). */
export async function pausasNoPeriodo(userId: string, de: string, ate: string): Promise<Array<{ inicio: string; fim: string }>> {
  exigirId(userId);
  return db
    .select({ inicio: pausas.inicio, fim: pausas.fim })
    .from(pausas)
    .where(and(eq(pausas.userId, userId), lte(pausas.inicio, ate), gte(pausas.fim, de)))
    .orderBy(desc(pausas.inicio));
}
