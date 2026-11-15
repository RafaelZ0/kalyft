import "server-only";

import { and, eq, gte, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { alimentosBase, alimentosUsuario, registrosAlimentares, rotinaOcultos } from "@/lib/db/schema";
import { somarDias } from "@/lib/datas";
import { chaveOculto, ROTINA_JANELA_DIAS, type RegistroHistorico, type TipoAlimentoRotina } from "@/lib/rotina";
import type { Refeicao } from "@/lib/validacao/comida";
import { ehUuid, exigirId } from "./util";

/** Registros dos últimos 30 dias (e de hoje) que apontam para um alimento do banco ou do próprio usuário. */
export async function historicoDaRotina(userId: string, hoje: string): Promise<RegistroHistorico[]> {
  exigirId(userId);
  const linhas = await db
    .select({
      data: registrosAlimentares.data,
      refeicao: registrosAlimentares.refeicao,
      baseId: registrosAlimentares.alimentoBaseId,
      usuarioId: registrosAlimentares.alimentoUsuarioId,
      nome: registrosAlimentares.nome,
      gramas: registrosAlimentares.gramas,
    })
    .from(registrosAlimentares)
    .where(
      and(
        eq(registrosAlimentares.userId, userId),
        gte(registrosAlimentares.data, somarDias(hoje, -ROTINA_JANELA_DIAS)),
        sql`${registrosAlimentares.data} <= ${hoje}`,
        or(isNotNull(registrosAlimentares.alimentoBaseId), isNotNull(registrosAlimentares.alimentoUsuarioId)),
      ),
    );
  return linhas.map((l) => ({
    data: l.data,
    refeicao: l.refeicao as Refeicao,
    tipo: (l.baseId ? "base" : "usuario") as TipoAlimentoRotina,
    alimentoId: (l.baseId ?? l.usuarioId) as string,
    nome: l.nome,
    gramas: Number(l.gramas),
  }));
}

/** Chaves dos itens escondidos da rotina (refeição + alimento). */
export async function ocultosDaRotina(userId: string): Promise<Set<string>> {
  exigirId(userId);
  const linhas = await db
    .select({ refeicao: rotinaOcultos.refeicao, baseId: rotinaOcultos.alimentoBaseId, usuarioId: rotinaOcultos.alimentoUsuarioId })
    .from(rotinaOcultos)
    .where(eq(rotinaOcultos.userId, userId));
  return new Set(linhas.map((l) => chaveOculto(l.refeicao as Refeicao, l.baseId ? "base" : "usuario", (l.baseId ?? l.usuarioId) as string)));
}

export type OcultoListado = { id: string; refeicao: Refeicao; nome: string };

/** Itens escondidos, com o nome do alimento, para a tela de reexibir. */
export async function listarOcultos(userId: string): Promise<OcultoListado[]> {
  exigirId(userId);
  const linhas = await db
    .select({ id: rotinaOcultos.id, refeicao: rotinaOcultos.refeicao, nomeBase: alimentosBase.nome, nomeUsuario: alimentosUsuario.nome })
    .from(rotinaOcultos)
    .leftJoin(alimentosBase, eq(alimentosBase.id, rotinaOcultos.alimentoBaseId))
    .leftJoin(alimentosUsuario, and(eq(alimentosUsuario.id, rotinaOcultos.alimentoUsuarioId), eq(alimentosUsuario.userId, rotinaOcultos.userId)))
    .where(eq(rotinaOcultos.userId, userId))
    .orderBy(rotinaOcultos.refeicao, rotinaOcultos.criadoEm);
  return linhas.map((l) => ({ id: l.id, refeicao: l.refeicao as Refeicao, nome: l.nomeBase ?? l.nomeUsuario ?? "Alimento" }));
}

/** Esconde um alimento da rotina de uma refeição. Repetir não duplica. */
export async function ocultarDaRotina(userId: string, refeicao: Refeicao, tipo: TipoAlimentoRotina, alimentoId: string): Promise<void> {
  exigirId(userId);
  if (!ehUuid(alimentoId)) return;
  const valores = tipo === "base" ? { userId, refeicao, alimentoBaseId: alimentoId } : { userId, refeicao, alimentoUsuarioId: alimentoId };
  await db.insert(rotinaOcultos).values(valores).onConflictDoNothing();
}

/** Volta a mostrar um item escondido (só os do próprio usuário). */
export async function reexibirNaRotina(userId: string, id: string): Promise<boolean> {
  exigirId(userId);
  if (!ehUuid(id)) return false;
  const r = await db.delete(rotinaOcultos).where(and(eq(rotinaOcultos.id, id), eq(rotinaOcultos.userId, userId))).returning({ id: rotinaOcultos.id });
  return r.length > 0;
}
