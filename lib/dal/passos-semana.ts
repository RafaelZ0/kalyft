import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { passosSemana } from "@/lib/db/schema";
import type { DadosDaSemana, Passo, TipoPasso } from "@/lib/proximo-passo";
import { REFEICOES, type Refeicao } from "@/lib/validacao/comida";
import { metaVigente } from "./metas";
import { exigirId } from "./util";

/** Passo escolhido para a semana (segunda-feira), ou null. */
export async function obterPassoSemana(userId: string, inicio: string): Promise<Passo | null> {
  exigirId(userId);
  const [l] = await db
    .select({ tipo: passosSemana.tipo, alvo: passosSemana.alvo, refeicao: passosSemana.refeicao, texto: passosSemana.texto })
    .from(passosSemana)
    .where(and(eq(passosSemana.userId, userId), eq(passosSemana.inicio, inicio)))
    .limit(1);
  return l ? { tipo: l.tipo as TipoPasso, alvo: l.alvo, refeicao: l.refeicao as Refeicao | null, texto: l.texto } : null;
}

/** Grava (ou troca) o passo da semana. A coerência (tipo, alvo, texto) também é garantida por CHECK no banco. */
export async function gravarPassoSemana(userId: string, inicio: string, p: Passo): Promise<void> {
  exigirId(userId);
  const valores = { tipo: p.tipo, alvo: p.alvo, refeicao: p.refeicao, texto: p.texto };
  await db
    .insert(passosSemana)
    .values({ userId, inicio, ...valores })
    .onConflictDoUpdate({ target: [passosSemana.userId, passosSemana.inicio], set: { ...valores, criadoEm: new Date() } });
}

/** Remove o passo da semana. */
export async function removerPassoSemana(userId: string, inicio: string): Promise<void> {
  exigirId(userId);
  await db.delete(passosSemana).where(and(eq(passosSemana.userId, userId), eq(passosSemana.inicio, inicio)));
}

/**
 * Contagens da semana para medir o passo, de `inicio` até `ate` (inclusive), sempre do próprio usuário.
 * Proteína e água só contam quando há meta vigente; sem meta, ficam null.
 */
export async function dadosDaSemana(userId: string, inicio: string, ate: string): Promise<DadosDaSemana> {
  exigirId(userId);
  const meta = await metaVigente(userId, ate);
  const r = await db.execute<{
    dias: number;
    por_refeicao: Record<string, number> | null;
    pesagens: number;
    treinos: number;
    dias_proteina: number;
    dias_agua: number;
  }>(sql`
    select
      (select count(distinct data)::int from registros_alimentares where user_id = ${userId} and data between ${inicio} and ${ate}) as dias,
      (select jsonb_object_agg(refeicao, n) from (
        select refeicao, count(distinct data)::int as n from registros_alimentares
        where user_id = ${userId} and data between ${inicio} and ${ate} group by refeicao) x) as por_refeicao,
      (select count(*)::int from pesagens where user_id = ${userId} and data between ${inicio} and ${ate}) as pesagens,
      (select count(*)::int from sessoes_treino where user_id = ${userId} and status = 'feito' and data between ${inicio} and ${ate}) as treinos,
      (select count(*)::int from (
        select data from registros_alimentares where user_id = ${userId} and data between ${inicio} and ${ate}
        group by data having coalesce(sum(proteina_g), 0) >= ${meta?.proteinaG ?? 0}) p) as dias_proteina,
      (select count(*)::int from (
        select data from agua where user_id = ${userId} and data between ${inicio} and ${ate}
        group by data having sum(ml) >= ${meta?.aguaMl ?? 0}) a) as dias_agua
  `);
  const l = r.rows[0];
  const porRefeicao: Partial<Record<Refeicao, number>> = {};
  for (const ref of REFEICOES) if (l?.por_refeicao?.[ref]) porRefeicao[ref] = Number(l.por_refeicao[ref]);
  return {
    diasComRegistro: Number(l?.dias ?? 0),
    diasPorRefeicao: porRefeicao,
    pesagens: Number(l?.pesagens ?? 0),
    treinosFeitos: Number(l?.treinos ?? 0),
    diasProteinaNaMeta: meta?.proteinaG ? Number(l?.dias_proteina ?? 0) : null,
    diasAguaNaMeta: meta?.aguaMl ? Number(l?.dias_agua ?? 0) : null,
  };
}
