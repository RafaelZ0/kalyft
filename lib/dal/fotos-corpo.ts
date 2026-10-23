import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { fotosCorpo } from "@/lib/db/schema";
import { LIMITES_FOTO_CORPO, type Posicao } from "@/lib/foto-corpo";
import { ehUuid, exigirId } from "./util";

export type FotoCorpoResumo = { id: string; data: string; posicao: Posicao; nota: string | null; tamanho: number };

/** Lista as fotos do usuário (sem os bytes), da mais recente para a mais antiga. */
export async function listarFotosCorpo(userId: string): Promise<FotoCorpoResumo[]> {
  exigirId(userId);
  const linhas = await db
    .select({ id: fotosCorpo.id, data: fotosCorpo.data, posicao: fotosCorpo.posicao, nota: fotosCorpo.nota, tamanho: fotosCorpo.tamanho })
    .from(fotosCorpo)
    .where(eq(fotosCorpo.userId, userId))
    .orderBy(desc(fotosCorpo.data), desc(fotosCorpo.criadoEm));
  return linhas as FotoCorpoResumo[];
}

/** Bytes da foto, só se for do usuário. Qualquer outro caso (id inválido, de outra pessoa) devolve null. */
export async function obterBytesFotoCorpo(userId: string, id: string): Promise<Uint8Array | null> {
  exigirId(userId);
  if (!ehUuid(id)) return null;
  const [linha] = await db
    .select({ bytes: fotosCorpo.bytes })
    .from(fotosCorpo)
    .where(and(eq(fotosCorpo.id, id), eq(fotosCorpo.userId, userId)))
    .limit(1);
  return linha?.bytes ?? null;
}

/** Filtra os ids que são do usuário (usado na comparação lado a lado). */
export async function fotosDoUsuario(userId: string, ids: string[]): Promise<FotoCorpoResumo[]> {
  exigirId(userId);
  const validos = [...new Set(ids.filter(ehUuid))].slice(0, 2);
  if (validos.length === 0) return [];
  const todas = await listarFotosCorpo(userId);
  return validos.map((id) => todas.find((f) => f.id === id)).filter((f): f is FotoCorpoResumo => f !== undefined);
}

export type NovaFotoCorpo = { data: string; posicao: Posicao; nota: string | null; bytes: Uint8Array };

/**
 * Grava a foto respeitando o limite por pessoa. A contagem e a inserção ficam na mesma transação, com um
 * trava por usuário (advisory lock), então dois envios ao mesmo tempo não passam do limite.
 * Devolve o id, ou null se o limite já foi atingido.
 */
export async function inserirFotoCorpo(userId: string, f: NovaFotoCorpo): Promise<string | null> {
  exigirId(userId);
  const hex = "\\x" + Buffer.from(f.bytes).toString("hex");
  const [, inserida] = await db.batch([
    db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"fotos_corpo:" + userId}, 0))`),
    db.execute<{ id: string }>(sql`
      insert into fotos_corpo (user_id, data, posicao, nota, bytes, tamanho)
      select ${userId}::uuid, ${f.data}::date, ${f.posicao}, ${f.nota}, ${hex}::bytea, ${f.bytes.length}
      where (select count(*) from fotos_corpo where user_id = ${userId}::uuid) < ${LIMITES_FOTO_CORPO.maximo}
      returning id
    `),
  ]);
  return inserida.rows[0]?.id ?? null;
}

/** Apaga só a foto do próprio usuário. Devolve se alguma linha foi apagada. */
export async function excluirFotoCorpo(userId: string, id: string): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(id)) return false;
  const apagadas = await db.delete(fotosCorpo).where(and(eq(fotosCorpo.id, id), eq(fotosCorpo.userId, userId))).returning({ id: fotosCorpo.id });
  return apagadas.length > 0;
}

export async function contarFotosCorpo(userId: string): Promise<number> {
  exigirId(userId);
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(fotosCorpo).where(eq(fotosCorpo.userId, userId));
  return r?.n ?? 0;
}
