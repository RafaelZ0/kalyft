import "server-only";

import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { acessos, type Acesso } from "@/lib/db/schema";
import { exigirId } from "./util";

/** Prova de que a sessão atual é de administrador. Só é criada em lib/auth/sessao.ts. */
export type Administrador = { readonly userId: string; readonly __admin: true };

export type StatusAcesso = "pendente" | "aprovado" | "recusado";

/**
 * Registra o usuário no primeiro acesso. Desde a Fase 12A o cadastro é aberto: toda conta nova entra como
 * "aprovado" (e uma "pendente" antiga passa a "aprovado"). Conta "recusado" continua bloqueada; só o
 * administrador é reaprovado automaticamente.
 */
export async function registrarAcesso(
  userId: string,
  email: string,
  administrador: boolean,
): Promise<Acesso> {
  exigirId(userId);
  const valores = {
    userId,
    email: email.toLowerCase().slice(0, 320),
    status: "aprovado",
    decididoEm: sql`now()`,
  };
  const [linha] = await db
    .insert(acessos)
    .values(valores)
    .onConflictDoUpdate({
      target: acessos.userId,
      set: { status: "aprovado", decididoEm: sql`now()` },
      setWhere: administrador ? undefined : eq(acessos.status, "pendente"),
    })
    .returning();
  if (linha) return linha;

  const [existente] = await db.select().from(acessos).where(eq(acessos.userId, userId)).limit(1);
  return existente;
}

/** Marco a partir do qual as sessões do usuário valem (null = todas valem). */
export async function sessoesValidasDesde(userId: string): Promise<Date | null> {
  exigirId(userId);
  const [linha] = await db
    .select({ desde: acessos.sessoesValidasDesde })
    .from(acessos)
    .where(eq(acessos.userId, userId))
    .limit(1);
  return linha?.desde ?? null;
}

/**
 * Após a troca de senha (usuário ainda não logado, só temos o e-mail):
 * toda sessão criada antes de agora passa a ser recusada pelo app.
 */
export async function encerrarSessoesPorEmail(email: string): Promise<number> {
  const linhas = await db
    .update(acessos)
    .set({ sessoesValidasDesde: sql`now()` })
    .where(eq(acessos.email, email.toLowerCase()))
    .returning({ userId: acessos.userId });
  return linhas.length;
}

/** Bloqueia ("recusado") ou libera ("aprovado") outro usuário. O administrador não altera o próprio acesso. */
export async function decidirAcesso(
  admin: Administrador,
  alvoUserId: string,
  status: Exclude<StatusAcesso, "pendente">,
): Promise<boolean> {
  exigirId(admin.userId);
  exigirId(alvoUserId);
  const linhas = await db
    .update(acessos)
    .set({ status, decididoEm: sql`now()` })
    .where(and(eq(acessos.userId, alvoUserId), ne(acessos.userId, admin.userId)))
    .returning({ userId: acessos.userId });
  return linhas.length === 1;
}
