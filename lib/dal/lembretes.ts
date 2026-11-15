import "server-only";

import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { inscricoesPush, lembretes } from "@/lib/db/schema";
import { endpointPushValido, LIMITES_LEMBRETE, type Lembrete, type TipoLembrete } from "@/lib/lembretes";
import type { Refeicao } from "@/lib/validacao/comida";
import { exigirId } from "./util";

// Lembretes e inscrições de push da própria conta. Toda função recebe o user_id da sessão e filtra por ele.

export type DadosLembrete = {
  tipo: TipoLembrete;
  refeicao: Refeicao | null;
  minuto: number;
  dias: number;
  silenciarFeito: boolean;
  ativo: boolean;
};

function paraLembrete(r: typeof lembretes.$inferSelect): Lembrete {
  return {
    id: r.id,
    userId: r.userId,
    tipo: r.tipo as TipoLembrete,
    refeicao: (r.refeicao as Refeicao | null) ?? null,
    minuto: r.minuto,
    dias: r.dias,
    ativo: r.ativo,
    silenciarFeito: r.silenciarFeito,
    pausadoAte: r.pausadoAte,
    adiadoPara: r.adiadoPara,
  };
}

export async function listarLembretes(userId: string): Promise<Lembrete[]> {
  exigirId(userId);
  const rows = await db.select().from(lembretes).where(eq(lembretes.userId, userId)).orderBy(asc(lembretes.minuto), asc(lembretes.criadoEm));
  return rows.map(paraLembrete);
}

export async function obterLembrete(userId: string, id: string): Promise<Lembrete | null> {
  exigirId(userId);
  const [r] = await db.select().from(lembretes).where(and(eq(lembretes.id, id), eq(lembretes.userId, userId))).limit(1);
  return r ? paraLembrete(r) : null;
}

export type ResultadoGravar = "ok" | "limite" | "repetido" | "nao_encontrado";

const ehRepetido = (e: unknown) => {
  const c = e as { code?: string; cause?: { code?: string } };
  return c?.code === "23505" || c?.cause?.code === "23505";
};

/** Cria um lembrete. O limite por pessoa é conferido na própria inserção (sem corrida entre duas abas). */
export async function criarLembrete(userId: string, d: DadosLembrete): Promise<ResultadoGravar> {
  exigirId(userId);
  try {
    const r = await db.execute(sql`
      insert into lembretes (user_id, tipo, refeicao, minuto, dias, silenciar_feito, ativo)
      select ${userId}, ${d.tipo}, ${d.refeicao}, ${d.minuto}, ${d.dias}, ${d.silenciarFeito}, ${d.ativo}
      where (select count(*) from lembretes where user_id = ${userId}) < ${LIMITES_LEMBRETE.porPessoa}
      returning id
    `);
    return r.rows.length > 0 ? "ok" : "limite";
  } catch (e) {
    if (ehRepetido(e)) return "repetido";
    throw e;
  }
}

export async function atualizarLembrete(userId: string, id: string, d: DadosLembrete): Promise<ResultadoGravar> {
  exigirId(userId);
  try {
    const r = await db
      .update(lembretes)
      .set({ tipo: d.tipo, refeicao: d.refeicao, minuto: d.minuto, dias: d.dias, silenciarFeito: d.silenciarFeito, ativo: d.ativo, adiadoPara: null })
      .where(and(eq(lembretes.id, id), eq(lembretes.userId, userId)))
      .returning({ id: lembretes.id });
    return r.length > 0 ? "ok" : "nao_encontrado";
  } catch (e) {
    if (ehRepetido(e)) return "repetido";
    throw e;
  }
}

export async function apagarLembrete(userId: string, id: string): Promise<boolean> {
  exigirId(userId);
  const r = await db.delete(lembretes).where(and(eq(lembretes.id, id), eq(lembretes.userId, userId))).returning({ id: lembretes.id });
  return r.length > 0;
}

/** "Lembrar de novo em 30 min". */
export async function adiarLembrete(userId: string, id: string, para: Date): Promise<boolean> {
  exigirId(userId);
  const r = await db.update(lembretes).set({ adiadoPara: para }).where(and(eq(lembretes.id, id), eq(lembretes.userId, userId))).returning({ id: lembretes.id });
  return r.length > 0;
}

/** "Hoje não": pausa só este lembrete até a data (inclusive) e cancela um adiamento pendente. */
export async function pausarLembrete(userId: string, id: string, ate: string): Promise<boolean> {
  exigirId(userId);
  const r = await db
    .update(lembretes)
    .set({ pausadoAte: sql`greatest(coalesce(${lembretes.pausadoAte}, ${ate}::date), ${ate}::date)`, adiadoPara: null })
    .where(and(eq(lembretes.id, id), eq(lembretes.userId, userId)))
    .returning({ id: lembretes.id });
  return r.length > 0;
}

/** Pausar todos até a data (inclusive), ou retomar todos (null). */
export async function pausarTodos(userId: string, ate: string | null): Promise<void> {
  exigirId(userId);
  await db.update(lembretes).set({ pausadoAte: ate, adiadoPara: null }).where(eq(lembretes.userId, userId));
}

// ───────────── inscrições de push (aparelhos) ─────────────

export type DadosInscricao = { endpoint: string; p256dh: string; auth: string };

/**
 * Grava a inscrição deste aparelho. O endpoint é único: se o aparelho estava em outra conta, passa para esta
 * (quem tem o endpoint é o próprio navegador). Limite de aparelhos por pessoa conferido na inserção.
 */
export async function salvarInscricao(userId: string, d: DadosInscricao): Promise<"ok" | "limite" | "invalida"> {
  exigirId(userId);
  if (!endpointPushValido(d.endpoint)) return "invalida";
  const r = await db.execute(sql`
    insert into inscricoes_push (user_id, endpoint, p256dh, auth)
    select ${userId}, ${d.endpoint}, ${d.p256dh}, ${d.auth}
    where (select count(*) from inscricoes_push where user_id = ${userId} and endpoint <> ${d.endpoint}) < ${LIMITES_LEMBRETE.inscricoesPorPessoa}
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, criado_em = now()
    returning id
  `);
  return r.rows.length > 0 ? "ok" : "limite";
}

/** Remove a inscrição deste aparelho (só se for desta conta). */
export async function removerInscricao(userId: string, endpoint: string): Promise<boolean> {
  exigirId(userId);
  const r = await db
    .delete(inscricoesPush)
    .where(and(eq(inscricoesPush.userId, userId), eq(inscricoesPush.endpoint, endpoint)))
    .returning({ id: inscricoesPush.id });
  return r.length > 0;
}

export async function contarInscricoes(userId: string): Promise<number> {
  exigirId(userId);
  const [r] = await db.select({ n: count() }).from(inscricoesPush).where(eq(inscricoesPush.userId, userId));
  return r?.n ?? 0;
}

/** Inscrições da própria conta, para o "Enviar teste". */
export async function inscricoesDoUsuario(userId: string): Promise<Array<{ id: string } & DadosInscricao>> {
  exigirId(userId);
  return db
    .select({ id: inscricoesPush.id, endpoint: inscricoesPush.endpoint, p256dh: inscricoesPush.p256dh, auth: inscricoesPush.auth })
    .from(inscricoesPush)
    .where(eq(inscricoesPush.userId, userId));
}

/** Este aparelho (endpoint) está inscrito nesta conta? */
export async function inscricaoExiste(userId: string, endpoint: string): Promise<boolean> {
  exigirId(userId);
  const [r] = await db
    .select({ id: inscricoesPush.id })
    .from(inscricoesPush)
    .where(and(eq(inscricoesPush.userId, userId), eq(inscricoesPush.endpoint, endpoint)))
    .limit(1);
  return Boolean(r);
}
