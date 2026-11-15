import "server-only";

import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { inscricoesPush, lembretes, lembretesEnvios } from "@/lib/db/schema";
import type { Envio, FeitoNoDia, Lembrete, TipoLembrete } from "@/lib/lembretes";
import { REFEICOES, type Refeicao } from "@/lib/validacao/comida";
import { ehUuid, exigirId } from "./util";

// CONSULTAS DE SISTEMA (várias contas). Uso exclusivo da rota do agendador (/api/lembretes/enviar), que só roda
// com o segredo CRON_SECRET. Nenhuma tela ou Server Action importa este arquivo. Só lê o mínimo para decidir e
// enviar (nada de dados de saúde sai daqui além de "já fez ou não").

/** Lembretes ativos de contas aprovadas que têm pelo menos um aparelho inscrito. */
export async function lembretesCandidatos(): Promise<Lembrete[]> {
  const r = await db.execute<{
    id: string;
    user_id: string;
    tipo: string;
    refeicao: string | null;
    minuto: number;
    dias: number;
    silenciar_feito: boolean;
    pausado_ate: string | null;
    adiado_para: string | null;
  }>(sql`
    select l.id, l.user_id, l.tipo, l.refeicao, l.minuto, l.dias, l.silenciar_feito, l.pausado_ate::text, l.adiado_para
    from lembretes l
    join acessos a on a.user_id = l.user_id and a.status = 'aprovado'
    where l.ativo and exists (select 1 from inscricoes_push i where i.user_id = l.user_id)
    limit 5000
  `);
  return r.rows.map((x) => ({
    id: x.id,
    userId: x.user_id,
    tipo: x.tipo as TipoLembrete,
    refeicao: (x.refeicao as Refeicao | null) ?? null,
    minuto: Number(x.minuto),
    dias: Number(x.dias),
    ativo: true,
    silenciarFeito: x.silenciar_feito,
    pausadoAte: x.pausado_ate,
    adiadoPara: x.adiado_para ? new Date(x.adiado_para) : null,
  }));
}

/** Pausas marcadas (9A) que tocam o período, por pessoa. */
export async function pausasDasPessoas(userIds: string[], de: string, ate: string): Promise<Map<string, Array<{ inicio: string; fim: string }>>> {
  const ids = userIds.filter(ehUuid);
  const mapa = new Map<string, Array<{ inicio: string; fim: string }>>();
  if (ids.length === 0) return mapa;
  const r = await db.execute<{ user_id: string; inicio: string; fim: string }>(sql`
    select user_id, inicio::text, fim::text from pausas
    where user_id in (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)}) and fim >= ${de} and inicio <= ${ate}
  `);
  for (const p of r.rows) mapa.set(p.user_id, [...(mapa.get(p.user_id) ?? []), { inicio: p.inicio, fim: p.fim }]);
  return mapa;
}

/** O que a pessoa já fez no dia (refeições registradas, pesagem, treino, água × meta). */
export async function feitoNoDia(userId: string, data: string): Promise<FeitoNoDia> {
  exigirId(userId);
  const r = await db.execute<{ refeicoes: string[] | null; pesou: boolean; treinou: boolean; agua: number | null; meta: number | null }>(sql`
    select
      (select array_agg(distinct refeicao) from registros_alimentares where user_id = ${userId} and data = ${data}) as refeicoes,
      exists (select 1 from pesagens where user_id = ${userId} and data = ${data}) as pesou,
      exists (select 1 from sessoes_treino where user_id = ${userId} and data = ${data}) as treinou,
      (select coalesce(sum(ml), 0)::int from agua where user_id = ${userId} and data = ${data}) as agua,
      (select agua_ml from metas where user_id = ${userId} and vigente_desde <= ${data} order by vigente_desde desc limit 1) as meta
  `);
  const x = r.rows[0];
  const refeicoes = new Set((x?.refeicoes ?? []).filter((v): v is Refeicao => (REFEICOES as readonly string[]).includes(v)));
  const meta = x?.meta == null ? null : Number(x.meta);
  return {
    refeicoes,
    pesou: Boolean(x?.pesou),
    treinou: Boolean(x?.treinou),
    aguaNaMeta: meta !== null && meta > 0 && Number(x?.agua ?? 0) >= meta,
  };
}

/** Reserva o envio antes de enviar. false = já reservado (outra execução ou já enviado). */
export async function reservarEnvio(e: Envio): Promise<boolean> {
  exigirId(e.userId);
  const r = await db
    .insert(lembretesEnvios)
    .values({ lembreteId: e.lembreteId, userId: e.userId, data: e.data, minuto: e.minuto, adiado: e.adiado })
    .onConflictDoNothing()
    .returning({ id: lembretesEnvios.lembreteId });
  return r.length > 0;
}

/** Depois de enviar um adiado, limpa o adiamento (só se ainda for o mesmo instante). */
export async function limparAdiamento(userId: string, lembreteId: string, adiadoPara: Date): Promise<void> {
  exigirId(userId);
  await db
    .update(lembretes)
    .set({ adiadoPara: null })
    .where(and(eq(lembretes.id, lembreteId), eq(lembretes.userId, userId), eq(lembretes.adiadoPara, adiadoPara)));
}

export type InscricaoEnvio = { id: string; userId: string; endpoint: string; p256dh: string; auth: string };

export async function inscricoesDasPessoas(userIds: string[]): Promise<InscricaoEnvio[]> {
  const ids = userIds.filter(ehUuid);
  if (ids.length === 0) return [];
  return db
    .select({ id: inscricoesPush.id, userId: inscricoesPush.userId, endpoint: inscricoesPush.endpoint, p256dh: inscricoesPush.p256dh, auth: inscricoesPush.auth })
    .from(inscricoesPush)
    .where(inArray(inscricoesPush.userId, ids));
}

/** Inscrição que o serviço de push disse não existir mais (404/410). */
export async function apagarInscricaoExpirada(id: string): Promise<void> {
  if (!ehUuid(id)) return;
  await db.delete(inscricoesPush).where(eq(inscricoesPush.id, id));
}

/** Apaga reservas de envio antigas (só servem para impedir duplicatas). */
export async function limparEnviosAntigos(antes: Date): Promise<void> {
  await db.delete(lembretesEnvios).where(lt(lembretesEnvios.enviadoEm, antes));
}
